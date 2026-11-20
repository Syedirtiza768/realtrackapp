import { OrdersService } from './orders.service.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { EbayOrderImportService } from './order-import-ebay.service.js';
import { OrdersQueryDto, UpdateOrderStatusDto, UpdateShippingDto, RefundDto, BulkShipDto, BulkCancelDto, CsvTrackingUploadDto, ManualImportDto } from './dto/orders.dto.js';
export declare class OrdersController {
    private readonly ordersService;
    private readonly fulfillmentService;
    private readonly ebayImportService;
    constructor(ordersService: OrdersService, fulfillmentService: OrderFulfillmentService, ebayImportService: EbayOrderImportService);
    findAll(dto: OrdersQueryDto): Promise<{
        orders: import("./entities/order.entity.js").Order[];
        total: number;
    }>;
    getStats(): Promise<Record<string, number>>;
    findOne(id: string): Promise<{
        order: import("./entities/order.entity.js").Order;
        items: import("./entities/order-item.entity.js").OrderItem[];
    }>;
    updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<import("./entities/order.entity.js").Order>;
    updateShipping(id: string, dto: UpdateShippingDto): Promise<import("./entities/order.entity.js").Order>;
    refund(id: string, dto: RefundDto): Promise<import("./entities/order.entity.js").Order>;
    shipOrder(id: string, dto: UpdateShippingDto): Promise<import("./entities/order.entity.js").Order>;
    bulkShip(dto: BulkShipDto): Promise<{
        orderId: string;
        success: boolean;
        error?: string;
    }[]>;
    bulkCancel(dto: BulkCancelDto): Promise<{
        orderId: string;
        success: boolean;
        error?: string;
    }[]>;
    trackingUpload(dto: CsvTrackingUploadDto): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
        errors: Array<{
            row: number;
            orderId: string;
            error: string;
        }>;
    }>;
    importEbayOrders(dto: ManualImportDto): Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }[]> | Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }>;
}
