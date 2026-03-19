import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ReviewTask,
  ReviewTaskStatus,
  ReviewTaskPriority,
  ReviewTaskReason,
  MotorsProduct,
  MotorsProductStatus,
  MotorsFeedbackLog,
  FeedbackType,
  CorrectionRule,
  CorrectionType,
} from '../entities';
import { ReviewTaskQueryDto, ResolveReviewTaskDto } from '../dto';

@Injectable()
export class ReviewQueueService {
  private readonly logger = new Logger(ReviewQueueService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly reviewTaskRepo: Repository<ReviewTask>,
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    @InjectRepository(MotorsFeedbackLog)
    private readonly feedbackLogRepo: Repository<MotorsFeedbackLog>,
    @InjectRepository(CorrectionRule)
    private readonly correctionRuleRepo: Repository<CorrectionRule>,
  ) {}

  async createReviewTask(
    motorsProductId: string,
    reason: ReviewTaskReason,
    detail?: string,
    snapshots?: {
      productSnapshot?: Record<string, any>;
      candidatesSnapshot?: any[];
      extractionSnapshot?: Record<string, any>;
      fitmentSnapshot?: any[];
      validationSnapshot?: Record<string, any>;
      complianceSnapshot?: Record<string, any>;
    },
  ): Promise<ReviewTask> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    // Determine priority based on reason
    const priority = this.determinePriority(reason);

    const task = this.reviewTaskRepo.create({
      motorsProductId,
      organizationId: product.organizationId,
      reason,
      reasonDetail: detail,
      priority,
      productSnapshot: snapshots?.productSnapshot || this.snapshotProduct(product),
      candidatesSnapshot: snapshots?.candidatesSnapshot,
      extractionSnapshot: snapshots?.extractionSnapshot,
      fitmentSnapshot: snapshots?.fitmentSnapshot,
      validationSnapshot: snapshots?.validationSnapshot,
      complianceSnapshot: snapshots?.complianceSnapshot,
    });

    // Update product status
    product.status = MotorsProductStatus.REVIEW_REQUIRED;
    await this.motorsProductRepo.save(product);

    return this.reviewTaskRepo.save(task);
  }

  async getReviewTasks(query: ReviewTaskQueryDto): Promise<{
    tasks: ReviewTask[];
    total: number;
  }> {
    const qb = this.reviewTaskRepo.createQueryBuilder('rt');

    if (query.status) {
      qb.andWhere('rt.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('rt.priority = :priority', { priority: query.priority });
    }
    if (query.reason) {
      qb.andWhere('rt.reason = :reason', { reason: query.reason });
    }
    if (query.assignedTo) {
      qb.andWhere('rt.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
    }

    qb.orderBy('rt.priority', 'DESC')
      .addOrderBy('rt.createdAt', 'ASC');

    const total = await qb.getCount();
    const tasks = await qb
      .skip(query.offset || 0)
      .take(query.limit || 50)
      .getMany();

    return { tasks, total };
  }

  async getReviewTask(id: string): Promise<ReviewTask> {
    return this.reviewTaskRepo.findOneOrFail({ where: { id } });
  }

  /** Aliases for controller compatibility */
  async listTasks(query: ReviewTaskQueryDto): Promise<{ items: ReviewTask[]; total: number }> {
    const page = Number((query as any).page || 1);
    const limit = Number(query.limit || 25);
    const result = await this.getReviewTasks({
      ...query,
      offset: (page - 1) * limit,
      limit,
    });
    return { items: result.tasks, total: result.total };
  }

  async getTask(id: string): Promise<ReviewTask> {
    return this.getReviewTask(id);
  }

  async getStats(): Promise<Record<string, any>> {
    return this.getTaskStats();
  }

  async assignTask(taskId: string, userId: string): Promise<ReviewTask> {
    const task = await this.reviewTaskRepo.findOneOrFail({ where: { id: taskId } });
    task.assignedTo = userId;
    task.assignedAt = new Date();
    task.status = ReviewTaskStatus.IN_PROGRESS;
    return this.reviewTaskRepo.save(task);
  }

  async resolveTask(
    taskId: string,
    userId: string,
    dto: ResolveReviewTaskDto,
  ): Promise<ReviewTask> {
    const task = await this.reviewTaskRepo.findOneOrFail({ where: { id: taskId } });
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: task.motorsProductId },
    });

    task.resolution = dto.resolution;
    task.resolutionData = dto.resolutionData || null;
    task.resolvedBy = userId;
    task.resolvedAt = new Date();

    switch (dto.action) {
      case 'approve':
        task.status = ReviewTaskStatus.APPROVED;
        product.status = MotorsProductStatus.APPROVED;
        product.approvedBy = userId;
        product.approvedAt = new Date();

        // Apply any resolution data corrections to the product
        if (dto.resolutionData) {
          this.applyResolutionToProduct(product, dto.resolutionData);
        }
        break;

      case 'reject':
        task.status = ReviewTaskStatus.REJECTED;
        product.status = MotorsProductStatus.REJECTED;
        break;

      case 'defer':
        task.status = ReviewTaskStatus.DEFERRED;
        break;

      default:
        task.status = ReviewTaskStatus.APPROVED;
        product.status = MotorsProductStatus.APPROVED;
    }

    await this.motorsProductRepo.save(product);

    // Log feedback for learning
    await this.logFeedback(task, product, dto, userId);

    return this.reviewTaskRepo.save(task);
  }

  async getTaskStats(): Promise<Record<string, any>> {
    const statusCounts = await this.reviewTaskRepo
      .createQueryBuilder('rt')
      .select('rt.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('rt.status')
      .getRawMany();

    const priorityCounts = await this.reviewTaskRepo
      .createQueryBuilder('rt')
      .select('rt.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('rt.status IN (:...statuses)', {
        statuses: [ReviewTaskStatus.OPEN, ReviewTaskStatus.IN_PROGRESS],
      })
      .groupBy('rt.priority')
      .getRawMany();

    const reasonCounts = await this.reviewTaskRepo
      .createQueryBuilder('rt')
      .select('rt.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('rt.status IN (:...statuses)', {
        statuses: [ReviewTaskStatus.OPEN, ReviewTaskStatus.IN_PROGRESS],
      })
      .groupBy('rt.reason')
      .getRawMany();

    return {
      byStatus: statusCounts,
      byPriority: priorityCounts,
      byReason: reasonCounts,
    };
  }

  private determinePriority(reason: ReviewTaskReason): ReviewTaskPriority {
    switch (reason) {
      case ReviewTaskReason.COMPLIANCE_FAILURE:
      case ReviewTaskReason.DUPLICATE_DETECTED:
        return ReviewTaskPriority.CRITICAL;
      case ReviewTaskReason.MULTIPLE_IDENTITIES:
      case ReviewTaskReason.OCR_CONFLICT:
      case ReviewTaskReason.BRAND_AMBIGUITY:
        return ReviewTaskPriority.HIGH;
      case ReviewTaskReason.MISSING_FITMENT:
      case ReviewTaskReason.FITMENT_UNVERIFIED:
      case ReviewTaskReason.QUANTITY_AMBIGUITY:
      case ReviewTaskReason.SIDE_ORIENTATION_CONFLICT:
      case ReviewTaskReason.FRONT_REAR_CONFLICT:
        return ReviewTaskPriority.MEDIUM;
      case ReviewTaskReason.TITLE_QUALITY:
      case ReviewTaskReason.MISSING_REQUIRED_ASPECTS:
      case ReviewTaskReason.IMAGE_ONLY:
      case ReviewTaskReason.LOW_CONFIDENCE:
      case ReviewTaskReason.SUPPLIER_CONFLICT:
      default:
        return ReviewTaskPriority.LOW;
    }
  }

  private snapshotProduct(product: MotorsProduct): Record<string, any> {
    return {
      id: product.id,
      brand: product.brand,
      mpn: product.mpn,
      productType: product.productType,
      placement: product.placement,
      condition: product.condition,
      ebayCategoryId: product.ebayCategoryId,
      identityConfidence: product.identityConfidence,
      fitmentConfidence: product.fitmentConfidence,
      generatedTitle: product.generatedTitle,
      generatedItemSpecifics: product.generatedItemSpecifics,
      imageUrls: product.imageUrls,
      status: product.status,
    };
  }

  private applyResolutionToProduct(
    product: MotorsProduct,
    resolutionData: Record<string, any>,
  ): void {
    const allowedFields = [
      'brand', 'mpn', 'oemPartNumber', 'productType', 'placement',
      'condition', 'ebayCategoryId', 'generatedTitle',
      'generatedItemSpecifics', 'generatedBulletFeatures',
      'generatedHtmlDescription', 'fitmentRows',
      'price', 'quantity', 'sideOrientation', 'frontRear',
    ];

    for (const field of allowedFields) {
      if (resolutionData[field] !== undefined) {
        (product as any)[field] = resolutionData[field];
      }
    }
  }

  private async logFeedback(
    task: ReviewTask,
    product: MotorsProduct,
    dto: ResolveReviewTaskDto,
    userId: string,
  ): Promise<void> {
    if (!dto.resolutionData) return;

    for (const [field, value] of Object.entries(dto.resolutionData)) {
      const originalValue = (product as any)[field];
      if (originalValue !== value) {
        const feedbackType = this.mapFieldToFeedbackType(field);
        if (feedbackType) {
          const feedback = this.feedbackLogRepo.create({
            motorsProductId: product.id,
            reviewTaskId: task.id,
            feedbackType,
            field,
            originalValue: typeof originalValue === 'object'
              ? JSON.stringify(originalValue)
              : String(originalValue || ''),
            correctedValue: typeof value === 'object'
              ? JSON.stringify(value)
              : String(value || ''),
            context: {
              reason: task.reason,
              resolution: dto.resolution,
            },
            createdBy: userId,
          });
          await this.feedbackLogRepo.save(feedback);
        }
      }
    }
  }

  private mapFieldToFeedbackType(field: string): FeedbackType | null {
    switch (field) {
      case 'brand': return FeedbackType.BRAND_CORRECTION;
      case 'mpn': return FeedbackType.MPN_CORRECTION;
      case 'generatedTitle': return FeedbackType.TITLE_EDIT;
      case 'fitmentRows': return FeedbackType.FITMENT_EDIT;
      case 'generatedItemSpecifics': return FeedbackType.SPECIFICS_EDIT;
      case 'ebayCategoryId': return FeedbackType.CATEGORY_CORRECTION;
      default: return FeedbackType.REVIEWER_CORRECTION;
    }
  }
}
