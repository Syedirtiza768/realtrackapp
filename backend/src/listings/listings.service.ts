import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource, In, Repository } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import * as XLSX from 'xlsx';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { BulkProfilesDto } from './dto/bulk-profiles.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingRecord, ListingOrigin } from './listing-record.entity';
import { ListingRevision } from './listing-revision.entity';
import { extractMakeModelFromTitle } from './utils/extract-make-model-from-title.js';

import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import { TeamsService } from '../teams/teams.service.js';

/**
 * Maps each Excel header text (normalized to lowercase) to the
 * corresponding entity property name.  The first column header varies
 * between files (contains Action(SiteID=…)), so we match it with a
 * startsWith check separately.
 */
const HEADER_TO_PROPERTY: Record<string, keyof ListingRecord> = {
  'custom label (sku)': 'customLabelSku',
  'category id': 'categoryId',
  'category name': 'categoryName',
  title: 'title',
  relationship: 'relationship',
  'relationship details': 'relationshipDetails',
  'schedule time': 'scheduleTime',
  'p:upc': 'pUpc',
  'p:epid': 'pEpid',
  'start price': 'startPrice',
  quantity: 'quantity',
  'item photo url': 'itemPhotoUrl',
  'condition id': 'conditionId',
  description: 'description',
  format: 'format',
  duration: 'duration',
  'buy it now price': 'buyItNowPrice',
  'best offer enabled': 'bestOfferEnabled',
  'best offer auto accept price': 'bestOfferAutoAcceptPrice',
  'minimum best offer price': 'minimumBestOfferPrice',
  'immediate pay required': 'immediatePayRequired',
  location: 'location',
  'shipping service 1 option': 'shippingService1Option',
  'shipping service 1 cost': 'shippingService1Cost',
  'shipping service 1 priority': 'shippingService1Priority',
  'shipping service 2 option': 'shippingService2Option',
  'shipping service 2 cost': 'shippingService2Cost',
  'shipping service 2 priority': 'shippingService2Priority',
  'max dispatch time': 'maxDispatchTime',
  'returns accepted option': 'returnsAcceptedOption',
  'returns within option': 'returnsWithinOption',
  'refund option': 'refundOption',
  'return shipping cost paid by': 'returnShippingCostPaidBy',
  'shipping profile name': 'shippingProfileName',
  'return profile name': 'returnProfileName',
  'payment profile name': 'paymentProfileName',
  productcompliancepolicyid: 'productCompliancePolicyId',
  'regional productcompliancepolicies': 'regionalProductCompliancePolicies',
  'c:brand': 'cBrand',
  'c:type': 'cType',
  'c:item height': 'cItemHeight',
  'c:item length': 'cItemLength',
  'c:item width': 'cItemWidth',
  'c:item diameter': 'cItemDiameter',
  'c:features': 'cFeatures',
  'c:manufacturer part number': 'cManufacturerPartNumber',
  'c:oe/oem part number': 'cOeOemPartNumber',
  'c:operating mode': 'cOperatingMode',
  'c:fuel type': 'cFuelType',
  'c:drive type': 'cDriveType',
  'product safety pictograms': 'productSafetyPictograms',
  'product safety statements': 'productSafetyStatements',
  'product safety component': 'productSafetyComponent',
  'regulatory document ids': 'regulatoryDocumentIds',
  'manufacturer name': 'manufacturerName',
  'manufacturer addressline1': 'manufacturerAddressLine1',
  'manufacturer addressline2': 'manufacturerAddressLine2',
  'manufacturer city': 'manufacturerCity',
  'manufacturer country': 'manufacturerCountry',
  'manufacturer postalcode': 'manufacturerPostalCode',
  'manufacturer stateorprovince': 'manufacturerStateOrProvince',
  'manufacturer phone': 'manufacturerPhone',
  'manufacturer email': 'manufacturerEmail',
  'manufacturer contacturl': 'manufacturerContactUrl',
  'responsible person 1': 'responsiblePerson1',
  'responsible person 1 type': 'responsiblePerson1Type',
  'responsible person 1 addressline1': 'responsiblePerson1AddressLine1',
  'responsible person 1 addressline2': 'responsiblePerson1AddressLine2',
  'responsible person 1 city': 'responsiblePerson1City',
  'responsible person 1 country': 'responsiblePerson1Country',
  'responsible person 1 postalcode': 'responsiblePerson1PostalCode',
  'responsible person 1 stateorprovince': 'responsiblePerson1StateOrProvince',
  'responsible person 1 phone': 'responsiblePerson1Phone',
  'responsible person 1 email': 'responsiblePerson1Email',
  'responsible person 1 contacturl': 'responsiblePerson1ContactUrl',
};

/** All entity columns that can be upserted (excludes PK + metadata) */
const UPSERT_COLUMNS: (keyof ListingRecord)[] = [
  'action',
  'customLabelSku',
  'categoryId',
  'categoryName',
  'title',
  'relationship',
  'relationshipDetails',
  'scheduleTime',
  'pUpc',
  'pEpid',
  'startPrice',
  'quantity',
  'itemPhotoUrl',
  'conditionId',
  'description',
  'format',
  'duration',
  'buyItNowPrice',
  'bestOfferEnabled',
  'bestOfferAutoAcceptPrice',
  'minimumBestOfferPrice',
  'immediatePayRequired',
  'location',
  'shippingService1Option',
  'shippingService1Cost',
  'shippingService1Priority',
  'shippingService2Option',
  'shippingService2Cost',
  'shippingService2Priority',
  'maxDispatchTime',
  'returnsAcceptedOption',
  'returnsWithinOption',
  'refundOption',
  'returnShippingCostPaidBy',
  'shippingProfileName',
  'returnProfileName',
  'paymentProfileName',
  'productCompliancePolicyId',
  'regionalProductCompliancePolicies',
  'cBrand',
  'cType',
  'cItemHeight',
  'cItemLength',
  'cItemWidth',
  'cItemDiameter',
  'cFeatures',
  'cManufacturerPartNumber',
  'cOeOemPartNumber',
  'cOperatingMode',
  'cFuelType',
  'cDriveType',
  'productSafetyPictograms',
  'productSafetyStatements',
  'productSafetyComponent',
  'regulatoryDocumentIds',
  'manufacturerName',
  'manufacturerAddressLine1',
  'manufacturerAddressLine2',
  'manufacturerCity',
  'manufacturerCountry',
  'manufacturerPostalCode',
  'manufacturerStateOrProvince',
  'manufacturerPhone',
  'manufacturerEmail',
  'manufacturerContactUrl',
  'responsiblePerson1',
  'responsiblePerson1Type',
  'responsiblePerson1AddressLine1',
  'responsiblePerson1AddressLine2',
  'responsiblePerson1City',
  'responsiblePerson1Country',
  'responsiblePerson1PostalCode',
  'responsiblePerson1StateOrProvince',
  'responsiblePerson1Phone',
  'responsiblePerson1Email',
  'responsiblePerson1ContactUrl',
  'sourceFilePath',
  'extractedMake',
  'extractedModel',
];

type ImportSummary = {
  scannedFiles: number;
  importedRows: number;
  skippedRows: number;
  uniqueSkus: number;
  filesWithHeader: number;
};

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ListingRevision)
    private readonly revisionRepo: Repository<ListingRevision>,
    @InjectRepository(CatalogProduct)
    private readonly catalogProductRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingActionLog)
    private readonly actionLogRepo: Repository<ListingActionLog>,
    private readonly dataSource: DataSource,
    private readonly rbac: RbacService,
    private readonly storeAccess: StoreAccessService,
    private readonly teamsService: TeamsService,
  ) {}

  /* ── Query methods ──────────────────────────────────────── */

  async findAll(query: ListingsQueryDto, user?: User) {
    const limit = Math.min(Number(query.limit ?? 60), 200);
    const offset = Number(query.offset ?? 0);

    const qb = this.listingRepo
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.customLabelSku',
        'r.title',
        'r.cBrand',
        'r.cType',
        'r.categoryId',
        'r.categoryName',
        'r.startPrice',
        'r.quantity',
        'r.conditionId',
        'r.itemPhotoUrl',
        'r.cManufacturerPartNumber',
        'r.cOeOemPartNumber',
        'r.location',
        'r.format',
        'r.sourceFileName',
        'r.importedAt',
        'r.description',
      ])
      .orderBy('r.importedAt', 'DESC')
      .addOrderBy('r.id', 'ASC')
      .offset(offset)
      .limit(limit);

    // ── Store-level access filter ──
    const storeFilter = await this.buildStoreFilter(user);
    if (storeFilter) {
      qb.andWhere(storeFilter.sql, storeFilter.params);
    }

    if (query.search?.trim()) {
      qb.andWhere(
        '(r.customLabelSku ILIKE :q OR r.title ILIKE :q OR r.cBrand ILIKE :q OR r.cManufacturerPartNumber ILIKE :q OR r.cOeOemPartNumber ILIKE :q)',
        { q: `%${query.search.trim()}%` },
      );
    }

    if (query.sku?.trim()) {
      qb.andWhere('r.customLabelSku ILIKE :sku', {
        sku: `%${query.sku.trim()}%`,
      });
    }

    if (query.categoryId?.trim()) {
      qb.andWhere('r.categoryId = :catId', { catId: query.categoryId.trim() });
    }

    if (query.categoryName?.trim()) {
      qb.andWhere('r.categoryName ILIKE :catName', {
        catName: `%${query.categoryName.trim()}%`,
      });
    }

    if (query.brand?.trim()) {
      qb.andWhere('r.cBrand ILIKE :brand', {
        brand: `%${query.brand.trim()}%`,
      });
    }

    if (query.cType?.trim()) {
      qb.andWhere('r.cType ILIKE :cType', {
        cType: `%${query.cType.trim()}%`,
      });
    }

    if (query.conditionId?.trim()) {
      qb.andWhere('r.conditionId = :cond', {
        cond: query.conditionId.trim(),
      });
    }

    if (query.sourceFile?.trim()) {
      qb.andWhere('r.sourceFileName = :srcFile', {
        srcFile: query.sourceFile.trim(),
      });
    }

    if (query.hasImage === '1') {
      qb.andWhere("r.itemPhotoUrl IS NOT NULL AND r.itemPhotoUrl != ''");
    }

    const [items, total] = await qb.getManyAndCount();
    return { total, limit, offset, items };
  }

  async findOne(id: string, user?: User) {
    const record = await this.listingRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    // ── Store access check ──
    const storeFilter = await this.buildStoreFilter(user);
    if (storeFilter && storeFilter.sql !== '1=0') {
      const hasAccess = await this.listingRepo
        .createQueryBuilder('r')
        .select('r.id')
        .where('r.id = :id', { id })
        .andWhere(storeFilter.sql, storeFilter.params)
        .getExists();
      if (!hasAccess) {
        throw new NotFoundException(`Listing ${id} not found`);
      }
    } else if (storeFilter && storeFilter.sql === '1=0') {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    let catalogProduct: CatalogProduct | null = null;
    if (record.customLabelSku) {
      catalogProduct = await this.catalogProductRepo.findOneBy({
        sku: record.customLabelSku,
      });
    }
    return { listing: record, catalogProduct };
  }

  /* ── CRUD operations (Module 1) ─────────────────────────── */

  async create(dto: CreateListingDto) {
    try {
      return await this.createInTransaction(dto);
    } catch (err) {
      if (this.isSkuUniqueViolation(err) && dto.customLabelSku?.trim()) {
        return this.createInTransaction(dto);
      }
      throw err;
    }
  }

  private isSkuUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }

  private async createInTransaction(dto: CreateListingDto) {
    return this.dataSource.transaction(async (em) => {
      const listing = em.create(ListingRecord, {
        ...dto,
        status: dto.status ?? 'draft',
        sourceFileName: 'manual',
        sourceFilePath: 'manual',
        origin: ListingOrigin.ADD_PART,
        sheetName: 'manual',
        sourceRowNumber: 0,
      } as Partial<ListingRecord>);

      const sku = dto.customLabelSku?.trim();
      let existing: ListingRecord | null = null;

      if (sku) {
        existing = await em
          .createQueryBuilder(ListingRecord, 'l')
          .setLock('pessimistic_write')
          .where('l.customLabelSku = :sku', { sku })
          .andWhere('l.deletedAt IS NULL')
          .getOne();
      }

      if (existing) {
        const oldStatus = existing.status;
        const changes: Partial<CreateListingDto> = { ...dto };
        delete changes.status;
        Object.assign(existing, changes);
        if (dto.status) {
          existing.status = dto.status;
        }

        const savedExisting = await em.save(ListingRecord, existing);

        const revision = em.create(ListingRevision, {
          listingId: savedExisting.id,
          version: savedExisting.version,
          statusBefore: oldStatus,
          statusAfter: savedExisting.status ?? oldStatus ?? 'draft',
          snapshot: { ...savedExisting } as unknown as Record<string, unknown>,
          changeReason: 'update_via_create',
          changedBy: null,
        });
        await em.save(ListingRevision, revision);

        return { listing: savedExisting, revision, updated: true };
      }

      const maxRow = await em
        .createQueryBuilder(ListingRecord, 'r')
        .select('MAX(r.sourceRowNumber)', 'max')
        .where('r.sourceFileName = :src', { src: 'manual' })
        .withDeleted()
        .getRawOne<{ max: string | null }>();
      const nextRow = (Number(maxRow?.max) || 0) + 1;

      listing.sourceRowNumber = nextRow;
      const saved = await em.save(ListingRecord, listing);

      const revision = em.create(ListingRevision, {
        listingId: saved.id,
        version: saved.version,
        statusBefore: null,
        statusAfter: saved.status ?? 'draft',
        snapshot: { ...saved } as unknown as Record<string, unknown>,
        changeReason: 'create',
        changedBy: null,
      });
      await em.save(ListingRevision, revision);

      return { listing: saved, revision };
    });
  }

  async update(id: string, dto: UpdateListingDto, user?: User) {
    return this.dataSource.transaction(async (em) => {
      const listing = await em.findOne(ListingRecord, { where: { id } });
      if (!listing) throw new NotFoundException(`Listing ${id} not found`);

      if (listing.version !== dto.version) {
        throw new ConflictException({
          message: 'This listing was modified since you loaded it.',
          currentVersion: listing.version,
          yourVersion: dto.version,
        });
      }

      // ── Role-based checks (skip for system-internal calls) ──
      if (user) {
        const userPerms = await this.rbac.getPermissionKeysForUser(user.id);
        const canRevise = userPerms.has('listings.revise');
        const canPriceOverride = userPerms.has('listings.price_override');

        if (listing.status === 'published' && !canRevise) {
          throw new ForbiddenException(
            'You do not have permission to revise published listings.',
          );
        }

        // Price change on a published listing requires price_override
        const priceFields = [
          'startPrice',
          'buyItNowPrice',
          'bestOfferAutoAcceptPrice',
          'minimumBestOfferPrice',
        ] as const;
        const hasPriceChange = priceFields.some(
          (f) => (dto as unknown as Record<string, unknown>)[f] !== undefined,
        );
        if (
          listing.status === 'published' &&
          hasPriceChange &&
          !canPriceOverride
        ) {
          throw new ForbiddenException(
            'Changing price on a live listing requires manager approval.',
          );
        }
      }

      const oldStatus = listing.status;
      const beforeSnapshot = { ...listing } as Record<string, unknown>;
      const oldSku = listing.customLabelSku?.trim() || null;
      const { version: _v, ...rawChanges } = dto;
      // Strip undefined values so optional DTO fields don't overwrite
      // existing entity values (e.g. status becoming undefined).
      const changes: Record<string, unknown> = Object.fromEntries(
        Object.entries(rawChanges).filter(([, v]) => v !== undefined),
      );
      if (
        changes.customLabelSku !== undefined &&
        typeof changes.customLabelSku === 'string'
      ) {
        const trimmed = changes.customLabelSku.trim();
        changes.customLabelSku = trimmed.length > 0 ? trimmed : null;
      }

      await this.assertSkuRenameAllowed(em, listing.id, oldSku, changes);

      Object.assign(listing, changes);
      // Keep numeric mirrors in lockstep in-memory (DB trigger also syncs on
      // write). Needed so revision snapshots and same-request reads are correct.
      this.applyDerivedNumericFields(listing, changes);
      if (user) listing.updatedBy = user.id;

      const saved = await em.save(ListingRecord, listing);

      // SKU rename must keep catalog_products + marketplace siblings aligned.
      await this.syncSkuRenameToCatalogAndSiblings(em, saved, oldSku, changes);

      // Catalog detail edits one listing row; workbench/publish often read
      // catalog_products.price or US/AU/DE siblings. Propagate shared price/qty.
      await this.syncSharedPriceQuantityToCatalogAndSiblings(em, saved, changes);

      const afterSnapshot = { ...saved } as Record<string, unknown>;

      const existingRevision = await em.findOne(ListingRevision, {
        where: { listingId: id, version: saved.version },
      });
      let revision = existingRevision;
      if (!revision) {
        revision = em.create(ListingRevision, {
          listingId: id,
          version: saved.version,
          statusBefore: oldStatus,
          statusAfter: saved.status ?? oldStatus ?? 'draft',
          snapshot: afterSnapshot,
          changeReason: 'manual_edit',
          changedBy: user?.id ?? null,
        });
        await em.save(ListingRevision, revision);
      }

      // ── Audit log entry (user-initiated only, requires org) ──
      if (user && saved.organizationId) {
        const diff = this.computeDiff(beforeSnapshot, afterSnapshot);
        if (Object.keys(diff).length > 0) {
          const actionLog = this.actionLogRepo.create({
            organizationId: saved.organizationId,
            userId: user.id,
            action: 'listing.updated',
            beforeSnapshot: beforeSnapshot,
            afterSnapshot: afterSnapshot,
            result: 'success',
          });
          await this.actionLogRepo.save(actionLog);
        }
      }

      return { listing: saved, revision };
    });
  }

  async patchStatus(id: string, dto: PatchStatusDto, user?: User) {
    return this.dataSource.transaction(async (em) => {
      const listing = await em.findOne(ListingRecord, { where: { id } });
      if (!listing) throw new NotFoundException(`Listing ${id} not found`);

      if (listing.version !== dto.version) {
        throw new ConflictException({
          message: 'This listing was modified since you loaded it.',
          currentVersion: listing.version,
          yourVersion: dto.version,
        });
      }

      // ── Approve check: draft/ready → published requires listings.approve ──
      if (
        user &&
        dto.status === 'published' &&
        listing.status !== 'published'
      ) {
        const canApprove = await this.rbac.userHasPermission(
          user.id,
          'listings.approve',
        );
        if (!canApprove) {
          throw new ForbiddenException(
            'You do not have permission to approve listings for publication.',
          );
        }
      }

      const oldStatus = listing.status;
      const beforeSnapshot = { ...listing } as Record<string, unknown>;
      listing.status = dto.status;
      if (user) listing.updatedBy = user.id;
      if (dto.status === 'published' && !listing.publishedAt) {
        listing.publishedAt = new Date();
      }

      const saved = await em.save(ListingRecord, listing);
      const afterSnapshot = { ...saved } as Record<string, unknown>;

      const revision = em.create(ListingRevision, {
        listingId: id,
        version: saved.version,
        statusBefore: oldStatus,
        statusAfter: dto.status ?? oldStatus ?? 'draft',
        snapshot: afterSnapshot,
        changeReason: dto.reason ?? 'status_change',
        changedBy: user?.id ?? null,
      });
      await em.save(ListingRevision, revision);

      // ── Audit log entry (user-initiated only, requires org) ──
      if (user && saved.organizationId) {
        const actionLog = this.actionLogRepo.create({
          organizationId: saved.organizationId,
          userId: user.id,
          action: `listing.status_changed:${oldStatus}→${dto.status}`,
          beforeSnapshot: beforeSnapshot,
          afterSnapshot: afterSnapshot,
          result: 'success',
        });
        await this.actionLogRepo.save(actionLog);
      }

      return { listing: saved, revision };
    });
  }

  async softDelete(id: string) {
    // Soft-delete hides this listing instance. Same-SKU donor re-import may
    // create a NEW active row; this row stays deleted unless restore() is used.
    const listing = await this.listingRepo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    await this.listingRepo.softRemove(listing);
    return { success: true };
  }

  async restore(id: string) {
    const listing = await this.listingRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    await this.listingRepo.recover(listing);
    return { listing };
  }

  async bulkUpdate(dto: BulkUpdateDto) {
    const updated: string[] = [];
    const failed: { id: string; error: string; conflict?: boolean }[] = [];

    for (const id of dto.ids) {
      try {
        await this.dataSource.transaction(async (em) => {
          const listing = await em.findOne(ListingRecord, { where: { id } });
          if (!listing) {
            throw new NotFoundException(`Listing ${id} not found`);
          }

          const expectedVersion = dto.versions?.[id];
          if (
            expectedVersion !== undefined &&
            listing.version !== expectedVersion
          ) {
            throw new ConflictException({
              message: 'This listing was modified since you loaded it.',
              currentVersion: listing.version,
              yourVersion: expectedVersion,
            });
          }

          Object.assign(listing, dto.changes);
          await em.save(ListingRecord, listing);
        });
        updated.push(id);
      } catch (err) {
        const conflict = err instanceof ConflictException;
        failed.push({
          id,
          error: err instanceof Error ? err.message : 'Unknown error',
          ...(conflict ? { conflict: true } : {}),
        });
      }
    }

    return { updated: updated.length, failed };
  }

  async bulkApplyProfiles(
    dto: BulkProfilesDto,
    user: User,
  ): Promise<{ updated: number }> {
    const { shippingProfile, returnProfile, paymentProfile } = dto;
    if (!shippingProfile && !returnProfile && !paymentProfile) {
      throw new BadRequestException('At least one profile must be provided');
    }

    const listings = await this.listingRepo.findBy({ id: In(dto.ids) });
    if (!listings.length) {
      throw new NotFoundException('No listings found for given IDs');
    }

    const manageAll = await this.rbac.userHasPermission(
      user.id,
      'teams.manage',
    );
    await this.teamsService.assertListingsTeamScope(
      listings.map((l) => ({ id: l.id, teamId: l.teamId })),
      user.id,
      manageAll,
      dto.teamIds,
    );

    for (const listing of listings) {
      if (shippingProfile) listing.shippingProfileName = shippingProfile;
      if (returnProfile) listing.returnProfileName = returnProfile;
      if (paymentProfile) listing.paymentProfileName = paymentProfile;
    }
    await this.listingRepo.save(listings);

    const skus = [
      ...new Set(
        listings
          .map((l) => l.customLabelSku)
          .filter((s): s is string => s != null && s !== ''),
      ),
    ];
    if (skus.length) {
      const products = await this.catalogProductRepo.findBy({ sku: In(skus) });
      for (const product of products) {
        if (shippingProfile) product.shippingProfile = shippingProfile;
        if (returnProfile) product.returnProfile = returnProfile;
        if (paymentProfile) product.paymentProfile = paymentProfile;
      }
      if (products.length) {
        await this.catalogProductRepo.save(products);
      }
    }

    return { updated: listings.length };
  }

  async bulkSoftDelete(ids: string[]) {
    const listings = await this.listingRepo.findBy({ id: In(ids) });
    if (!listings.length)
      throw new NotFoundException('No listings found for given IDs');
    await this.listingRepo.softRemove(listings);
    return { deleted: listings.length };
  }

  async exportCsv(query: SearchQueryDto, user?: User): Promise<string> {
    const qb = this.listingRepo
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.customLabelSku',
        'r.title',
        'r.cBrand',
        'r.cType',
        'r.categoryId',
        'r.categoryName',
        'r.startPrice',
        'r.quantity',
        'r.conditionId',
        'r.cManufacturerPartNumber',
        'r.cOeOemPartNumber',
        'r.location',
        'r.format',
        'r.description',
        'r.itemPhotoUrl',
        'r.sourceFileName',
        'r.importedAt',
      ])
      .orderBy('r.importedAt', 'DESC')
      .limit(10000);

    const storeFilter = await this.buildStoreFilter(user);
    if (storeFilter) qb.andWhere(storeFilter.sql, storeFilter.params);

    if (query.q?.trim()) {
      qb.andWhere(
        '(r.customLabelSku ILIKE :q OR r.title ILIKE :q OR r.cBrand ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }
    if (query.brands?.trim()) {
      const brandList = query.brands
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
      qb.andWhere('r.cBrand IN (:...brands)', { brands: brandList });
    }
    if (query.categories?.trim()) {
      const catList = query.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      qb.andWhere('r.categoryId IN (:...cats)', { cats: catList });
    }
    if (query.conditions?.trim()) {
      const condList = query.conditions
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      qb.andWhere('r.conditionId IN (:...conds)', { conds: condList });
    }
    if (query.minPrice != null) {
      qb.andWhere('CAST(r.startPrice AS numeric) >= :minPrice', {
        minPrice: query.minPrice,
      });
    }
    if (query.maxPrice != null) {
      qb.andWhere('CAST(r.startPrice AS numeric) <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }

    const items = await qb.getMany();

    const headers = [
      'SKU',
      'Title',
      'Brand',
      'Type',
      'Category',
      'Price',
      'Qty',
      'Condition',
      'MPN',
      'OEM Part',
      'Location',
      'Format',
    ];
    const escape = (v: string | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n'))
        return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = items.map((r) =>
      [
        escape(r.customLabelSku),
        escape(r.title),
        escape(r.cBrand),
        escape(r.cType),
        escape(r.categoryName),
        escape(r.startPrice),
        escape(r.quantity),
        escape(r.conditionId),
        escape(r.cManufacturerPartNumber),
        escape(r.cOeOemPartNumber),
        escape(r.location),
        escape(r.format),
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  async getRevisions(listingId: string, limit: number, offset: number) {
    const [revisions, total] = await this.revisionRepo.findAndCount({
      where: { listingId },
      order: { version: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { total, revisions };
  }

  async getSummary(user?: User) {
    const storeFilter = await this.buildStoreFilter(user);

    if (storeFilter && storeFilter.sql === '1=0') {
      return { totalRecords: 0, uniqueSkus: 0, files: 0 };
    }

    // totalRecords
    const qb = this.listingRepo.createQueryBuilder('r');
    if (storeFilter) qb.andWhere(storeFilter.sql, storeFilter.params);
    const totalRecords = await qb.getCount();

    // uniqueSkus
    const skuQb = this.listingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.customLabelSku)', 'uniqueSkus');
    if (storeFilter) skuQb.where(storeFilter.sql, storeFilter.params);
    const uniqueRow = await skuQb.getRawOne<{ uniqueSkus: string }>();

    // files
    const fileQb = this.listingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.sourceFileName)', 'files');
    if (storeFilter) fileQb.where(storeFilter.sql, storeFilter.params);
    const fileRow = await fileQb.getRawOne<{ files: string }>();

    return {
      totalRecords,
      uniqueSkus: Number(uniqueRow?.uniqueSkus ?? 0),
      files: Number(fileRow?.files ?? 0),
    };
  }

  /** Returns distinct values for filter dropdowns. */
  async getFacets(user?: User) {
    const storeFilter = await this.buildStoreFilter(user);

    const brandsQb = this.listingRepo
      .createQueryBuilder('r')
      .select('r.cBrand', 'value')
      .addSelect('COUNT(*)', 'count')
      .where("r.cBrand IS NOT NULL AND r.cBrand != ''")
      .groupBy('r.cBrand');
    if (storeFilter) brandsQb.andWhere(storeFilter.sql, storeFilter.params);
    brandsQb.orderBy('count', 'DESC').limit(100);
    const brandsRaw = await brandsQb.getRawMany<{
      value: string;
      count: string;
    }>();

    const categoriesQb = this.listingRepo
      .createQueryBuilder('r')
      .select('r.categoryName', 'value')
      .addSelect('r.categoryId', 'id')
      .addSelect('COUNT(*)', 'count')
      .where("r.categoryName IS NOT NULL AND r.categoryName != ''")
      .groupBy('r.categoryName')
      .addGroupBy('r.categoryId');
    if (storeFilter) categoriesQb.andWhere(storeFilter.sql, storeFilter.params);
    categoriesQb.orderBy('count', 'DESC').limit(100);
    const categoriesRaw = await categoriesQb.getRawMany<{
      value: string;
      id: string;
      count: string;
    }>();

    const conditionsQb = this.listingRepo
      .createQueryBuilder('r')
      .select('r.conditionId', 'value')
      .addSelect('COUNT(*)', 'count')
      .where("r.conditionId IS NOT NULL AND r.conditionId != ''")
      .groupBy('r.conditionId');
    if (storeFilter) conditionsQb.andWhere(storeFilter.sql, storeFilter.params);
    conditionsQb.orderBy('count', 'DESC');
    const conditionsRaw = await conditionsQb.getRawMany<{
      value: string;
      count: string;
    }>();

    const sourceFilesQb = this.listingRepo
      .createQueryBuilder('r')
      .select('r.sourceFileName', 'value')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.sourceFileName');
    if (storeFilter)
      sourceFilesQb.andWhere(storeFilter.sql, storeFilter.params);
    sourceFilesQb.orderBy('count', 'DESC');
    const sourceFilesRaw = await sourceFilesQb.getRawMany<{
      value: string;
      count: string;
    }>();

    return {
      brands: brandsRaw.map((r) => ({
        value: r.value,
        count: Number(r.count),
      })),
      categories: categoriesRaw.map((r) => ({
        value: r.value,
        id: r.id,
        count: Number(r.count),
      })),
      conditions: conditionsRaw.map((r) => ({
        value: r.value,
        count: Number(r.count),
      })),
      sourceFiles: sourceFilesRaw.map((r) => ({
        value: r.value,
        count: Number(r.count),
      })),
    };
  }

  /* ── Import pipeline ────────────────────────────────────── */

  async importFromFolder(folderPath: string): Promise<ImportSummary> {
    const absoluteFolder = path.resolve(folderPath);
    const files = fs
      .readdirSync(absoluteFolder)
      .filter(
        (name) =>
          name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$'),
      )
      .map((name) => path.join(absoluteFolder, name))
      .sort();

    let importedRows = 0;
    let skippedRows = 0;
    let filesWithHeader = 0;

    for (const filePath of files) {
      const sourceFileName = path.basename(filePath);
      this.logger.log(`Reading ${sourceFileName} …`);

      const workbook = XLSX.readFile(filePath, { cellDates: false });
      const sheetName = 'Listings';
      const ws = workbook.Sheets[sheetName];

      if (!ws) {
        this.logger.warn(`  ⚠ No "Listings" sheet – skipping`);
        continue;
      }

      const allRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
        header: 1,
        raw: false,
        defval: null,
      });

      const headerRowIndex = this.findHeaderRow(allRows);
      if (headerRowIndex === null) {
        this.logger.warn(`  ⚠ Header row not found – skipping`);
        continue;
      }

      filesWithHeader += 1;
      const headerRow = allRows[headerRowIndex] ?? [];

      // Build column-index → entity-property mapping for this file
      const colMap = this.buildColumnMap(headerRow);

      // Batch inserts in chunks of 500
      const BATCH_SIZE = 500;
      const batch: Partial<ListingRecord>[] = [];

      for (
        let rowIdx = headerRowIndex + 1;
        rowIdx < allRows.length;
        rowIdx += 1
      ) {
        const row = allRows[rowIdx] ?? [];

        // Build entity values from column map
        const record: Partial<ListingRecord> = {
          sourceFileName,
          sourceFilePath: filePath,
          sheetName,
          sourceRowNumber: rowIdx + 1, // 1-based
        };

        let hasAnyData = false;

        for (const [colIdx, propName] of colMap.entries()) {
          const raw = row[colIdx];
          const val = this.cleanValue(raw);
          (record as Record<string, unknown>)[propName] = val;
          if (val !== null) {
            hasAnyData = true;
          }
        }

        const mm = extractMakeModelFromTitle(record.title ?? null);
        record.extractedMake = mm.make;
        record.extractedModel = mm.model;

        if (!hasAnyData) {
          skippedRows += 1;
          continue;
        }

        batch.push(record);

        if (batch.length >= BATCH_SIZE) {
          await this.upsertBatch(batch);
          importedRows += batch.length;
          batch.length = 0;
        }
      }

      // Flush remaining
      if (batch.length > 0) {
        await this.upsertBatch(batch);
        importedRows += batch.length;
        batch.length = 0;
      }

      this.logger.log(`  ✔ ${sourceFileName} done`);
    }

    const uniqueRow = await this.listingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.customLabelSku)', 'uniqueSkus')
      .getRawOne<{ uniqueSkus: string }>();

    this.logger.log(
      `Import complete: ${importedRows} rows from ${filesWithHeader} files`,
    );

    return {
      scannedFiles: files.length,
      importedRows,
      skippedRows,
      filesWithHeader,
      uniqueSkus: Number(uniqueRow?.uniqueSkus ?? 0),
    };
  }

  /* ── Private helpers ────────────────────────────────────── */

  /** Store filter: returns { sql, params } or null if no filtering needed */
  private async buildStoreFilter(
    user?: User,
  ): Promise<{ sql: string; params: Record<string, string[]> } | null> {
    const storeIds = await this.storeAccess.resolveStoreFilter(user);
    if (storeIds === undefined) return null; // accessAll or no user
    if (storeIds.length === 0) {
      return { sql: StoreAccessService.UNSCOPED_LISTINGS_SQL, params: {} };
    }
    return {
      sql: StoreAccessService.SCOPED_LISTINGS_SQL,
      params: { storeIds },
    };
  }

  /** Upsert a batch of partial records using ON CONFLICT */
  private async upsertBatch(batch: Partial<ListingRecord>[]) {
    await this.listingRepo
      .createQueryBuilder()
      .insert()
      .into(ListingRecord)
      .values(batch as object[])
      .orUpdate(UPSERT_COLUMNS as string[], [
        'sourceFileName',
        'sheetName',
        'sourceRowNumber',
      ])
      .execute();
  }

  /**
   * Find the header row index by locating the cell
   * containing "Custom label (SKU)".
   */
  private findHeaderRow(rows: (string | number | null)[][]): number | null {
    for (let r = 0; r < Math.min(rows.length, 20); r += 1) {
      const row = rows[r] ?? [];
      for (let c = 0; c < row.length; c += 1) {
        const norm = this.normalize(row[c]);
        if (norm === 'customlabelsku') {
          return r;
        }
      }
    }
    return null;
  }

  /**
   * Map column indices → entity property names based on header text.
   * The first column (Action) is matched by prefix since the
   * parenthetical parameters vary between files.
   */
  private buildColumnMap(
    headerRow: (string | number | null)[],
  ): Map<number, keyof ListingRecord> {
    const map = new Map<number, keyof ListingRecord>();

    for (let c = 0; c < headerRow.length; c += 1) {
      const raw = String(headerRow[c] ?? '').trim();
      if (!raw) continue;

      // Check for Action column (starts with *Action or Action)
      const stripped = raw.startsWith('*') ? raw.slice(1) : raw;
      if (/^action\s*\(/i.test(stripped)) {
        map.set(c, 'action');
        continue;
      }

      const key = raw.toLowerCase();
      const prop = HEADER_TO_PROPERTY[key];
      if (prop) {
        map.set(c, prop);
      }
    }

    return map;
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private cleanValue(value: unknown): string | null {
    const str = String(value ?? '').trim();
    if (!str || /^nan$/i.test(str) || /^none$/i.test(str)) {
      return null;
    }
    return str;
  }

  private parseMoney(raw: string | null | undefined): number | null {
    if (raw == null || String(raw).trim() === '') return null;
    const cleaned = String(raw)
      .replace(/,/g, '.')
      .replace(/[^0-9.]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  private parseQty(raw: string | null | undefined): number | null {
    if (raw == null || String(raw).trim() === '') return null;
    const n = Number(String(raw).replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Mirror text price/qty columns onto their numeric counterparts so
   * revision snapshots and in-request reads stay consistent with the
   * BEFORE UPDATE DB trigger (trg_sync_listing_prices).
   */
  private applyDerivedNumericFields(
    listing: ListingRecord,
    changes: Record<string, unknown>,
  ): void {
    if (changes.startPrice !== undefined) {
      listing.startPriceNum = this.parseMoney(listing.startPrice);
    }
    if (changes.quantity !== undefined) {
      listing.quantityNum = this.parseQty(listing.quantity);
    }
    if (changes.buyItNowPrice !== undefined) {
      listing.buyItNowPriceNum = this.parseMoney(listing.buyItNowPrice);
    }
    if (changes.bestOfferAutoAcceptPrice !== undefined) {
      listing.bestOfferAutoAcceptPriceNum = this.parseMoney(
        listing.bestOfferAutoAcceptPrice,
      );
    }
    if (changes.minimumBestOfferPrice !== undefined) {
      listing.minimumBestOfferPriceNum = this.parseMoney(
        listing.minimumBestOfferPrice,
      );
    }
    if (changes.shippingService1Cost !== undefined) {
      listing.shippingService1CostNum = this.parseMoney(
        listing.shippingService1Cost,
      );
    }
    if (changes.shippingService2Cost !== undefined) {
      listing.shippingService2CostNum = this.parseMoney(
        listing.shippingService2Cost,
      );
    }
  }

  /**
   * Reject SKU renames that would collide with an existing catalog product or
   * another active listing outside this row.
   */
  private async assertSkuRenameAllowed(
    em: DataSource['manager'],
    listingId: string,
    oldSku: string | null,
    changes: Record<string, unknown>,
  ): Promise<void> {
    if (changes.customLabelSku === undefined) return;
    const newSku =
      typeof changes.customLabelSku === 'string'
        ? changes.customLabelSku.trim() || null
        : (changes.customLabelSku as string | null);
    if (!newSku || newSku === oldSku) return;

    const conflictingProduct = await em.findOne(CatalogProduct, {
      where: { sku: newSku },
    });
    if (conflictingProduct) {
      throw new ConflictException(
        `SKU "${newSku}" is already used by another catalog product.`,
      );
    }

    const conflictingListing = await em
      .createQueryBuilder(ListingRecord, 'l')
      .where('l.customLabelSku = :sku', { sku: newSku })
      .andWhere('l.deletedAt IS NULL')
      .andWhere('l.id != :id', { id: listingId })
      .getOne();
    if (conflictingListing) {
      throw new ConflictException(
        `SKU "${newSku}" is already used by another listing.`,
      );
    }
  }

  /**
   * Renaming customLabelSku on one listing must also rename the linked
   * catalog_products.sku and every sibling listing_records row that shared
   * the previous SKU (US/AU/DE). Otherwise catalog join-by-SKU breaks.
   */
  private async syncSkuRenameToCatalogAndSiblings(
    em: {
      update: (
        entity: typeof ListingRecord | typeof CatalogProduct,
        criteria: Record<string, unknown>,
        partial: Record<string, unknown>,
      ) => Promise<unknown>;
    },
    saved: ListingRecord,
    oldSku: string | null,
    changes: Record<string, unknown>,
  ): Promise<void> {
    if (changes.customLabelSku === undefined) return;

    const newSku = saved.customLabelSku?.trim() || null;
    if (!oldSku || oldSku === newSku) return;

    if (newSku) {
      await em.update(CatalogProduct, { sku: oldSku }, { sku: newSku });
    }
    // Current row already has newSku; siblings still on oldSku.
    await em.update(
      ListingRecord,
      { customLabelSku: oldSku },
      { customLabelSku: newSku },
    );
  }

  /**
   * Catalog inventory edits one listing_records row, but workbench / publish
   * and marketplace siblings (US/AU/DE) often read catalog_products.price or
   * another sibling. Keep shared price/qty aligned across the SKU.
   */
  private async syncSharedPriceQuantityToCatalogAndSiblings(
    em: {
      update: (
        entity: typeof ListingRecord | typeof CatalogProduct,
        criteria: Record<string, unknown>,
        partial: Record<string, unknown>,
      ) => Promise<unknown>;
    },
    saved: ListingRecord,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const sku = saved.customLabelSku;
    if (!sku) return;

    const priceChanged = changes.startPrice !== undefined;
    const qtyChanged = changes.quantity !== undefined;
    if (!priceChanged && !qtyChanged) return;

    if (priceChanged) {
      await em.update(
        CatalogProduct,
        { sku },
        { price: saved.startPriceNum },
      );
      await em.update(
        ListingRecord,
        { customLabelSku: sku },
        {
          startPrice: saved.startPrice,
          startPriceNum: saved.startPriceNum,
        },
      );
    }

    if (qtyChanged) {
      await em.update(
        CatalogProduct,
        { sku },
        { quantity: saved.quantityNum },
      );
      await em.update(
        ListingRecord,
        { customLabelSku: sku },
        {
          quantity: saved.quantity,
          quantityNum: saved.quantityNum,
        },
      );
    }
  }

  /** Compute field-level diff between two snapshots for audit logging */
  private computeDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const tracked = new Set([
      'title',
      'startPrice',
      'quantity',
      'description',
      'conditionId',
      'buyItNowPrice',
      'bestOfferEnabled',
      'bestOfferAutoAcceptPrice',
      'minimumBestOfferPrice',
      'format',
      'duration',
      'location',
      'shippingService1Option',
      'shippingService1Cost',
      'shippingService2Option',
      'shippingService2Cost',
      'maxDispatchTime',
      'returnsAcceptedOption',
      'returnsWithinOption',
      'refundOption',
      'returnShippingCostPaidBy',
      'shippingProfileName',
      'returnProfileName',
      'paymentProfileName',
      'cBrand',
      'cType',
      'customLabelSku',
      'categoryId',
      'categoryName',
      'itemPhotoUrl',
      'startPriceNum',
      'quantityNum',
      'buyItNowPriceNum',
      'bestOfferAutoAcceptPriceNum',
      'minimumBestOfferPriceNum',
      'shippingService1CostNum',
      'shippingService2CostNum',
    ]);
    for (const key of tracked) {
      const fromVal = before[key];
      const toVal = after[key];
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        diff[key] = { from: fromVal, to: toVal };
      }
    }
    return diff;
  }
}
