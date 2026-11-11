import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../../channels/entities/store.entity.js';
import { SchedulerLeaderService } from '../../common/scheduler/scheduler-leader.service.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';

/** Mutates synthetic Primemotive rows only; this service never calls eBay. */
@Injectable()
export class PrimemotiveListingSimulatorService {
  private readonly logger = new Logger(PrimemotiveListingSimulatorService.name);

  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    private readonly leader: SchedulerLeaderService,
  ) {}

  @Cron('0 * * * * *', { name: 'primemotive-listing-simulator' })
  async updateSyntheticListing(): Promise<void> {
    if (!this.isEnabled()) return;
    const organizationId =
      process.env.PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID?.trim();
    if (!organizationId) {
      this.logger.warn(
        'Primemotive simulator is enabled but PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID is empty',
      );
      return;
    }

    await this.leader.runIfLeader(
      'primemotive-listing-simulator',
      55,
      async () => this.changeOneSyntheticListing(organizationId),
    );
  }

  private isEnabled(): boolean {
    const value =
      process.env.PRIMEMOTIVE_SIMULATION_ENABLED?.trim().toLowerCase();
    return value === 'true' || value === '1';
  }

  private async changeOneSyntheticListing(
    organizationId: string,
  ): Promise<void> {
    const listings = await this.listingRepo
      .createQueryBuilder('listing')
      .innerJoin(Store, 'store', 'store.id = listing.storeId')
      .where('listing.organizationId = :organizationId', { organizationId })
      .andWhere('listing.isTestListing = true')
      .andWhere("listing.listingStatus = 'active'")
      .andWhere('store.channel = :channel', { channel: 'ebay' })
      .andWhere('LOWER(BTRIM(store.store_name)) = :storeName', {
        storeName: 'primemotive',
      })
      .orderBy('listing.ebayItemId', 'ASC')
      .getMany();

    if (!listings.length) {
      this.logger.warn(
        `Primemotive simulator has no active synthetic listings for organization ${organizationId}; run seed:primemotive-dummies first`,
      );
      return;
    }

    const listing = listings[Math.floor(Math.random() * listings.length)];
    if (Math.random() < 0.5) {
      const current = Number(listing.price ?? 100);
      const direction = Math.random() < 0.5 ? -1 : 1;
      const change = 1 + Math.floor(Math.random() * 5);
      listing.price = Math.max(1, current + direction * change).toFixed(2);
    } else {
      const current = listing.quantityAvailable ?? 0;
      const direction =
        current <= 0 ? 1 : current >= 20 ? -1 : Math.random() < 0.5 ? -1 : 1;
      listing.quantityAvailable = Math.max(0, current + direction);
    }

    await this.listingRepo.save(listing);
    this.logger.debug(
      `Updated synthetic Primemotive listing ${listing.ebayItemId} for integration testing`,
    );
  }
}
