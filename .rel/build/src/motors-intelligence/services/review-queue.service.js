"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReviewQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewQueueService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../entities");
let ReviewQueueService = ReviewQueueService_1 = class ReviewQueueService {
    reviewTaskRepo;
    motorsProductRepo;
    feedbackLogRepo;
    correctionRuleRepo;
    logger = new common_1.Logger(ReviewQueueService_1.name);
    constructor(reviewTaskRepo, motorsProductRepo, feedbackLogRepo, correctionRuleRepo) {
        this.reviewTaskRepo = reviewTaskRepo;
        this.motorsProductRepo = motorsProductRepo;
        this.feedbackLogRepo = feedbackLogRepo;
        this.correctionRuleRepo = correctionRuleRepo;
    }
    async createReviewTask(motorsProductId, reason, detail, snapshots) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
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
        product.status = entities_1.MotorsProductStatus.REVIEW_REQUIRED;
        await this.motorsProductRepo.save(product);
        return this.reviewTaskRepo.save(task);
    }
    async getReviewTasks(query) {
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
            qb.andWhere('rt.assignedTo = :assignedTo', {
                assignedTo: query.assignedTo,
            });
        }
        qb.orderBy('rt.priority', 'DESC').addOrderBy('rt.createdAt', 'ASC');
        const total = await qb.getCount();
        const tasks = await qb
            .skip(query.offset || 0)
            .take(query.limit || 50)
            .getMany();
        return { tasks, total };
    }
    async getReviewTask(id) {
        return this.reviewTaskRepo.findOneOrFail({ where: { id } });
    }
    async listTasks(query) {
        const page = Number(query.page || 1);
        const limit = Number(query.limit || 25);
        const result = await this.getReviewTasks({
            ...query,
            offset: (page - 1) * limit,
            limit,
        });
        return { items: result.tasks, total: result.total };
    }
    async getTask(id) {
        return this.getReviewTask(id);
    }
    async getStats() {
        return this.getTaskStats();
    }
    async assignTask(taskId, userId) {
        const task = await this.reviewTaskRepo.findOneOrFail({
            where: { id: taskId },
        });
        task.assignedTo = userId;
        task.assignedAt = new Date();
        task.status = entities_1.ReviewTaskStatus.IN_PROGRESS;
        return this.reviewTaskRepo.save(task);
    }
    async resolveTask(taskId, userId, dto) {
        const task = await this.reviewTaskRepo.findOneOrFail({
            where: { id: taskId },
        });
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: task.motorsProductId },
        });
        task.resolution = dto.resolution;
        task.resolutionData = dto.resolutionData || null;
        task.resolvedBy = userId;
        task.resolvedAt = new Date();
        switch (dto.action) {
            case 'approve':
                task.status = entities_1.ReviewTaskStatus.APPROVED;
                product.status = entities_1.MotorsProductStatus.APPROVED;
                product.approvedBy = userId;
                product.approvedAt = new Date();
                if (dto.resolutionData) {
                    this.applyResolutionToProduct(product, dto.resolutionData);
                }
                break;
            case 'reject':
                task.status = entities_1.ReviewTaskStatus.REJECTED;
                product.status = entities_1.MotorsProductStatus.REJECTED;
                break;
            case 'defer':
                task.status = entities_1.ReviewTaskStatus.DEFERRED;
                break;
            default:
                task.status = entities_1.ReviewTaskStatus.APPROVED;
                product.status = entities_1.MotorsProductStatus.APPROVED;
        }
        await this.motorsProductRepo.save(product);
        await this.logFeedback(task, product, dto, userId);
        return this.reviewTaskRepo.save(task);
    }
    async getTaskStats() {
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
            statuses: [entities_1.ReviewTaskStatus.OPEN, entities_1.ReviewTaskStatus.IN_PROGRESS],
        })
            .groupBy('rt.priority')
            .getRawMany();
        const reasonCounts = await this.reviewTaskRepo
            .createQueryBuilder('rt')
            .select('rt.reason', 'reason')
            .addSelect('COUNT(*)', 'count')
            .where('rt.status IN (:...statuses)', {
            statuses: [entities_1.ReviewTaskStatus.OPEN, entities_1.ReviewTaskStatus.IN_PROGRESS],
        })
            .groupBy('rt.reason')
            .getRawMany();
        return {
            byStatus: statusCounts,
            byPriority: priorityCounts,
            byReason: reasonCounts,
        };
    }
    determinePriority(reason) {
        switch (reason) {
            case entities_1.ReviewTaskReason.COMPLIANCE_FAILURE:
            case entities_1.ReviewTaskReason.DUPLICATE_DETECTED:
                return entities_1.ReviewTaskPriority.CRITICAL;
            case entities_1.ReviewTaskReason.MULTIPLE_IDENTITIES:
            case entities_1.ReviewTaskReason.OCR_CONFLICT:
            case entities_1.ReviewTaskReason.BRAND_AMBIGUITY:
                return entities_1.ReviewTaskPriority.HIGH;
            case entities_1.ReviewTaskReason.MISSING_FITMENT:
            case entities_1.ReviewTaskReason.FITMENT_UNVERIFIED:
            case entities_1.ReviewTaskReason.QUANTITY_AMBIGUITY:
            case entities_1.ReviewTaskReason.SIDE_ORIENTATION_CONFLICT:
            case entities_1.ReviewTaskReason.FRONT_REAR_CONFLICT:
                return entities_1.ReviewTaskPriority.MEDIUM;
            case entities_1.ReviewTaskReason.TITLE_QUALITY:
            case entities_1.ReviewTaskReason.MISSING_REQUIRED_ASPECTS:
            case entities_1.ReviewTaskReason.IMAGE_ONLY:
            case entities_1.ReviewTaskReason.LOW_CONFIDENCE:
            case entities_1.ReviewTaskReason.SUPPLIER_CONFLICT:
            default:
                return entities_1.ReviewTaskPriority.LOW;
        }
    }
    snapshotProduct(product) {
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
    applyResolutionToProduct(product, resolutionData) {
        const allowedFields = [
            'brand',
            'mpn',
            'oemPartNumber',
            'productType',
            'placement',
            'condition',
            'ebayCategoryId',
            'generatedTitle',
            'generatedItemSpecifics',
            'generatedBulletFeatures',
            'generatedHtmlDescription',
            'fitmentRows',
            'price',
            'quantity',
            'sideOrientation',
            'frontRear',
        ];
        for (const field of allowedFields) {
            if (resolutionData[field] !== undefined) {
                product[field] = resolutionData[field];
            }
        }
    }
    async logFeedback(task, product, dto, userId) {
        if (!dto.resolutionData)
            return;
        for (const [field, value] of Object.entries(dto.resolutionData)) {
            const originalValue = product[field];
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
    mapFieldToFeedbackType(field) {
        switch (field) {
            case 'brand':
                return entities_1.FeedbackType.BRAND_CORRECTION;
            case 'mpn':
                return entities_1.FeedbackType.MPN_CORRECTION;
            case 'generatedTitle':
                return entities_1.FeedbackType.TITLE_EDIT;
            case 'fitmentRows':
                return entities_1.FeedbackType.FITMENT_EDIT;
            case 'generatedItemSpecifics':
                return entities_1.FeedbackType.SPECIFICS_EDIT;
            case 'ebayCategoryId':
                return entities_1.FeedbackType.CATEGORY_CORRECTION;
            default:
                return entities_1.FeedbackType.REVIEWER_CORRECTION;
        }
    }
};
exports.ReviewQueueService = ReviewQueueService;
exports.ReviewQueueService = ReviewQueueService = ReviewQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ReviewTask)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.MotorsFeedbackLog)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.CorrectionRule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReviewQueueService);
//# sourceMappingURL=review-queue.service.js.map