import { Repository } from 'typeorm';
import { ReviewTask, ReviewTaskReason, MotorsProduct, MotorsFeedbackLog, CorrectionRule } from '../entities';
import { ReviewTaskQueryDto, ResolveReviewTaskDto } from '../dto';
export declare class ReviewQueueService {
    private readonly reviewTaskRepo;
    private readonly motorsProductRepo;
    private readonly feedbackLogRepo;
    private readonly correctionRuleRepo;
    private readonly logger;
    constructor(reviewTaskRepo: Repository<ReviewTask>, motorsProductRepo: Repository<MotorsProduct>, feedbackLogRepo: Repository<MotorsFeedbackLog>, correctionRuleRepo: Repository<CorrectionRule>);
    createReviewTask(motorsProductId: string, reason: ReviewTaskReason, detail?: string, snapshots?: {
        productSnapshot?: Record<string, any>;
        candidatesSnapshot?: any[];
        extractionSnapshot?: Record<string, any>;
        fitmentSnapshot?: any[];
        validationSnapshot?: Record<string, any>;
        complianceSnapshot?: Record<string, any>;
    }): Promise<ReviewTask>;
    getReviewTasks(query: ReviewTaskQueryDto): Promise<{
        tasks: ReviewTask[];
        total: number;
    }>;
    getReviewTask(id: string): Promise<ReviewTask>;
    listTasks(query: ReviewTaskQueryDto): Promise<{
        items: ReviewTask[];
        total: number;
    }>;
    getTask(id: string): Promise<ReviewTask>;
    getStats(): Promise<Record<string, any>>;
    assignTask(taskId: string, userId: string): Promise<ReviewTask>;
    resolveTask(taskId: string, userId: string, dto: ResolveReviewTaskDto): Promise<ReviewTask>;
    getTaskStats(): Promise<Record<string, any>>;
    private determinePriority;
    private snapshotProduct;
    private applyResolutionToProduct;
    private logFeedback;
    private mapFieldToFeedbackType;
}
