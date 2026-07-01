import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayPublishedListingRevision } from '../entities/ebay-published-listing-revision.entity.js';

@Injectable()
export class PublishedListingsAuditService {
  constructor(
    @InjectRepository(EbayPublishedListingRevision)
    private readonly revisionRepo: Repository<EbayPublishedListingRevision>,
  ) {}

  async writeRevision(entry: Partial<EbayPublishedListingRevision>): Promise<void> {
    const row = this.revisionRepo.create(entry as EbayPublishedListingRevision);
    await this.revisionRepo.save(row);
  }

  async listRevisions(
    publishedListingId: string,
    organizationId: string,
    limit = 50,
  ): Promise<EbayPublishedListingRevision[]> {
    return this.revisionRepo.find({
      where: { publishedListingId, organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }
}
