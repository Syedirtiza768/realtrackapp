import { Repository } from 'typeorm';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayFulfillmentApiService } from '../channels/ebay/ebay-fulfillment-api.service.js';
import { OrdersService } from './orders.service.js';
import { Order } from './entities/order.entity.js';
export declare class EbayOrderImportService {
    private readonly storeRepo;
    private readonly connectedAccountRepo;
    private readonly orderRepo;
    private readonly fulfillmentApi;
    private readonly ordersService;
    private readonly logger;
    constructor(storeRepo: Repository<Store>, connectedAccountRepo: Repository<ConnectedEbayAccount>, orderRepo: Repository<Order>, fulfillmentApi: EbayFulfillmentApiService, ordersService: OrdersService);
    importFromAllStores(): Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }[]>;
    private resolveStoresToPoll;
    importFromConnectedAccount(ebayAccountId: string, organizationId: string): Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }>;
    importFromStore(storeId: string): Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }>;
    private nextWatermark;
    private importSingleOrder;
}
