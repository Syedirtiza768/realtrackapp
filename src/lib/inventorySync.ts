import type {
    InventorySnapshot,
    InventorySyncEvent,
    ListingState,
} from '../types/platform';
import { ConnectorRegistry } from './channelAdapters';

export function applyInventoryEvent(
    snapshot: InventorySnapshot,
    event: InventorySyncEvent,
): InventorySnapshot {
    const available = Math.max(0, snapshot.available + event.quantityDelta);
    const onHand = Math.max(snapshot.reserved, snapshot.onHand + event.quantityDelta);

    return {
        ...snapshot,
        available,
        onHand,
        updatedAt: new Date().toISOString(),
    };
}

export function detectPotentialDuplicateListings(listings: ListingState[]): ListingState[] {
    const seen = new Set<string>();
    const duplicates: ListingState[] = [];

    for (const listing of listings) {
        const key = `${listing.productId}:${listing.marketplace}:${listing.title.toLowerCase()}`;
        if (seen.has(key)) {
            duplicates.push(listing);
            continue;
        }
        seen.add(key);
    }

    return duplicates;
}

export class InventoryOrchestrator {
    constructor(private readonly registry: ConnectorRegistry) {}

    async syncQuantities(listings: ListingState[], availableByProductId: Map<string, number>): Promise<void> {
        for (const listing of listings) {
            const available = availableByProductId.get(listing.productId) ?? 0;
            const adapter = this.registry.get(listing.marketplace);

            if (!listing.externalListingId) {
                continue;
            }

            if (available <= 0) {
                await adapter.endListing(listing.externalListingId);
                continue;
            }

            await adapter.syncInventory(listing.externalListingId, available);
        }
    }
}
