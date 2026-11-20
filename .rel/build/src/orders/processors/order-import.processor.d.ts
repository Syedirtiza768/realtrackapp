import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { OrdersService } from '../orders.service.js';
import { Order } from '../entities/order.entity.js';
import { EbayOrderImportService } from '../order-import-ebay.service.js';
export declare class OrderImportProcessor extends WorkerHost {
    private readonly ordersService;
    private readonly ebayImport;
    private readonly orderRepo;
    private readonly logger;
    constructor(ordersService: OrdersService, ebayImport: EbayOrderImportService, orderRepo: Repository<Order>);
    process(job: Job): Promise<void>;
    private importFromAllChannels;
    private autoComplete;
}
