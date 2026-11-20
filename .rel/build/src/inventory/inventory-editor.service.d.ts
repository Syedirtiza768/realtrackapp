import { Repository } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { PartFitment } from '../fitment/entities/part-fitment.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../integrations/ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../integrations/ebay/entities/ebay-business-policy.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import type { EditorResponse, SaveEditorDto } from './dto/inventory-editor.dto.js';
export declare class InventoryEditorService {
    private readonly listingRepo;
    private readonly productRepo;
    private readonly fitmentRepo;
    private readonly storeRepo;
    private readonly ebayAccountRepo;
    private readonly marketplaceRepo;
    private readonly policyRepo;
    private readonly storeAccess;
    private readonly logger;
    constructor(listingRepo: Repository<ListingRecord>, productRepo: Repository<CatalogProduct>, fitmentRepo: Repository<PartFitment>, storeRepo: Repository<Store>, ebayAccountRepo: Repository<ConnectedEbayAccount>, marketplaceRepo: Repository<EbayAccountMarketplace>, policyRepo: Repository<EbayBusinessPolicy>, storeAccess: StoreAccessService);
    getEditorData(listingId: string, user: User): Promise<EditorResponse>;
    saveEditorData(listingId: string, dto: SaveEditorDto): Promise<{
        ok: boolean;
    }>;
    private cloneListingForMarketplace;
    private buildMarketplaceVersions;
    private getStoresWithPolicies;
    private parseImageUrls;
}
