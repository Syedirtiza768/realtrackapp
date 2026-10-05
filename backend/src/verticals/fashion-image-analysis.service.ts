import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ImageProcessorService } from '../storage/image-processor.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { AiRunLogService } from '../common/openai/ai-run-log.service.js';
import { ModelRouter } from '../common/openai/model-router.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import type { ProductAttributes } from './vertical.types.js';
import {
  applyFashionAnalysisMeta,
  buildFashionListingContent,
  mergeFashionSuggestions,
  normalizeFashionCategoryFamily,
  suggestFashionSku,
  validateFashionAttributes,
} from './fashion.config.js';
import type {
  AnalyzeFashionImagesDto,
  GenerateFashionListingDto,
} from './fashion.dto.js';

const MAX_PHOTOS = 24;
const MAX_VISION_IMAGES = 12;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
]);
const PROMPT_VERSION = 'fashion-image-identification-v1';

const VISION_SYSTEM_PROMPT = `You identify photographed fashion inventory for an e-commerce listing draft. Analyze every submitted image together as one garment or accessory, including readable brand, size, and care labels.

Return JSON only:
{"itemType":string|null,"productType":string|null,"categoryFamily":"clothing"|"footwear"|"accessories"|null,"categorySearchQuery":string|null,"brand":string|null,"department":string|null,"size":string|null,"sizeSystem":string|null,"sizeType":string|null,"color":string|null,"secondaryColor":string|null,"pattern":string|null,"style":string|null,"material":string|null,"composition":string|null,"fabricType":string|null,"sleeveLength":string|null,"neckline":string|null,"closure":string|null,"length":string|null,"fit":string|null,"chestMeasurement":string|null,"waistMeasurement":string|null,"hipMeasurement":string|null,"lengthMeasurement":string|null,"inseamMeasurement":string|null,"measurementsUnit":string|null,"measurements":string|null,"wear":string|null,"stains":string|null,"holes":string|null,"pilling":string|null,"fading":string|null,"repairs":string|null,"missingComponents":string|null,"otherDefects":string|null,"conditionDetails":string|null,"conditionLabel":"NEW"|"USED"|"UNKNOWN"|null,"shoeSize":string|null,"shoeSizeSystem":string|null,"width":string|null,"footwearType":string|null,"accessoryType":string|null,"accessoryDimensions":string|null,"accessoryMaterial":string|null,"title":string|null,"description":string|null,"visibleText":string[],"warnings":string[],"conflicts":string[],"multipleDifferentItems":boolean,"reviewPhotoSet":boolean}

Rules:
- Treat output as editable suggestions, not facts.
- Do not invent brand, size, composition, measurements, authenticity, or condition.
- Prefer readable label text over a visual guess.
- Leave unavailable information null.
- If evidence conflicts, list it in conflicts and leave the field null.
- Do not infer exact physical measurements from ordinary photos.
- Do not convert between sizing systems. Preserve the original label value.
- Do not identify a person or infer sensitive personal characteristics from photos that contain models.
- If photos appear to contain multiple different items, set multipleDifferentItems and reviewPhotoSet to true. Do not split them into multiple records.
- This is not automotive or industrial identification. Never return vehicle make, model, year, VIN, engine, fitment, OEM part numbers, voltage, or industrial specifications.`;

type JsonRecord = Record<string, unknown>;

@Injectable()
export class FashionImageAnalysisService {
  private readonly logger = new Logger(FashionImageAnalysisService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly userOrgs: UserOrganizationService,
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly openai: OpenAiService,
    private readonly aiRunLogs: AiRunLogService,
    private readonly modelRouter: ModelRouter,
    private readonly taxonomy: EbayTaxonomyApiService,
  ) {}

  async uploadPhotos(
    user: User,
    files: Express.Multer.File[] | undefined,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    if (!files?.length)
      throw new BadRequestException(
        'Choose at least one JPEG, PNG, or WebP photo of the garment.',
      );
    if (files.length > MAX_PHOTOS)
      throw new BadRequestException(
        `Upload at most ${MAX_PHOTOS} photos for one Fashion item.`,
      );

    const uploaded: Array<{ url: string; s3Key: string; filename: string }> = [];
    const errors: string[] = [];
    for (const file of files) {
      const filename = file.originalname || 'photo';
      try {
        if (!ACCEPTED_TYPES.has((file.mimetype || '').toLowerCase()))
          throw new Error(
            'Unsupported file type. Use JPEG, PNG, or WebP photos.',
          );
        if (!file.buffer || file.size > MAX_FILE_BYTES)
          throw new Error('Each photo must be present and no larger than 20 MB.');
        const canonical = await this.imageProcessor.convertBufferToWebp(
          file.buffer,
        );
        const s3Key = this.storage.buildDurableKey(
          `fashion/intake/${org.organizationId}/${randomUUID()}.webp`,
        );
        await this.storage.putObject(s3Key, canonical.buffer, 'image/webp');
        void this.storage.queueVariantGeneration(s3Key);
        uploaded.push({
          url: this.storage.getCdnUrl(s3Key),
          s3Key,
          filename,
        });
      } catch (error) {
        errors.push(
          `${filename}: ${error instanceof Error ? error.message : 'upload failed'}`,
        );
      }
    }
    if (!uploaded.length)
      throw new BadRequestException(
        errors.join(' ') || 'No Fashion photos could be stored.',
      );
    return { uploaded, errors };
  }

  async analyze(
    user: User,
    dto: AnalyzeFashionImagesDto,
    organizationId?: string,
  ) {
    await this.userOrgs.resolveOrganizationId(user.id, organizationId);
    const imageUrls = uniqueUrls(dto.imageUrls);
    if (!imageUrls.length)
      throw new BadRequestException(
        'Add at least one photo of the same garment before analysis.',
      );
    if (imageUrls.length > MAX_PHOTOS)
      throw new BadRequestException(
        `A Fashion item can include at most ${MAX_PHOTOS} photos.`,
      );

    const currentAttributes = asAttributes(dto.currentAttributes);
    const confirmedKeys = dto.confirmedKeys ?? [];
    const visionUrls = await this.visionUrls(imageUrls);
    const route = this.modelRouter.selectVisionRoute(
      {
        sku: dto.sku || 'fashion-draft',
        partName: 'fashion garment',
        partType: 'fashion_garment',
        marketplace: dto.marketplaceId || 'US',
      },
      'default',
    );
    const model =
      this.config.get<string>('FASHION_AI_MODEL') || route.model;

    try {
      this.modelRouter.assertAllowed(model);
      const response = await this.openai.chat({
        model,
        costLane: route.lane,
        imageUrls: visionUrls,
        systemPrompt: VISION_SYSTEM_PROMPT,
        userPrompt: JSON.stringify({
          imageCount: imageUrls.length,
          instruction:
            'These photos belong to one Fashion item unless they clearly show unrelated garments. Read labels when they are visible. Do not invent missing details.',
        }),
        jsonMode: true,
        temperature: 0.1,
        maxTokens: 2500,
      });
      try {
        await this.aiRunLogs.logRun({
          sku: dto.sku,
          partType: 'fashion_garment',
          marketplace: dto.marketplaceId || 'US',
          lane: route.lane,
          model: response.model,
          promptVersion: PROMPT_VERSION,
          routingPolicyVersion: route.policyVersion,
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.completionTokens,
          costUsd: response.estimatedCostUsd,
          latencyMs: response.latencyMs,
        });
      } catch (error) {
        this.logger.warn(
          `Unable to write Fashion image AI audit log: ${error instanceof Error ? error.message : error}`,
        );
      }

      const candidate = asRecord(response.content);
      const suggested = suggestedAttributes(candidate);
      const family = normalizeFashionCategoryFamily(
        suggested.categoryFamily || currentAttributes.categoryFamily,
      );
      suggested.categoryFamily = family;
      const merged = mergeFashionSuggestions({
        current: currentAttributes,
        suggested,
        confirmedKeys,
      });
      const warnings = [
        ...stringArray(candidate.warnings),
        ...stringArray(candidate.conflicts),
      ];
      const multipleItems = Boolean(candidate.multipleDifferentItems);
      if (multipleItems)
        warnings.push(
          'These photos may show more than one Fashion item. Review the photo set. The system will not split them into multiple records.',
        );
      if (!stringValue(candidate.brand))
        warnings.push('Brand was not confirmed from a readable label.');
      if (!stringValue(candidate.size) && !stringValue(candidate.shoeSize))
        warnings.push('A printed size was not confirmed from the labels.');

      const category = await this.suggestCategory(
        stringValue(candidate.categorySearchQuery) ||
          [
            stringValue(candidate.department),
            stringValue(candidate.itemType),
            stringValue(candidate.productType),
          ]
            .filter(Boolean)
            .join(' '),
        dto.marketplaceId,
      );
      const listing = buildFashionListingContent({
        brand: dto.currentBrand || stringValue(candidate.brand),
        title: dto.titleConfirmed ? dto.currentTitle : stringValue(candidate.title),
        attributes: merged.attributes,
      });
      const attributes = applyFashionAnalysisMeta(merged.attributes, {
        suggestedKeys: merged.suggestedKeys,
        confirmedKeys,
        conflicts: merged.conflicts,
        warnings,
        multipleItems,
        analysisStatus: 'suggested',
      });
      const validated = validateFashionAttributes(attributes);
      return {
        status: 'suggested' as const,
        attributes: validated.attributes,
        suggestedKeys: merged.suggestedKeys,
        conflicts: merged.conflicts,
        warnings: [...new Set([...warnings, ...validated.warnings])],
        validationErrors: validated.errors,
        multipleItems,
        reviewPhotoSet: multipleItems || Boolean(candidate.reviewPhotoSet),
        category,
        brand: dto.currentBrand?.trim() || stringValue(candidate.brand),
        conditionLabel: stringValue(candidate.conditionLabel),
        title: dto.titleConfirmed
          ? dto.currentTitle?.trim() || listing.title
          : listing.title,
        description: dto.descriptionConfirmed
          ? dto.currentDescription || listing.description
          : listing.description,
        suggestedSku: dto.sku?.trim() || suggestFashionSku(stringValue(candidate.itemType)),
        visibleText: stringArray(candidate.visibleText),
      };
    } catch (error) {
      this.logger.warn(
        `Fashion image analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      const listing = buildFashionListingContent({
        brand: dto.currentBrand,
        title: dto.currentTitle,
        attributes: currentAttributes,
      });
      const attributes = applyFashionAnalysisMeta(currentAttributes, {
        suggestedKeys: [],
        confirmedKeys,
        conflicts: [],
        warnings: [
          error instanceof Error
            ? error.message
            : 'Image analysis is unavailable. Photos are kept. Continue manually.',
        ],
        multipleItems: false,
        analysisStatus: 'failed',
      });
      return {
        status: 'failed' as const,
        attributes,
        suggestedKeys: [],
        conflicts: [],
        warnings: [
          'Identification did not complete. Photos and entered values are preserved. You can retry analysis or continue manually.',
        ],
        validationErrors: [],
        multipleItems: false,
        reviewPhotoSet: false,
        category: { categoryId: null, categoryName: null, query: null },
        brand: dto.currentBrand?.trim() || null,
        conditionLabel: null,
        title: dto.currentTitle?.trim() || listing.title,
        description: dto.currentDescription || listing.description,
        suggestedSku: dto.sku?.trim() || suggestFashionSku(),
        visibleText: [],
      };
    }
  }

  generateListing(dto: GenerateFashionListingDto) {
    const validated = validateFashionAttributes(dto.verticalAttributes ?? {});
    const content = buildFashionListingContent({
      brand: dto.brand,
      title: dto.titleConfirmed ? dto.title : undefined,
      attributes: validated.attributes,
      conditionLabel: dto.conditionLabel,
    });
    return {
      title: dto.titleConfirmed ? dto.title?.trim() || content.title : content.title,
      description: dto.descriptionConfirmed
        ? dto.description || content.description
        : content.description,
      attributes: validated.attributes,
      errors: validated.errors,
      warnings: validated.warnings,
    };
  }

  private async visionUrls(imageUrls: string[]): Promise<string[]> {
    const selected = imageUrls.slice(0, MAX_VISION_IMAGES);
    return Promise.all(
      selected.map(async (url) => {
        const key = this.storage.keyFromUrl(url) || keyFromServeUrl(url);
        if (!key) return url;
        try {
          return await this.storage.generateDownloadUrl(key);
        } catch {
          return url;
        }
      }),
    );
  }

  private async suggestCategory(query: string | null, marketplaceId?: string) {
    const q = query?.trim() || '';
    if (!q)
      return { categoryId: null as string | null, categoryName: null as string | null, query: null };
    try {
      const treeId = marketplaceId
        ? await this.taxonomy.getDefaultCategoryTreeId(marketplaceId)
        : undefined;
      const suggestions = await this.taxonomy.getCategorySuggestions(q, treeId);
      const first = suggestions[0]?.category;
      return {
        categoryId: first?.categoryId ?? null,
        categoryName: first?.categoryName ?? null,
        query: q,
      };
    } catch (error) {
      this.logger.warn(
        `Fashion category suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { categoryId: null, categoryName: null, query: q };
    }
  }
}

function uniqueUrls(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function asRecord(value: unknown): JsonRecord {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asAttributes(value: unknown): ProductAttributes {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ProductAttributes)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function suggestedAttributes(candidate: JsonRecord): ProductAttributes {
  const nested = asAttributes(candidate.verticalAttributes);
  const keys = [
    'itemType',
    'productType',
    'categoryFamily',
    'brand',
    'department',
    'size',
    'sizeSystem',
    'sizeType',
    'color',
    'secondaryColor',
    'pattern',
    'style',
    'material',
    'composition',
    'fabricType',
    'sleeveLength',
    'neckline',
    'closure',
    'length',
    'fit',
    'chestMeasurement',
    'waistMeasurement',
    'hipMeasurement',
    'lengthMeasurement',
    'inseamMeasurement',
    'measurementsUnit',
    'measurements',
    'wear',
    'stains',
    'holes',
    'pilling',
    'fading',
    'repairs',
    'missingComponents',
    'otherDefects',
    'conditionDetails',
    'shoeSize',
    'shoeSizeSystem',
    'width',
    'footwearType',
    'accessoryType',
    'accessoryDimensions',
    'accessoryMaterial',
  ];
  const attributes: ProductAttributes = { ...nested };
  for (const key of keys) {
    const value = stringValue(candidate[key]);
    if (value) attributes[key] = value;
  }
  return attributes;
}

function keyFromServeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    const marker = '/api/storage/serve/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}
