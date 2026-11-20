import { ReviewQueueService } from '../services/review-queue.service';
import { ReviewTaskQueryDto, ResolveReviewTaskDto } from '../dto';
import { User } from '../../auth/entities/user.entity.js';
export declare class ReviewQueueController {
    private readonly reviewService;
    constructor(reviewService: ReviewQueueService);
    listTasks(query: ReviewTaskQueryDto): Promise<{
        items: import("../entities").ReviewTask[];
        total: number;
    }>;
    getTask(id: string): Promise<import("../entities").ReviewTask>;
    assignTask(id: string, assignedTo: string): Promise<import("../entities").ReviewTask>;
    resolveTask(id: string, dto: ResolveReviewTaskDto, user: User): Promise<import("../entities").ReviewTask>;
    getStats(): Promise<Record<string, any>>;
}
