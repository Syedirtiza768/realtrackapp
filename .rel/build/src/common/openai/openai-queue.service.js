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
var OpenAiQueueService_1, OpenAiQueueProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiQueueProcessor = exports.OpenAiQueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const event_emitter_1 = require("@nestjs/event-emitter");
const openai_service_js_1 = require("./openai.service.js");
const PRIORITY_MAP = {
    critical: 1,
    high: 3,
    normal: 5,
    low: 10,
};
let OpenAiQueueService = OpenAiQueueService_1 = class OpenAiQueueService {
    queue;
    logger = new common_1.Logger(OpenAiQueueService_1.name);
    constructor(queue) {
        this.queue = queue;
    }
    onModuleInit() {
        this.logger.log('OpenAI queue service initialized');
    }
    async enqueue(job) {
        const bullJob = await this.queue.add('openai-chat', job, {
            jobId: job.jobId,
            priority: PRIORITY_MAP[job.priority] ?? PRIORITY_MAP.normal,
            attempts: job.maxRetries ?? 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 200 },
        });
        this.logger.debug(`Enqueued OpenAI job ${job.jobId} (priority=${job.priority}, caller=${job.callerContext ?? 'unknown'})`);
        return bullJob.id;
    }
    async getQueueHealth() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
        ]);
        return { waiting, active, completed, failed, delayed };
    }
    async drain() {
        await this.queue.drain();
        this.logger.warn('OpenAI queue drained');
    }
};
exports.OpenAiQueueService = OpenAiQueueService;
exports.OpenAiQueueService = OpenAiQueueService = OpenAiQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('openai')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], OpenAiQueueService);
let OpenAiQueueProcessor = OpenAiQueueProcessor_1 = class OpenAiQueueProcessor extends bullmq_1.WorkerHost {
    openai;
    events;
    logger = new common_1.Logger(OpenAiQueueProcessor_1.name);
    constructor(openai, events) {
        super();
        this.openai = openai;
        this.events = events;
    }
    async process(job) {
        const { jobId, request, callbackEvent, callerContext } = job.data;
        this.logger.debug(`Processing OpenAI job ${jobId} (attempt ${job.attemptsMade + 1}, caller=${callerContext ?? 'unknown'})`);
        try {
            const response = await this.openai.chat(request);
            const result = {
                jobId,
                success: true,
                response,
                retryCount: job.attemptsMade,
            };
            if (callbackEvent) {
                this.events.emit(callbackEvent, result);
            }
            return result;
        }
        catch (err) {
            this.logger.error(`OpenAI job ${jobId} failed: ${err.message}`, err.stack);
            const result = {
                jobId,
                success: false,
                error: err.message,
                retryCount: job.attemptsMade,
            };
            if (callbackEvent) {
                this.events.emit(`${callbackEvent}.error`, result);
            }
            throw err;
        }
    }
};
exports.OpenAiQueueProcessor = OpenAiQueueProcessor;
exports.OpenAiQueueProcessor = OpenAiQueueProcessor = OpenAiQueueProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('openai', { concurrency: 3 }),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService,
        event_emitter_1.EventEmitter2])
], OpenAiQueueProcessor);
//# sourceMappingURL=openai-queue.service.js.map