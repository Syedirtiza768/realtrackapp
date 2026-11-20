import type { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MotorsIntelligenceService } from '../services/motors-intelligence.service';
import { EbayEnrichmentService } from '../services/ebay-enrichment.service';
import { StorageService } from '../../storage/storage.service';
import { CreateMotorsProductDto, BatchCreateMotorsProductDto, MotorsProductQueryDto, UpdateMotorsProductDto, ImageUploadRequestDto, ImageUploadResponseDto, ConfirmUploadDto, ConfirmUploadResponseDto } from '../dto';
import { Queue } from 'bullmq';
import { User } from '../../auth/entities/user.entity.js';
export declare class MotorsIntelligenceController {
    private readonly motorsService;
    private readonly ebayEnrichmentService;
    private readonly storageService;
    private readonly eventEmitter;
    private readonly pipelineQueue;
    constructor(motorsService: MotorsIntelligenceService, ebayEnrichmentService: EbayEnrichmentService, storageService: StorageService, eventEmitter: EventEmitter2, pipelineQueue: Queue);
    uploadImages(dto: ImageUploadRequestDto, user: User): Promise<ImageUploadResponseDto>;
    confirmUpload(id: string, dto: ConfirmUploadDto): Promise<ConfirmUploadResponseDto>;
    streamProgress(id: string, res: Response): Promise<void>;
    enrichProduct(id: string): Promise<import("../services/ebay-enrichment.service").EnrichmentResult>;
    createProduct(dto: CreateMotorsProductDto, user: User): Promise<import("../entities").MotorsProduct>;
    batchCreate(dto: BatchCreateMotorsProductDto, user: User): Promise<import("../entities").MotorsProduct[]>;
    listProducts(query: MotorsProductQueryDto): Promise<{
        items: import("../entities").MotorsProduct[];
        total: number;
    }>;
    getProduct(id: string): Promise<import("../entities").MotorsProduct>;
    updateProduct(id: string, dto: UpdateMotorsProductDto): Promise<import("../entities").MotorsProduct>;
    deleteProduct(id: string): Promise<void>;
    runPipeline(id: string): Promise<import("../dto").MotorsPipelineResultDto>;
    publish(id: string, connectionId: string): Promise<{
        success: boolean;
        ebayListingId?: string;
        error?: string;
    }>;
    getStats(): Promise<Record<string, any>>;
}
