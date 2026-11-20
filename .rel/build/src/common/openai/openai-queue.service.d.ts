import { OnModuleInit } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpenAiService } from './openai.service.js';
import type { OpenAiQueueJob, OpenAiQueueResult } from './openai.types.js';
export declare class OpenAiQueueService implements OnModuleInit {
    private readonly queue;
    private readonly logger;
    constructor(queue: Queue);
    onModuleInit(): void;
    enqueue(job: OpenAiQueueJob): Promise<string>;
    getQueueHealth(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    drain(): Promise<void>;
}
export declare class OpenAiQueueProcessor extends WorkerHost {
    private readonly openai;
    private readonly events;
    private readonly logger;
    constructor(openai: OpenAiService, events: EventEmitter2);
    process(job: Job<OpenAiQueueJob>): Promise<OpenAiQueueResult>;
}
