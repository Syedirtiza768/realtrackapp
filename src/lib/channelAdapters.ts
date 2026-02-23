import type { ChannelAdapter, ListingState, Marketplace } from '../types/platform';

export class ConnectorRegistry {
    private readonly adapters = new Map<Marketplace, ChannelAdapter>();

    register(adapter: ChannelAdapter): void {
        this.adapters.set(adapter.marketplace, adapter);
    }

    get(marketplace: Marketplace): ChannelAdapter {
        const adapter = this.adapters.get(marketplace);
        if (!adapter) {
            throw new Error(`No channel adapter registered for ${marketplace}`);
        }
        return adapter;
    }
}

export class MultiChannelListingService {
    constructor(private readonly registry: ConnectorRegistry) {}

    async publish(listings: ListingState[]): Promise<ListingState[]> {
        const published: ListingState[] = [];

        for (const listing of listings) {
            const adapter = this.registry.get(listing.marketplace);
            const { externalListingId } = await adapter.publishListing(listing);
            published.push({
                ...listing,
                externalListingId,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
            });
        }

        return published;
    }

    async bulkUpdate(listings: ListingState[]): Promise<void> {
        for (const listing of listings) {
            const adapter = this.registry.get(listing.marketplace);
            await adapter.updateListing({
                ...listing,
                lastSyncedAt: new Date().toISOString(),
            });
        }
    }
}
