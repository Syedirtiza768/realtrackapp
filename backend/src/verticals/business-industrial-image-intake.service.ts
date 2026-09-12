import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import * as XLSX from 'xlsx';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import {
  ListingOrigin,
  ListingRecord,
} from '../listings/listing-record.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { ImageProcessorService } from '../storage/image-processor.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { AiRunLogService } from '../common/openai/ai-run-log.service.js';
import { ModelRouter } from '../common/openai/model-router.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { BusinessIndustrialService } from './business-industrial.service.js';
import {
  BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES,
  validateBusinessIndustrialAttributes,
} from './business-industrial.config.js';
import type { CreateBusinessIndustrialDraftDto } from './business-industrial.dto.js';
import type {
  ApplyBusinessIndustrialImageIntakeGroupDto,
  CreateBusinessIndustrialDriveIntakeJobDto,
  CreateBusinessIndustrialImageIntakeJobDto,
} from './business-industrial-image-intake.dto.js';
import { BusinessIndustrialImageIntakeAsset } from './entities/business-industrial-image-intake-asset.entity.js';
import { BusinessIndustrialImageIntakeGroup } from './entities/business-industrial-image-intake-group.entity.js';
import { BusinessIndustrialImageIntakeJob } from './entities/business-industrial-image-intake-job.entity.js';
import {
  isSupportedBusinessIndustrialImage,
  normalizeImageIntakePartName,
  parseInstanceFolderName,
  partFolderFromRelativePath,
  safeIntakePath,
} from './business-industrial-image-intake.util.js';

const MAX_BATCH_FILES = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_JOB_IMAGES = 5000;
const MAX_VISION_IMAGES = 12;
const MAX_DRIVE_ITEMS = 200;
const MAX_DRIVE_IMAGES = MAX_DRIVE_ITEMS * MAX_VISION_IMAGES;
const PROMPT_VERSION = 'business-industrial-image-intake-v1';
const ENRICHMENT_PROMPT_VERSION = 'bi-listing-enrichment-v1';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_API_ROOT = 'https://www.googleapis.com/drive/v3/files';
type JsonRecord = Record<string, unknown>;
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webContentLink?: string;
};
type DriveImage = DriveFile & { relativePath: string };
const CATEGORY_FAMILY_IDS = new Set<string>(
  BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.map((family) => family.id),
);

const ENRICHMENT_SYSTEM_PROMPT = `You prepare a truthful, eBay-ready Business & Industrial listing from an evidence-backed identification.
Return JSON only:
{"optimizedTitle":string,"optimizedDescription":string,"keywords":string[],"itemSpecifics":object,"seoScore":number,"readinessScore":number,"warnings":string[]}
The title must be concise, searchable, and no more than 80 characters. Use only the supplied evidence. Do not invent compatibility, certifications, ratings, dimensions, condition, warranty, testing results, or included accessories. Keep uncertain facts out of the title and itemSpecifics. The description must clearly separate observed facts, condition, included items, missing items, and testing status. Scores are 0-100 and must reflect missing evidence; a high score never overrides compliance review.`;

const VISION_SYSTEM_PROMPT = `You identify photographed Business & Industrial inventory for an e-commerce listing draft. This is not automotive fitment classification.

Return JSON only with this shape:
{"title":string|null,"brand":string|null,"model":string|null,"mpn":string|null,"oemPartNumber":string|null,"partType":string|null,"categoryFamily":string|null,"categorySearchQuery":string|null,"conditionLabel":"NEW"|"USED"|"REFURBISHED"|"FOR_PARTS"|"UNKNOWN","description":string|null,"visibleText":string[],"features":string[],"warnings":string[],"includedComponents":string[],"missingParts":string[],"testing":string|null,"verticalAttributes":object,"confidence":{"overall":number,"brand":number,"mpn":number,"category":number,"condition":number,"technical":number},"priceEstimate":number|null}

Use only evidence visible in the images and the supplied folder name. Never invent an exact part number, model, compatibility claim, certification, technical specification, condition, or price. Put uncertain or unreadable values in warnings and use null/UNKNOWN. Choose categoryFamily only from these deliberate families: industrial_automation, electrical_equipment, machinery_tooling, hydraulics_pneumatics, test_measurement, material_handling, commercial_equipment, construction_safety, medical_laboratory, hazmat_chemical. Restricted families still require manual compliance review. Keep verticalAttributes flat and use explicit units for numeric fields when visible.`;

@Injectable()
export class BusinessIndustrialImageIntakeService {
  private readonly logger = new Logger(
    BusinessIndustrialImageIntakeService.name,
  );
  constructor(
    private readonly config: ConfigService,
    private readonly userOrgs: UserOrganizationService,
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly openai: OpenAiService,
    private readonly aiRunLogs: AiRunLogService,
    private readonly modelRouter: ModelRouter,
    private readonly taxonomy: EbayTaxonomyApiService,
    private readonly businessIndustrial: BusinessIndustrialService,
    @InjectQueue('business-industrial-image-intake')
    private readonly intakeQueue: Queue,
    @InjectRepository(BusinessIndustrialImageIntakeJob)
    private readonly jobRepo: Repository<BusinessIndustrialImageIntakeJob>,
    @InjectRepository(BusinessIndustrialImageIntakeGroup)
    private readonly groupRepo: Repository<BusinessIndustrialImageIntakeGroup>,
    @InjectRepository(BusinessIndustrialImageIntakeAsset)
    private readonly assetRepo: Repository<BusinessIndustrialImageIntakeAsset>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {}

  async createJob(
    user: User,
    dto: CreateBusinessIndustrialImageIntakeJobDto,
    organizationId?: string,
  ) {
    await this.businessIndustrial.assertEnabled();
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        organizationId: org.organizationId,
        createdByUserId: user.id,
        sourceRootName: dto.sourceRootName.trim(),
        sourceReferenceUrl: dto.sourceReferenceUrl?.trim() || null,
        status: 'pending',
        totalFolders: 0,
        totalImages: 0,
        processedFolders: 0,
        processedImages: 0,
        groupedParts: 0,
        failedFolders: 0,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }),
    );
    return this.jobSummary(job);
  }

  async createDriveJob(
    user: User,
    dto: CreateBusinessIndustrialDriveIntakeJobDto,
    organizationId?: string,
  ) {
    await this.businessIndustrial.assertEnabled();
    const folderId = this.parseDriveFolderId(dto.folderUrl);
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        organizationId: org.organizationId,
        createdByUserId: user.id,
        sourceRootName: 'Google Drive import ' + folderId,
        sourceReferenceUrl: dto.folderUrl.trim(),
        status: 'processing',
        totalFolders: 0,
        totalImages: 0,
        processedFolders: 0,
        processedImages: 0,
        groupedParts: 0,
        failedFolders: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      }),
    );
    try {
      await this.intakeQueue.add(
        'import-drive',
        {
          jobId: job.id,
          maxItems: dto.maxItems ?? 200,
          autoCreateDrafts: dto.autoCreateDrafts ?? true,
          skipFolderNames: dto.skipFolderNames ?? [],
        },
        {
          jobId: 'bi-drive-intake-' + job.id,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      );
    } catch (error) {
      job.status = 'failed';
      job.errorMessage =
        error instanceof Error ? error.message : 'Unable to queue Drive import';
      await this.jobRepo.save(job);
      throw error;
    }
    return this.jobSummary(job);
  }

  async listJobs(user: User, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const jobs = await this.jobRepo.find({
      where: { organizationId: org.organizationId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return {
      jobs: await Promise.all(
        jobs.map(async (job) => this.jobSummaryWithCost(job)),
      ),
    };
  }

  async getJob(user: User, id: string, organizationId?: string) {
    return this.jobSummaryWithCost(
      await this.findJob(user, id, organizationId),
    );
  }

  async uploadBatch(
    user: User,
    id: string,
    files: Express.Multer.File[],
    rawFilePaths: string,
    organizationId?: string,
  ) {
    const job = await this.findJob(user, id, organizationId);
    if (['processing', 'completed'].includes(job.status))
      throw new BadRequestException(
        'This intake run is already processing or complete',
      );
    if (!files?.length || files.length > MAX_BATCH_FILES)
      throw new BadRequestException(
        `Upload between 1 and ${MAX_BATCH_FILES} images per batch`,
      );
    let paths: unknown;
    try {
      paths = JSON.parse(rawFilePaths);
    } catch {
      throw new BadRequestException(
        'filePaths must be a JSON array matching the uploaded files',
      );
    }
    if (
      !Array.isArray(paths) ||
      paths.length !== files.length ||
      paths.some((path) => typeof path !== 'string')
    )
      throw new BadRequestException(
        'filePaths must be a JSON array matching the uploaded files',
      );
    const currentImageCount = await this.assetRepo.count({
      where: { jobId: job.id, organizationId: job.organizationId },
    });
    if (currentImageCount + files.length > MAX_JOB_IMAGES)
      throw new BadRequestException(
        `An intake run cannot contain more than ${MAX_JOB_IMAGES} images`,
      );
    let uploaded = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const [index, file] of files.entries()) {
      const rawPath = paths[index] as string;
      try {
        const relativePath = safeIntakePath(rawPath);
        if (
          !isSupportedBusinessIndustrialImage(
            file.originalname || relativePath,
            file.mimetype,
          )
        )
          throw new Error('Only supported image files are accepted');
        if (!file.buffer || file.size > MAX_FILE_BYTES)
          throw new Error(
            'Each image must be present in memory and no larger than 25 MB',
          );
        if (
          await this.assetRepo.findOne({
            where: { jobId: job.id, relativePath },
          })
        ) {
          skipped++;
          continue;
        }
        const sourceFolderName = partFolderFromRelativePath(
          relativePath,
          job.sourceRootName,
        );
        const parsedFolder = parseInstanceFolderName(sourceFolderName);
        const basePartNormalized = normalizeImageIntakePartName(
          parsedFolder.baseFolderName,
        );
        if (!basePartNormalized || basePartNormalized === 'unassigned')
          throw new Error('The image is not inside a part folder');
        let group = await this.groupRepo.findOne({
          where: { jobId: job.id, basePartNormalized },
        });
        if (!group)
          group = this.groupRepo.create({
            id: randomUUID(),
            organizationId: job.organizationId,
            jobId: job.id,
            basePartName: parsedFolder.baseFolderName,
            basePartNormalized,
            rawFolderNames: [],
            instanceSuffixes: [],
            instanceCount: 0,
            detectionStatus: 'pending',
            detection: {},
            confidence: null,
            catalogProductId: null,
            errorMessage: null,
          });
        if (group?.catalogProductId)
          throw new Error(
            'This part group already created a draft; add images to the draft instead',
          );
        const rawFolders = new Set(group.rawFolderNames ?? []);
        const suffixes = new Set(group.instanceSuffixes ?? []);
        if (!rawFolders.has(parsedFolder.rawFolderName)) {
          rawFolders.add(parsedFolder.rawFolderName);
          if (parsedFolder.instanceSuffix)
            suffixes.add(parsedFolder.instanceSuffix);
          group.rawFolderNames = [...rawFolders];
          group.instanceSuffixes = [...suffixes];
          group.instanceCount = rawFolders.size;
        }
        group.errorMessage = null;
        await this.groupRepo.save(group);
        const canonical = await this.imageProcessor.convertBufferToWebp(
          file.buffer,
        );
        const sourceFilename =
          file.originalname || relativePath.split('/').pop() || 'image';
        const s3Key = this.storage.buildDurableKey(
          `business-industrial/intake/${job.id}/${basePartNormalized}/${randomUUID()}.webp`,
        );
        await this.storage.putObject(s3Key, canonical.buffer, 'image/webp');
        await this.assetRepo.save(
          this.assetRepo.create({
            id: randomUUID(),
            organizationId: job.organizationId,
            jobId: job.id,
            groupId: group.id,
            sourceFolderName: parsedFolder.rawFolderName,
            relativePath,
            filename: sourceFilename.replace(/.[^.]+$/, '') + '.webp',
            s3Bucket: this.storage.getBucket(),
            s3Key,
            cdnUrl: this.storage.getCdnUrl(s3Key),
            mimeType: 'image/webp',
            fileSizeBytes: canonical.buffer.length,
          }),
        );
        void this.storage.queueVariantGeneration(s3Key);
        uploaded++;
      } catch (error: unknown) {
        errors.push(
          `${rawPath}: ${error instanceof Error ? error.message : 'upload failed'}`,
        );
      }
    }
    const groups = await this.groupRepo.find({
      where: { jobId: job.id, organizationId: job.organizationId },
    });
    job.totalImages = await this.assetRepo.count({
      where: { jobId: job.id, organizationId: job.organizationId },
    });
    job.totalFolders = groups.reduce(
      (sum, group) => sum + (group.rawFolderNames?.length ?? 0),
      0,
    );
    job.groupedParts = groups.length;
    job.status = 'pending';
    job.errorMessage = errors.length ? errors.slice(0, 10).join('; ') : null;
    await this.jobRepo.save(job);
    return { uploaded, skipped, errors, job: this.jobSummary(job) };
  }

  async startJob(user: User, id: string, organizationId?: string) {
    const job = await this.findJob(user, id, organizationId);
    if (job.status === 'processing') return this.jobSummary(job);
    const groups = await this.groupRepo.find({
      where: { jobId: job.id, organizationId: job.organizationId },
    });
    if (!groups.length)
      throw new BadRequestException(
        'Upload at least one part folder before starting detection',
      );
    const retryable = groups.filter(
      (group) =>
        group.detectionStatus === 'pending' ||
        group.detectionStatus === 'failed',
    );
    if (!retryable.length) {
      if (job.status !== 'completed') {
        job.status = 'completed';
        job.completedAt = job.completedAt ?? new Date();
        await this.jobRepo.save(job);
      }
      return this.jobSummary(job);
    }
    job.status = 'processing';
    job.startedAt = new Date();
    job.completedAt = null;
    job.errorMessage = null;
    await this.jobRepo.save(job);
    try {
      await this.intakeQueue.add(
        'detect',
        { jobId: job.id },
        {
          jobId: `bi-image-intake-${job.id}-${job.startedAt.getTime()}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      );
    } catch (error) {
      job.status = 'failed';
      job.errorMessage =
        error instanceof Error ? error.message : 'Unable to queue detection';
      await this.jobRepo.save(job);
      throw error;
    }
    return this.jobSummary(job);
  }

  async listGroups(user: User, jobId: string, organizationId?: string) {
    const job = await this.findJob(user, jobId, organizationId);
    const groups = await this.groupRepo.find({
      where: { jobId: job.id, organizationId: job.organizationId },
      order: { basePartName: 'ASC' },
    });
    return { groups: groups.map((group) => this.groupSummary(group)) };
  }

  async getGroup(user: User, id: string, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const group = await this.groupRepo.findOne({
      where: { id, organizationId: org.organizationId },
    });
    if (!group)
      throw new NotFoundException(
        'Business & Industrial image group not found',
      );
    const assets = await this.assetRepo.find({
      where: { groupId: group.id, organizationId: org.organizationId },
      order: { createdAt: 'ASC' },
    });
    return {
      ...this.groupSummary(group),
      assets: assets.map((asset) => this.assetSummary(asset)),
    };
  }

  async applyGroup(
    user: User,
    id: string,
    dto: ApplyBusinessIndustrialImageIntakeGroupDto,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const group = await this.groupRepo.findOne({
      where: { id, organizationId: org.organizationId },
    });
    if (!group)
      throw new NotFoundException(
        'Business & Industrial image group not found',
      );
    if (group.catalogProductId)
      return { catalogProductId: group.catalogProductId, created: false };
    const detail = asRecord(group.detection);
    const candidate = asRecord(detail.candidate);
    const category = asRecord(detail.category);
    const enrichment = asRecord(detail.enrichment);
    const categoryFamily =
      dto.categoryFamily ?? stringValue(candidate.categoryFamily);
    if (!categoryFamily || !CATEGORY_FAMILY_IDS.has(categoryFamily))
      throw new BadRequestException(
        'Choose a deliberate Business & Industrial category family before creating a draft',
      );
    const candidateAttributes = asRecord(candidate.verticalAttributes);
    const overrideAttributes = asRecord(dto.verticalAttributes);
    const attributes = {
      ...candidateAttributes,
      ...overrideAttributes,
      categoryFamily,
      ...((dto.brand ?? stringValue(candidate.brand))
        ? { manufacturer: dto.brand ?? stringValue(candidate.brand) }
        : {}),
      ...((dto.model ?? stringValue(candidate.model))
        ? { model: dto.model ?? stringValue(candidate.model) }
        : {}),
      ...((dto.mpn ?? stringValue(candidate.mpn))
        ? { mpn: dto.mpn ?? stringValue(candidate.mpn) }
        : {}),
      inventoryMode:
        overrideAttributes.inventoryMode ??
        candidateAttributes.inventoryMode ??
        'single',
      shippingMode:
        overrideAttributes.shippingMode ??
        candidateAttributes.shippingMode ??
        'parcel',
    };
    const validation = validateBusinessIndustrialAttributes(attributes);
    if (validation.errors.length)
      throw new BadRequestException({
        message:
          'Detected B&I attributes need correction before draft creation',
        errors: validation.errors,
      });
    const imageUrls = (
      await this.assetRepo.find({
        where: { groupId: group.id, organizationId: org.organizationId },
        order: { createdAt: 'ASC' },
      })
    ).map((asset) => asset.cdnUrl);
    const draft: CreateBusinessIndustrialDraftDto = {
      sku: (
        dto.sku?.trim() ||
        `BI-${group.basePartNormalized.slice(0, 96)}-${group.id.slice(0, 8)}`
      ).slice(0, 160),
      title: (
        dto.title?.trim() ||
        stringValue(enrichment.optimizedTitle) ||
        stringValue(candidate.title) ||
        group.basePartName
      ).slice(0, 200),
      description:
        dto.description ??
        stringValue(enrichment.optimizedDescription) ??
        stringValue(candidate.description) ??
        undefined,
      brand: dto.brand ?? stringValue(candidate.brand) ?? undefined,
      model: dto.model ?? stringValue(candidate.model) ?? undefined,
      mpn: dto.mpn ?? stringValue(candidate.mpn) ?? undefined,
      conditionId: dto.conditionId?.trim() || undefined,
      conditionLabel:
        dto.conditionLabel ??
        stringValue(candidate.conditionLabel) ??
        undefined,
      price: dto.price ?? numberValue(candidate.priceEstimate) ?? undefined,
      quantity: dto.quantity ?? group.instanceCount,
      imageUrls,
      categoryId:
        dto.categoryId ?? stringValue(category.categoryId) ?? undefined,
      categoryName:
        dto.categoryName ?? stringValue(category.categoryName) ?? undefined,
      verticalAttributes: attributes,
      optimizedTitle:
        stringValue(enrichment.optimizedTitle) ??
        stringValue(candidate.title) ??
        undefined,
      optimizedDescription:
        stringValue(enrichment.optimizedDescription) ??
        stringValue(candidate.description) ??
        undefined,
      optimizationPayload: enrichment,
      seoScore: scoreValue(enrichment.seoScore),
      readinessScore: scoreValue(enrichment.readinessScore),
    };
    const listing = await this.businessIndustrial.createListing(
      user,
      draft,
      org.organizationId,
    );
    const catalogProductId = stringValue(asRecord(listing).id);
    if (!catalogProductId)
      throw new Error('B&I draft was created without a catalog product ID');
    await this.ensureInventoryProjection(group.jobId, group, listing);
    group.catalogProductId = catalogProductId;
    group.detectionStatus = 'draft_created';
    await this.groupRepo.save(group);
    return { catalogProductId, created: true, listing };
  }

  async exportJob(
    user: User,
    id: string,
    organizationId?: string,
  ): Promise<Buffer> {
    const job = await this.findJob(user, id, organizationId);
    const groups = await this.groupRepo.find({
      where: { jobId: job.id, organizationId: job.organizationId },
      order: { basePartName: 'ASC' },
    });
    const assets = await this.assetRepo.find({
      where: { jobId: job.id, organizationId: job.organizationId },
      order: { createdAt: 'ASC' },
    });
    const assetsByGroup = new Map<
      string,
      BusinessIndustrialImageIntakeAsset[]
    >();
    for (const asset of assets)
      assetsByGroup.set(asset.groupId, [
        ...(assetsByGroup.get(asset.groupId) ?? []),
        asset,
      ]);
    const listings = groups.map((group) => {
      const candidate = asRecord(asRecord(group.detection).candidate);
      const category = asRecord(asRecord(group.detection).category);
      return {
        'Base Part': group.basePartName,
        Quantity: group.instanceCount,
        'Raw Folders': (group.rawFolderNames ?? []).join(', '),
        'Image Count': (assetsByGroup.get(group.id) ?? []).length,
        Title: stringValue(candidate.title) ?? '',
        Brand: stringValue(candidate.brand) ?? '',
        Model: stringValue(candidate.model) ?? '',
        MPN: stringValue(candidate.mpn) ?? '',
        'Part Type': stringValue(candidate.partType) ?? '',
        Condition: stringValue(candidate.conditionLabel) ?? '',
        'Category Family': stringValue(candidate.categoryFamily) ?? '',
        'eBay Category ID': stringValue(category.categoryId) ?? '',
        'eBay Category Name': stringValue(category.categoryName) ?? '',
        'Price Estimate': numberValue(candidate.priceEstimate) ?? '',
        Description: stringValue(candidate.description) ?? '',
        'Technical Specifications': jsonText(candidate.verticalAttributes),
        Testing: stringValue(candidate.testing) ?? '',
        Warnings: stringArray(asRecord(group.detection).warnings).join(' | '),
        Confidence: group.confidence ?? '',
        'Detection Status': group.detectionStatus,
        'Catalog Product ID': group.catalogProductId ?? '',
      };
    });
    const sourceFolders = groups.flatMap((group) =>
      (group.rawFolderNames ?? []).map((folder) => ({
        'Job ID': job.id,
        'Group ID': group.id,
        'Base Part': group.basePartName,
        'Raw Folder': folder,
        'Instance Suffix': parseInstanceFolderName(folder).instanceSuffix ?? '',
      })),
    );
    const imageRows = assets.map((asset) => ({
      'Group ID': asset.groupId,
      'Source Folder': asset.sourceFolderName,
      Filename: asset.filename,
      'Relative Path': asset.relativePath,
      'CDN URL': asset.cdnUrl,
      'S3 Key': asset.s3Key,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(listings),
      'Listings',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sourceFolders),
      'Source Folders',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(imageRows),
      'Image Assets',
    );
    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
  }

  async processDriveJob(
    jobId: string,
    maxItems: number,
    autoCreateDrafts: boolean,
    skipFolderNames: string[] = [],
  ): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    try {
      const rootId = this.parseDriveFolderId(job.sourceReferenceUrl ?? '');
      const directChildren = await this.listDriveChildren(rootId);
      const directFolders = directChildren
        .filter((file) => file.mimeType === DRIVE_FOLDER_MIME)
        .sort((a, b) => this.naturalCompare(a.name, b.name));
      const exactBniFolders = directFolders.filter((file) =>
        /^BNI[-_ ]\d+$/i.test(file.name.trim()),
      );
      const selectedItemLimit = Math.min(
        Math.max(maxItems, 1),
        MAX_DRIVE_ITEMS,
      );
      const excludedFolderNames = new Set(
        skipFolderNames.map(normalizeDriveFolderName),
      );
      const candidates = (
        exactBniFolders.length >= selectedItemLimit
          ? exactBniFolders
          : directFolders
      ).filter(
        (folder) =>
          !excludedFolderNames.has(normalizeDriveFolderName(folder.name)),
      );
      let selectedFolders = 0;
      let imported = 0;
      for (const folder of candidates) {
        if (selectedFolders >= selectedItemLimit) break;
        const images = await this.collectDriveImages(
          folder.id,
          folder.name,
          job.sourceRootName,
        );
        if (!images.length) continue;
        selectedFolders++;
        for (const image of images.slice(0, MAX_VISION_IMAGES)) {
          if (imported >= MAX_DRIVE_IMAGES) break;
          try {
            const buffer = await this.downloadDriveImage(image);
            await this.ingestImageBuffer(
              job,
              image.relativePath,
              image.name,
              image.mimeType,
              buffer,
            );
            imported++;
          } catch (error: unknown) {
            this.logger.warn(
              `Drive image ${image.name} skipped: ${error instanceof Error ? error.message : error}`,
            );
          }
        }
      }
      if (!selectedFolders || !imported)
        throw new Error(
          'No supported images were found in the selected public Google Drive folder',
        );
      const groups = await this.groupRepo.find({
        where: { jobId: job.id, organizationId: job.organizationId },
      });
      job.totalImages = await this.assetRepo.count({
        where: { jobId: job.id, organizationId: job.organizationId },
      });
      job.totalFolders = groups.reduce(
        (sum, group) => sum + (group.rawFolderNames?.length ?? 0),
        0,
      );
      job.groupedParts = groups.length;
      await this.jobRepo.save(job);
      await this.processJob(job.id, autoCreateDrafts);
    } catch (error: unknown) {
      job.status = 'failed';
      job.errorMessage =
        error instanceof Error ? error.message : 'Google Drive import failed';
      job.completedAt = new Date();
      await this.jobRepo.save(job);
      this.logger.error(
        `B&I Drive intake ${job.id} failed: ${job.errorMessage}`,
      );
    }
  }

  async processJob(jobId: string, autoCreateDrafts = false): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    const groups = await this.groupRepo.find({
      where: { jobId: job.id, organizationId: job.organizationId },
      order: { createdAt: 'ASC' },
    });
    if (!groups.length) {
      job.status = 'failed';
      job.errorMessage = 'No part groups were uploaded';
      job.completedAt = new Date();
      await this.jobRepo.save(job);
      return;
    }
    const retryable = groups.filter(
      (group) =>
        group.detectionStatus === 'pending' ||
        group.detectionStatus === 'failed',
    );
    const preserved = groups.filter((group) => !retryable.includes(group));
    job.status = 'processing';
    job.processedFolders = preserved.reduce(
      (sum, group) => sum + (group.rawFolderNames?.length ?? 0),
      0,
    );
    job.processedImages = 0;
    for (const group of preserved)
      job.processedImages += await this.assetRepo.count({
        where: { groupId: group.id, organizationId: job.organizationId },
      });
    job.failedFolders = 0;
    await this.jobRepo.save(job);
    const creator =
      autoCreateDrafts && job.createdByUserId
        ? await this.userRepo.findOne({ where: { id: job.createdByUserId } })
        : null;
    for (const group of retryable) {
      try {
        await this.detectGroup(job, group);
        if (autoCreateDrafts && creator && group.detectionStatus !== 'failed') {
          try {
            await this.applyGroup(creator, group.id, {}, job.organizationId);
          } catch (error: unknown) {
            group.errorMessage =
              error instanceof Error
                ? `Enrichment completed; draft creation needs review: ${error.message}`
                : 'Enrichment completed; draft creation needs review';
            await this.groupRepo.save(group);
          }
        }
      } catch (error: unknown) {
        group.detectionStatus = 'failed';
        group.errorMessage =
          error instanceof Error ? error.message : 'AI detection failed';
        await this.groupRepo.save(group);
        job.failedFolders += 1;
        this.logger.error(
          `B&I image group ${group.id} failed: ${group.errorMessage}`,
        );
      }
      job.processedFolders += group.rawFolderNames?.length ?? 0;
      job.processedImages += await this.assetRepo.count({
        where: { groupId: group.id, organizationId: job.organizationId },
      });
      await this.jobRepo.save(job);
    }
    const failed = await this.groupRepo.count({
      where: {
        jobId: job.id,
        organizationId: job.organizationId,
        detectionStatus: 'failed',
      },
    });
    job.status =
      failed === groups.length ? 'failed' : failed ? 'partial' : 'completed';
    job.failedFolders = failed;
    job.completedAt = new Date();
    if (failed)
      job.errorMessage = `${failed} part group(s) need retry or manual review`;
    await this.jobRepo.save(job);
  }

  private async detectGroup(
    job: BusinessIndustrialImageIntakeJob,
    group: BusinessIndustrialImageIntakeGroup,
  ) {
    group.detectionStatus = 'processing';
    group.errorMessage = null;
    await this.groupRepo.save(group);
    const assets = await this.assetRepo.find({
      where: { groupId: group.id, organizationId: job.organizationId },
      order: { createdAt: 'ASC' },
    });
    if (!assets.length) throw new Error('Part group has no images');
    const route = this.modelRouter.selectVisionRoute(
      {
        sku: group.basePartName,
        partName: group.basePartName,
        partType: 'business_industrial_image_intake',
        marketplace: 'US',
      },
      'bulk',
    );
    const model =
      this.config.get<string>(
        'BUSINESS_INDUSTRIAL_AI_MODEL',
        'openai/gpt-5.6-luna-20260709',
      ) || 'openai/gpt-5.6-luna-20260709';
    this.modelRouter.assertAllowed(model);
    const response = await this.openai.chat({
      model,
      costLane: route.lane,
      imageUrls: assets
        .slice(0, MAX_VISION_IMAGES)
        .map((asset) => asset.cdnUrl),
      systemPrompt: VISION_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        basePartName: group.basePartName,
        sourceFolderNames: group.rawFolderNames,
        imageCount: assets.length,
        instruction:
          'Identify the same part group. The final numeric dot suffix in a folder name is an instance marker; do not convert it into a decimal quantity.',
      }),
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 2500,
    });
    const candidate = asRecord(response.content);
    if (!Object.keys(candidate).length)
      throw new Error('AI returned no structured identification');
    const category = await this.resolveCategory(candidate, group.basePartName);
    const enrichment = await this.enrichListing(
      job,
      group,
      candidate,
      category,
      model,
    );
    const overallConfidence = confidenceValue(candidate.confidence);
    const warnings = stringArray(candidate.warnings);
    if (!category.categoryId)
      warnings.push(
        'eBay leaf category could not be resolved automatically; choose one during review',
      );
    if (!stringValue(candidate.categoryFamily))
      warnings.push('Choose a deliberate B&I category family during review');
    if (!stringValue(candidate.mpn))
      warnings.push('Exact part number was not confirmed from the images');
    group.detection = {
      candidate: this.publicCandidate(candidate),
      category,
      sourceFolderNames: group.rawFolderNames,
      imageCount: assets.length,
      warnings: [...new Set(warnings)],
      promptVersion: PROMPT_VERSION,
      routing: {
        lane: route.lane,
        model,
        segmentKey: route.segmentKey,
      },
      enrichment,
    };
    group.confidence = overallConfidence;
    group.detectionStatus =
      overallConfidence >= 0.85 &&
      Boolean(category.categoryId) &&
      Boolean(stringValue(candidate.categoryFamily))
        ? 'detected'
        : 'needs_review';
    await this.groupRepo.save(group);
    try {
      await this.aiRunLogs.logRun({
        sku: group.basePartName,
        partNumber: stringValue(candidate.mpn),
        partType:
          stringValue(candidate.partType) ?? 'business_industrial_image_intake',
        marketplace: 'US',
        batchId: job.id,
        lane: route.lane,
        model: response.model,
        promptVersion: PROMPT_VERSION,
        routingPolicyVersion: route.policyVersion,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        costUsd: response.estimatedCostUsd,
        latencyMs: response.latencyMs,
        validationScore: Math.round(overallConfidence * 100),
        softFails: [...new Set(warnings)],
        passedGate: group.detectionStatus === 'detected',
      });
    } catch (error) {
      this.logger.warn(
        `Unable to write B&I image AI audit log: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async resolveCategory(
    candidate: JsonRecord,
    basePartName: string,
  ): Promise<JsonRecord> {
    const query =
      stringValue(candidate.categorySearchQuery) ||
      [
        stringValue(candidate.brand),
        stringValue(candidate.model),
        stringValue(candidate.partType),
        basePartName,
      ]
        .filter(Boolean)
        .join(' ');
    if (!query)
      return {
        categoryId: null,
        categoryName: null,
        marketplaceId: 'EBAY_US',
        aspects: [],
        warnings: ['No category search query was available'],
      };
    try {
      const treeId = await this.taxonomy.getDefaultCategoryTreeId('EBAY_US');
      const suggestions = await this.taxonomy.getCategorySuggestions(
        query.slice(0, 200),
        treeId,
      );
      for (const suggestion of suggestions.slice(0, 5)) {
        const categoryId = suggestion.category?.categoryId;
        if (!categoryId) continue;
        try {
          const subtree = await this.taxonomy.getCategorySubtree(
            categoryId,
            treeId,
          );
          if (!subtree.categorySubtreeNode?.leafCategoryTreeNode) continue;
          const aspects = await this.taxonomy.getItemAspectsForCategory(
            categoryId,
            treeId,
          );
          return {
            categoryId,
            categoryName: suggestion.category.categoryName,
            marketplaceId: 'EBAY_US',
            relevancy: suggestion.relevancy,
            ancestors: suggestion.categoryTreeNodeAncestors,
            aspects: aspects.map((aspect) => ({
              name: aspect.localizedAspectName,
              required: aspect.aspectConstraint?.aspectRequired ?? false,
              usage: aspect.aspectConstraint?.aspectUsage ?? 'OPTIONAL',
              values:
                aspect.aspectValues
                  ?.map((value) => value.localizedValue)
                  .slice(0, 100) ?? [],
            })),
          };
        } catch {
          /* try the next ranked suggestion */
        }
      }
      return {
        categoryId: null,
        categoryName: null,
        marketplaceId: 'EBAY_US',
        aspects: [],
        warnings: ['No ranked suggestion was a verified leaf category'],
      };
    } catch (error) {
      return {
        categoryId: null,
        categoryName: null,
        marketplaceId: 'EBAY_US',
        aspects: [],
        warnings: [
          `eBay taxonomy unavailable: ${error instanceof Error ? error.message : 'request failed'}`,
        ],
      };
    }
  }

  private async enrichListing(
    job: BusinessIndustrialImageIntakeJob,
    group: BusinessIndustrialImageIntakeGroup,
    candidate: JsonRecord,
    category: JsonRecord,
    model: string,
  ): Promise<JsonRecord> {
    const route = this.modelRouter.selectTextRoute(
      {
        sku: group.basePartName,
        partName: group.basePartName,
        partType: stringValue(candidate.partType) ?? 'business_industrial',
        marketplace: 'US',
      },
      'bulk',
    );
    const response = await this.openai.chat({
      model,
      costLane: route.lane,
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        sourceFolder: group.basePartName,
        identification: this.publicCandidate(candidate),
        ebayCategory: category,
        instruction:
          'Create a reviewable listing draft. Keep any unknown value out of the title and item specifics.',
      }),
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1400,
    });
    const raw = asRecord(response.content);
    const warnings = stringArray(raw.warnings);
    const optimizedTitle = (
      stringValue(raw.optimizedTitle) ??
      stringValue(candidate.title) ??
      group.basePartName
    ).slice(0, 80);
    const optimizedDescription =
      stringValue(raw.optimizedDescription) ??
      stringValue(candidate.description) ??
      'Please verify the photographed item, condition, included components, and testing status before publishing.';
    const enrichment = {
      optimizedTitle,
      optimizedDescription,
      keywords: stringArray(raw.keywords),
      itemSpecifics: asRecord(raw.itemSpecifics),
      seoScore: scoreValue(raw.seoScore),
      readinessScore: scoreValue(raw.readinessScore),
      warnings,
      model: response.model,
      promptVersion: ENRICHMENT_PROMPT_VERSION,
    };
    try {
      await this.aiRunLogs.logRun({
        sku: group.basePartName,
        partNumber: stringValue(candidate.mpn),
        partType: stringValue(candidate.partType) ?? 'business_industrial',
        marketplace: 'US',
        batchId: job.id,
        lane: route.lane,
        model: response.model,
        promptVersion: ENRICHMENT_PROMPT_VERSION,
        routingPolicyVersion: route.policyVersion,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        costUsd: response.estimatedCostUsd,
        latencyMs: response.latencyMs,
        validationScore: Math.round(enrichment.readinessScore),
        softFails: warnings,
        passedGate: false,
      });
    } catch (error) {
      this.logger.warn(
        'Unable to write B&I listing enrichment audit log: ' +
          (error instanceof Error ? error.message : error),
      );
    }
    return enrichment;
  }

  private async ensureInventoryProjection(
    jobId: string,
    group: BusinessIndustrialImageIntakeGroup,
    listing: unknown,
  ): Promise<void> {
    const product = asRecord(listing);
    const sku = stringValue(product.sku);
    if (!sku) return;
    const existing = await this.listingRepo.findOne({
      where: { customLabelSku: sku, vertical: 'business_industrial' },
    });
    if (existing) return;
    const attributes = asRecord(product.verticalAttributes);
    const assets = await this.assetRepo.find({
      where: { groupId: group.id, organizationId: group.organizationId },
      order: { createdAt: 'ASC' },
    });
    const price = numberValue(product.price);
    const quantity = numberValue(product.quantity);
    const record = this.listingRepo.create({
      organizationId: group.organizationId,
      vertical: 'business_industrial',
      verticalAttributes: attributes,
      sourceFileName: 'business-industrial-intake-' + jobId,
      sourceFilePath: 'business-industrial-intake:' + jobId,
      sheetName: group.id,
      sourceRowNumber: 1,
      origin: ListingOrigin.ADD_PART,
      action: 'Add',
      customLabelSku: sku,
      categoryId: stringValue(product.categoryId),
      categoryName: stringValue(product.categoryName),
      title: stringValue(product.title),
      startPrice: price === null ? null : String(price),
      startPriceNum: price,
      quantity: quantity === null ? null : String(quantity),
      quantityNum: quantity,
      itemPhotoUrl: assets.map((asset) => asset.cdnUrl).join('|') || null,
      conditionId: stringValue(product.conditionId),
      conditionLabel: stringValue(product.conditionLabel),
      description: stringValue(product.description),
      format: 'FixedPrice',
      duration: 'GTC',
      cBrand: stringValue(product.brand),
      cType: stringValue(attributes.partType),
      cFeatures: jsonText(attributes.features),
      cManufacturerPartNumber: stringValue(product.mpn),
      cOeOemPartNumber: stringValue(attributes.oemPartNumber),
      status: 'draft',
      enrichmentStage: 'completed',
    });
    await this.listingRepo.save(record);
  }

  private async ingestImageBuffer(
    job: BusinessIndustrialImageIntakeJob,
    rawPath: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<void> {
    const relativePath = safeIntakePath(rawPath);
    if (!isSupportedBusinessIndustrialImage(originalName, mimeType))
      throw new Error('Only supported image files are accepted');
    if (!buffer.length || buffer.length > MAX_FILE_BYTES)
      throw new Error('Each image must be present and no larger than 25 MB');
    if (
      await this.assetRepo.findOne({
        where: { jobId: job.id, relativePath },
      })
    )
      return;
    const sourceFolderName = partFolderFromRelativePath(
      relativePath,
      job.sourceRootName,
    );
    const parsedFolder = parseInstanceFolderName(sourceFolderName);
    const basePartNormalized = normalizeImageIntakePartName(
      parsedFolder.baseFolderName,
    );
    if (!basePartNormalized || basePartNormalized === 'unassigned')
      throw new Error('The image is not inside a part folder');
    let group = await this.groupRepo.findOne({
      where: { jobId: job.id, basePartNormalized },
    });
    if (!group)
      group = this.groupRepo.create({
        id: randomUUID(),
        organizationId: job.organizationId,
        jobId: job.id,
        basePartName: parsedFolder.baseFolderName,
        basePartNormalized,
        rawFolderNames: [],
        instanceSuffixes: [],
        instanceCount: 0,
        detectionStatus: 'pending',
        detection: {},
        confidence: null,
        catalogProductId: null,
        errorMessage: null,
      });
    if (group.catalogProductId)
      throw new Error('This part group already has a draft');
    const rawFolders = new Set(group.rawFolderNames ?? []);
    const suffixes = new Set(group.instanceSuffixes ?? []);
    rawFolders.add(parsedFolder.rawFolderName);
    if (parsedFolder.instanceSuffix) suffixes.add(parsedFolder.instanceSuffix);
    group.rawFolderNames = [...rawFolders];
    group.instanceSuffixes = [...suffixes];
    group.instanceCount = rawFolders.size;
    group.errorMessage = null;
    await this.groupRepo.save(group);
    const canonical = await this.imageProcessor.convertBufferToWebp(buffer);
    const filename = originalName.replace(/.[^.]+$/, '') + '.webp';
    const s3Key = this.storage.buildDurableKey(
      'business-industrial/intake/' +
        job.id +
        '/' +
        basePartNormalized +
        '/' +
        randomUUID() +
        '.webp',
    );
    await this.storage.putObject(s3Key, canonical.buffer, 'image/webp');
    await this.assetRepo.save(
      this.assetRepo.create({
        id: randomUUID(),
        organizationId: job.organizationId,
        jobId: job.id,
        groupId: group.id,
        sourceFolderName: parsedFolder.rawFolderName,
        relativePath,
        filename,
        s3Bucket: this.storage.getBucket(),
        s3Key,
        cdnUrl: this.storage.getCdnUrl(s3Key),
        mimeType: 'image/webp',
        fileSizeBytes: canonical.buffer.length,
      }),
    );
    void this.storage.queueVariantGeneration(s3Key);
  }

  private parseDriveFolderId(reference: string): string {
    let url: URL;
    try {
      url = new URL(reference);
    } catch {
      throw new BadRequestException('Provide a valid Google Drive folder URL');
    }
    if (!['drive.google.com', 'www.drive.google.com'].includes(url.hostname))
      throw new BadRequestException(
        'Only drive.google.com folder links are supported',
      );
    const match = /\/folders\/([^/?#]+)/.exec(url.pathname);
    if (!match?.[1])
      throw new BadRequestException(
        'The Google Drive URL must point to a folder',
      );
    return decodeURIComponent(match[1]);
  }

  private getDriveApiKey(): string {
    const key = this.config.get<string>('GOOGLE_DRIVE_API_KEY')?.trim();
    if (!key)
      throw new Error(
        'GOOGLE_DRIVE_API_KEY is not configured on the server; public Drive import is unavailable',
      );
    return key;
  }

  private async listDriveChildren(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q:
          "'" +
          folderId.replace(/'/g, "\\'") +
          "' in parents and trashed = false",
        fields: 'nextPageToken,files(id,name,mimeType,size,webContentLink)',
        pageSize: '1000',
        key: this.getDriveApiKey(),
      });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch(DRIVE_API_ROOT + '?' + params.toString());
      if (!response.ok)
        throw new Error(
          'Google Drive listing failed (' +
            response.status +
            '); confirm the folder is public and the server API key is enabled',
        );
      const body = (await response.json()) as {
        files?: DriveFile[];
        nextPageToken?: string;
      };
      files.push(...(body.files ?? []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return files;
  }

  private async collectDriveImages(
    folderId: string,
    folderPath: string,
    rootName: string,
    visited = new Set<string>(),
  ): Promise<DriveImage[]> {
    if (visited.has(folderId)) return [];
    visited.add(folderId);
    const images: DriveImage[] = [];
    for (const file of await this.listDriveChildren(folderId)) {
      if (images.length >= MAX_VISION_IMAGES) break;
      if (file.mimeType === DRIVE_FOLDER_MIME) {
        images.push(
          ...(await this.collectDriveImages(
            file.id,
            folderPath + '/' + file.name,
            rootName,
            visited,
          )),
        );
      } else if (isSupportedBusinessIndustrialImage(file.name, file.mimeType)) {
        const safeName = file.name.replace(/[\\/]/g, '_');
        images.push({
          ...file,
          relativePath: [rootName, folderPath, safeName].join('/'),
        });
      }
    }
    return images.slice(0, MAX_VISION_IMAGES);
  }

  private async downloadDriveImage(file: DriveFile): Promise<Buffer> {
    if (file.webContentLink) {
      const publicResponse = await fetch(file.webContentLink);
      const publicContentType =
        publicResponse.headers.get('content-type')?.toLowerCase() ?? '';
      if (publicResponse.ok && !publicContentType.includes('text/html')) {
        return this.readDriveImageResponse(publicResponse);
      }
    }

    const params = new URLSearchParams({
      alt: 'media',
      key: this.getDriveApiKey(),
    });
    const response = await fetch(
      DRIVE_API_ROOT + '/' + encodeURIComponent(file.id) + '?' + params,
    );
    if (!response.ok)
      throw new Error(
        'Google Drive image download failed (' + response.status + ')',
      );
    return this.readDriveImageResponse(response);
  }

  private async readDriveImageResponse(response: Response): Promise<Buffer> {
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_FILE_BYTES)
      throw new Error('Google Drive image is larger than 25 MB');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES)
      throw new Error('Google Drive image is larger than 25 MB');
    return buffer;
  }

  private naturalCompare(left: string, right: string): number {
    return left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private async findJob(user: User, id: string, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const job = await this.jobRepo.findOne({
      where: { id, organizationId: org.organizationId },
    });
    if (!job)
      throw new NotFoundException(
        'Business & Industrial image intake run not found',
      );
    return job;
  }
  private jobSummary(job: BusinessIndustrialImageIntakeJob) {
    return {
      id: job.id,
      sourceRootName: job.sourceRootName,
      sourceReferenceUrl: job.sourceReferenceUrl,
      status: job.status,
      totalFolders: job.totalFolders,
      totalImages: job.totalImages,
      processedFolders: job.processedFolders,
      processedImages: job.processedImages,
      groupedParts: job.groupedParts,
      failedFolders: job.failedFolders,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      aiModel:
        this.config.get<string>(
          'BUSINESS_INDUSTRIAL_AI_MODEL',
          'openai/gpt-5.6-luna-20260709',
        ) || 'openai/gpt-5.6-luna-20260709',
      webpStorage: true,
    };
  }
  private async jobSummaryWithCost(job: BusinessIndustrialImageIntakeJob) {
    const summary = this.jobSummary(job);
    const totals = await this.aiRunLogs.getBatchTotals(job.id);
    return {
      ...summary,
      aiInputTokens: totals.inputTokens,
      aiOutputTokens: totals.outputTokens,
      aiCostUsd: totals.costUsd,
      aiRuns: totals.runs,
    };
  }
  private groupSummary(group: BusinessIndustrialImageIntakeGroup) {
    const detail = asRecord(group.detection);
    const candidate = asRecord(detail.candidate);
    const category = asRecord(detail.category);
    return {
      id: group.id,
      jobId: group.jobId,
      basePartName: group.basePartName,
      rawFolderNames: group.rawFolderNames,
      instanceSuffixes: group.instanceSuffixes,
      instanceCount: group.instanceCount,
      detectionStatus: group.detectionStatus,
      confidence: group.confidence,
      catalogProductId: group.catalogProductId,
      errorMessage: group.errorMessage,
      detected: {
        title: stringValue(candidate.title),
        brand: stringValue(candidate.brand),
        model: stringValue(candidate.model),
        mpn: stringValue(candidate.mpn),
        partType: stringValue(candidate.partType),
        conditionLabel: stringValue(candidate.conditionLabel),
        categoryFamily: stringValue(candidate.categoryFamily),
        categoryId: stringValue(category.categoryId),
        categoryName: stringValue(category.categoryName),
        warnings: stringArray(detail.warnings),
      },
    };
  }
  private assetSummary(asset: BusinessIndustrialImageIntakeAsset) {
    return {
      id: asset.id,
      sourceFolderName: asset.sourceFolderName,
      relativePath: asset.relativePath,
      filename: asset.filename,
      cdnUrl: asset.cdnUrl,
      mimeType: asset.mimeType,
      fileSizeBytes: Number(asset.fileSizeBytes),
      createdAt: asset.createdAt,
    };
  }
  private publicCandidate(candidate: JsonRecord): JsonRecord {
    return {
      title: stringValue(candidate.title),
      brand: stringValue(candidate.brand),
      model: stringValue(candidate.model),
      mpn: stringValue(candidate.mpn),
      oemPartNumber: stringValue(candidate.oemPartNumber),
      partType: stringValue(candidate.partType),
      categoryFamily: CATEGORY_FAMILY_IDS.has(
        stringValue(candidate.categoryFamily) ?? '',
      )
        ? stringValue(candidate.categoryFamily)
        : null,
      categorySearchQuery: stringValue(candidate.categorySearchQuery),
      conditionLabel: stringValue(candidate.conditionLabel) ?? 'UNKNOWN',
      description: stringValue(candidate.description),
      visibleText: stringArray(candidate.visibleText),
      features: stringArray(candidate.features),
      warnings: stringArray(candidate.warnings),
      includedComponents: stringArray(candidate.includedComponents),
      missingParts: stringArray(candidate.missingParts),
      testing: stringValue(candidate.testing),
      verticalAttributes: asRecord(candidate.verticalAttributes),
      confidence: asRecord(candidate.confidence),
      priceEstimate: numberValue(candidate.priceEstimate),
    };
  }
  private fileExtension(filename: string): string {
    const match = /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.exec(
      filename,
    );
    return match ? `.${match[1].toLowerCase()}` : '.img';
  }
}
function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function numberValue(value: unknown): number | null {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(number) ? number : null;
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' && Boolean(item.trim()),
        )
        .map((item) => item.trim())
        .slice(0, 100)
    : [];
}
function confidenceValue(value: unknown): number {
  const record = asRecord(value);
  const raw = numberValue(record.overall) ?? numberValue(value);
  if (raw === null) return 0;
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}
function scoreValue(value: unknown): number {
  const score = numberValue(value);
  if (score === null) return 0;
  return Math.max(0, Math.min(100, score <= 1 ? score * 100 : score));
}
function normalizeDriveFolderName(value: string): string {
  return value.trim().toLowerCase();
}
function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}) ?? '{}';
  } catch {
    return '{}';
  }
}
