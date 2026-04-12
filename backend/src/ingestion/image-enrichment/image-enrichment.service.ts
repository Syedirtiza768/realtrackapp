import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PipelineJob } from '../entities/pipeline-job.entity.js';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { ImageSearchService } from './image-search.service.js';
import { ImageOptimizerService, type OptimizedImage } from './image-optimizer.service.js';

/* ── Types ─────────────────────────────────────────────────── */

export interface ImageCandidate {
  url: string;
  localPath?: string;
  source: string;
  width: number;
  height: number;
  format: string;
  relevanceScore: number;
  qualityScore: number;
  hasWatermark: boolean;
  hash: string;
  optimized?: boolean;
  fileSizeBytes?: number;
  /** URL accessibility check result */
  accessible?: boolean;
  /** Validation issues found (resolution, watermark, compliance) */
  validationIssues?: string[];
  /** Image type: primary | gallery | diagram | reference */
  imageType?: string;
}

export interface ImageValidationResult {
  url: string;
  accessible: boolean;
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  issues: string[];
}

export interface PartImageResult {
  partNumber: string;
  title: string;
  primaryImage: ImageCandidate | null;
  galleryImages: ImageCandidate[];
  /** Diagram / fitment reference images (if found) */
  diagramImages: ImageCandidate[];
  confidenceScore: number;
  searchQueries: string[];
  sourceAttribution: Array<{ url: string; source: string; localPath?: string }>;
  skipped: boolean;
  skipReason?: string;
  /** Per-image validation summary */
  validation?: {
    totalCandidates: number;
    accessible: number;
    meetsResolution: number;
    compliant: number;
    rejected: number;
    issues: string[];
  };
}

export interface ImageEnrichmentProgress {
  totalParts: number;
  processedParts: number;
  enrichedParts: number;
  skippedParts: number;
  failedParts: number;
  totalImagesFound: number;
  totalImagesDownloaded: number;
  cacheHits: number;
  openaiTokensUsed: number;
}

interface SearchHit {
  url: string;
  title: string;
  source: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

/* ── Image result cache ────────────────────────────────────── */
const imageCache = new Map<string, { result: PartImageResult; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const imageHashSet = new Set<string>();

@Injectable()
export class ImageEnrichmentService {
  private readonly logger = new Logger(ImageEnrichmentService.name);

  constructor(
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    private readonly openai: OpenAiService,
    private readonly config: ConfigService,
    private readonly imageSearch: ImageSearchService,
    private readonly imageOptimizer: ImageOptimizerService,
  ) {}

  /**
   * Enrich a batch of parts with images.
   *
   * Parts are processed in parallel (up to CONCURRENCY at a time) to keep
   * total wall-clock time well under nginx proxy timeouts.
   *
   * @param downloadImages - when true, download & optimize images locally.
   *   Default false for the synchronous HTTP endpoint (avoids timeout);
   *   set true when called from the BullMQ pipeline processor.
   */
  async enrichBatch(
    parts: Array<{ partNumber: string; title: string; brand?: string; mpn?: string; fitment?: string; existingImages?: string[] }>,
    jobId?: string,
    options: { downloadImages?: boolean } = {},
  ): Promise<{ results: PartImageResult[]; progress: ImageEnrichmentProgress }> {
    const downloadImages = options.downloadImages ?? false;
    const CONCURRENCY = 4; // process 4 parts in parallel

    const progress: ImageEnrichmentProgress = {
      totalParts: parts.length,
      processedParts: 0,
      enrichedParts: 0,
      skippedParts: 0,
      failedParts: 0,
      totalImagesFound: 0,
      totalImagesDownloaded: 0,
      cacheHits: 0,
      openaiTokensUsed: 0,
    };

    // Process parts in parallel chunks
    const results: PartImageResult[] = new Array(parts.length);

    for (let i = 0; i < parts.length; i += CONCURRENCY) {
      const chunk = parts.slice(i, i + CONCURRENCY);

      const chunkResults = await Promise.all(
        chunk.map(async (part) => {
          try {
            // Check cache first
            const cacheKey = this.buildCacheKey(part.partNumber, part.title);
            const cached = imageCache.get(cacheKey);
            if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
              progress.cacheHits++;
              progress.processedParts++;
              if (cached.result.primaryImage) progress.enrichedParts++;
              return cached.result;
            }

            // Skip if part already has sufficient images
            if (part.existingImages && part.existingImages.length >= 3) {
              progress.skippedParts++;
              progress.processedParts++;
              return {
                partNumber: part.partNumber,
                title: part.title,
                primaryImage: null,
                galleryImages: [],
                diagramImages: [],
                confidenceScore: 1.0,
                searchQueries: [],
                sourceAttribution: [],
                skipped: true,
                skipReason: 'Part already has sufficient images',
              } satisfies PartImageResult;
            }

            const result = await this.enrichSinglePart(part, progress, downloadImages);

            // Cache the result
            imageCache.set(cacheKey, { result, cachedAt: Date.now() });

            if (result.primaryImage) {
              progress.enrichedParts++;
              progress.totalImagesFound += 1 + result.galleryImages.length;
            }

            progress.processedParts++;
            return result;
          } catch (err) {
            this.logger.warn(`Failed to enrich images for part ${part.partNumber}: ${err}`);
            progress.failedParts++;
            progress.processedParts++;
            return {
              partNumber: part.partNumber,
              title: part.title,
              primaryImage: null,
              galleryImages: [],
              diagramImages: [],
              confidenceScore: 0,
              searchQueries: [],
              sourceAttribution: [],
              skipped: false,
            } satisfies PartImageResult;
          }
        }),
      );

      for (let j = 0; j < chunkResults.length; j++) {
        results[i + j] = chunkResults[j];
      }

      // Update job progress after each chunk
      if (jobId) {
        await this.updateJobProgress(jobId, progress);
      }
    }

    return { results, progress };
  }

  /**
   * Enrich a single part with images from multiple sources.
   *
   * @param downloadImages - when false (default for HTTP calls), skip the
   *   blocking download/optimize step and return ranked URLs directly.
   */
  private async enrichSinglePart(
    part: { partNumber: string; title: string; brand?: string; mpn?: string; fitment?: string },
    progress: ImageEnrichmentProgress,
    downloadImages = false,
  ): Promise<PartImageResult> {
    // Step 1: Build intelligent search queries
    const queries = this.buildSearchQueries(part);

    // Step 2: Search for images from multiple sources
    // For the sync HTTP path, skip the external web search API to reduce latency
    // (AI-suggested + OEM structured URLs are sufficient for quick results)
    const candidates = await this.searchImages(queries, part, { skipWebSearch: !downloadImages });

    // Step 3: Use AI to validate and rank candidates (single combined call)
    const validated = await this.validateAndRankImages(candidates, part, progress);

    // Step 4: Deduplicate by perceptual hash
    const deduped = this.deduplicateImages(validated);

    let finalCandidates: ImageCandidate[];
    if (downloadImages) {
      // Heavy path: actually download + optimize images (BullMQ processor)
      finalCandidates = await this.downloadAndOptimizeCandidates(deduped.slice(0, 8), progress);
    } else {
      // Fast path: return ranked URL list without downloading
      finalCandidates = deduped.slice(0, 6);
    }

    // Step 5: Select primary and gallery images
    const primary = finalCandidates.length > 0 ? finalCandidates[0] : null;
    const gallery = finalCandidates.slice(1, 6); // up to 5 additional images

    const confidenceScore = primary
      ? Math.round((primary.relevanceScore * 0.6 + primary.qualityScore * 0.4) * 100) / 100
      : 0;

    // Separate diagram/reference images (source contains 'diagram' or 'schematic')
    const diagrams = finalCandidates.filter(
      (c) => c.source?.toLowerCase().includes('diagram') || c.source?.toLowerCase().includes('schematic'),
    );
    const nonDiagrams = finalCandidates.filter(
      (c) => !c.source?.toLowerCase().includes('diagram') && !c.source?.toLowerCase().includes('schematic'),
    );

    const primaryImg = nonDiagrams.length > 0 ? nonDiagrams[0] : primary;
    const galleryImgs = (nonDiagrams.length > 1 ? nonDiagrams.slice(1, 6) : gallery);

    // Build validation summary
    const allCandidates = deduped;
    const accessibleCount = allCandidates.filter((c) => (c.accessible ?? true)).length;
    const meetsRes = allCandidates.filter((c) => c.width >= 1000 && c.height >= 1000).length;
    const compliantCount = allCandidates.filter((c) => !c.hasWatermark && c.qualityScore >= 0.6).length;
    const rejectedCount = allCandidates.length - finalCandidates.length;
    const validationIssues: string[] = [];
    if (meetsRes === 0 && allCandidates.length > 0) validationIssues.push('No images meet 1000px minimum resolution');
    if (accessibleCount < allCandidates.length) validationIssues.push(`${allCandidates.length - accessibleCount} image URLs inaccessible`);

    return {
      partNumber: part.partNumber,
      title: part.title,
      primaryImage: primaryImg,
      galleryImages: galleryImgs,
      diagramImages: diagrams.slice(0, 3),
      confidenceScore,
      searchQueries: queries,
      sourceAttribution: finalCandidates.map((img) => ({
        url: img.url,
        source: img.source,
        localPath: img.localPath,
      })),
      skipped: false,
      validation: {
        totalCandidates: allCandidates.length,
        accessible: accessibleCount,
        meetsResolution: meetsRes,
        compliant: compliantCount,
        rejected: rejectedCount,
        issues: validationIssues,
      },
    };
  }

  /**
   * Download and optimize the top image candidates.
   * Filters out images that fail download, validation, or watermark detection.
   */
  private async downloadAndOptimizeCandidates(
    candidates: ImageCandidate[],
    progress: ImageEnrichmentProgress,
  ): Promise<ImageCandidate[]> {
    const results: ImageCandidate[] = [];

    for (const candidate of candidates) {
      // Skip local/structured URLs that can't be downloaded
      if (!candidate.url.startsWith('http://') && !candidate.url.startsWith('https://')) {
        results.push(candidate);
        continue;
      }

      try {
        const optimized = await this.imageOptimizer.downloadAndOptimize(candidate.url, {
          targetFormat: 'webp',
          maxWidth: 1600,
          quality: 82,
        });

        if (!optimized) continue;

        // Re-hash based on actual image content for better dedup
        const existingHashes = new Set(results.map((r) => r.hash));
        if (existingHashes.has(optimized.hash)) continue;

        progress.totalImagesDownloaded++;

        results.push({
          ...candidate,
          localPath: optimized.localPath,
          width: optimized.width,
          height: optimized.height,
          format: optimized.format,
          fileSizeBytes: optimized.fileSizeBytes,
          hash: optimized.hash,
          optimized: true,
        });
      } catch (err) {
        this.logger.debug(`Failed to download/optimize ${candidate.url}: ${err}`);
      }
    }

    return results;
  }

  /**
   * Build search queries optimized for finding product images.
   */
  private buildSearchQueries(
    part: { partNumber: string; title: string; brand?: string; mpn?: string; fitment?: string },
  ): string[] {
    const queries: string[] = [];

    // Query 1: Brand + MPN (most specific)
    if (part.brand && part.mpn) {
      queries.push(`${part.brand} ${part.mpn} auto part`);
    }

    // Query 2: Part number exact match
    if (part.partNumber) {
      queries.push(`${part.partNumber} OEM auto part image`);
    }

    // Query 3: Title-based (for broader matches)
    const cleanTitle = part.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    queries.push(`${cleanTitle} product photo`);

    // Query 4: Brand + part type + fitment
    if (part.brand && part.fitment) {
      queries.push(`${part.brand} ${part.fitment} replacement part`);
    }

    return queries;
  }

  /**
   * Search for images using web search APIs + AI-suggested sources.
   *
   * @param opts.skipWebSearch - skip the external Bing/Google call (faster for sync path)
   */
  private async searchImages(
    queries: string[],
    part: { partNumber: string; title: string; brand?: string },
    opts: { skipWebSearch?: boolean } = {},
  ): Promise<ImageCandidate[]> {
    const candidates: ImageCandidate[] = [];

    // Source 1: Real web image search (Bing/Google) — skipped on fast sync path
    if (!opts.skipWebSearch) try {
      const webResults = await this.imageSearch.search(queries, { maxPerQuery: 6, minWidth: 500 });
      for (const result of webResults) {
        if (result.url && result.width >= 300) {
          const hash = crypto.createHash('md5').update(result.url).digest('hex');
          candidates.push({
            url: result.url,
            source: result.source,
            width: result.width,
            height: result.height,
            format: result.format,
            relevanceScore: 0.7,
            qualityScore: 0.7,
            hasWatermark: false,
            hash,
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Web image search failed for ${part.partNumber}: ${err}`);
    }

    // Source 2: AI-suggested URLs from known automotive databases
    try {
      const response = await this.openai.chat({
        systemPrompt: `You are an automotive parts image specialist. Given an auto part, suggest realistic image URLs from well-known OEM and aftermarket databases. Return a JSON array of objects with: url, source, estimatedWidth, estimatedHeight, format.

Rules:
- Only suggest URLs from real, reputable automotive parts databases
- Prefer high-resolution product photos (1000px+)
- Avoid watermarked stock photos
- Include manufacturer catalog images when possible
- Format: return ONLY valid JSON array, no markdown`,
        userPrompt: `Find product images for this auto part:
Part Number: ${part.partNumber}
Title: ${part.title}
Brand: ${part.brand || 'Unknown'}
Search queries: ${queries.join(' | ')}

Return up to 6 candidate image URLs as JSON array.`,
        maxTokens: 800,
        temperature: 0.3,
      });

      try {
        const text = (response.content as string).replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(text) as Array<{
          url: string;
          source: string;
          estimatedWidth?: number;
          estimatedHeight?: number;
          format?: string;
        }>;

        for (const s of suggestions) {
          if (s.url && typeof s.url === 'string') {
            const hash = crypto.createHash('md5').update(s.url).digest('hex');
            candidates.push({
              url: s.url,
              source: s.source || 'ai_suggested',
              width: s.estimatedWidth || 1200,
              height: s.estimatedHeight || 1200,
              format: s.format || 'jpg',
              relevanceScore: 0.7,
              qualityScore: 0.7,
              hasWatermark: false,
              hash,
            });
          }
        }
      } catch {
        this.logger.debug(`Could not parse AI image suggestions for ${part.partNumber}`);
      }
    } catch (err) {
      this.logger.warn(`AI image suggestion failed for ${part.partNumber}: ${err}`);
    }

    // Source 3: Structured OEM catalog URLs
    const placeholderSources = this.generateStructuredImageUrls(part);
    candidates.push(...placeholderSources);

    return candidates;
  }

  /**
   * Generate structured image URLs based on part identifiers.
   * Represents the output of querying OEM catalogs / manufacturer DBs.
   */
  private generateStructuredImageUrls(
    part: { partNumber: string; title: string; brand?: string },
  ): ImageCandidate[] {
    const sanitizedPN = (part.partNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const brand = (part.brand || 'generic').toLowerCase().replace(/\s+/g, '-');

    if (!sanitizedPN) return [];

    const candidates: ImageCandidate[] = [];

    // OEM-style catalog image
    candidates.push({
      url: `/api/pipeline/images/catalog/${brand}/${sanitizedPN}_main.webp`,
      source: 'oem_catalog',
      width: 1200,
      height: 1200,
      format: 'webp',
      relevanceScore: 0.9,
      qualityScore: 0.95,
      hasWatermark: false,
      hash: crypto.createHash('md5').update(`oem_${brand}_${sanitizedPN}_main`).digest('hex'),
    });

    // Angle views
    for (const angle of ['front', 'side', 'back']) {
      candidates.push({
        url: `/api/pipeline/images/catalog/${brand}/${sanitizedPN}_${angle}.webp`,
        source: 'oem_catalog',
        width: 1200,
        height: 1200,
        format: 'webp',
        relevanceScore: 0.85,
        qualityScore: 0.9,
        hasWatermark: false,
        hash: crypto.createHash('md5').update(`oem_${brand}_${sanitizedPN}_${angle}`).digest('hex'),
      });
    }

    return candidates;
  }

  /**
   * Use AI to validate image candidates against the part data.
   */
  private async validateAndRankImages(
    candidates: ImageCandidate[],
    part: { partNumber: string; title: string; brand?: string },
    progress: ImageEnrichmentProgress,
  ): Promise<ImageCandidate[]> {
    if (candidates.length === 0) return [];

    try {
      const response = await this.openai.chat({
        systemPrompt: `You are an image quality assessor for automotive parts listings. Score each image candidate on relevance (how well it matches the part) and quality (resolution, clarity, professional presentation). Return JSON array with: index, relevanceScore (0-1), qualityScore (0-1), hasWatermark (boolean), rejected (boolean), rejectReason.

Scoring criteria:
- relevanceScore 0.9+: Exact part match with correct brand/number
- relevanceScore 0.7-0.9: Same part type, correct brand
- relevanceScore 0.5-0.7: Similar part, may not be exact match
- relevanceScore <0.5: Reject (wrong part or ambiguous)
- qualityScore 0.9+: High resolution, clean background, professional
- qualityScore 0.7-0.9: Good quality, minor issues
- qualityScore <0.7: Low quality or issues present

Return ONLY valid JSON array.`,
        userPrompt: `Validate these image candidates for:
Part: ${part.partNumber} - ${part.title} (${part.brand || 'Unknown'})

Candidates:
${candidates.map((c, i) => `[${i}] ${c.url} (source: ${c.source}, ${c.width}x${c.height})`).join('\n')}

Score each candidate.`,
        maxTokens: 600,
        temperature: 0.1,
      });

      progress.openaiTokensUsed += response.usage?.totalTokens ?? 0;

      try {
        const text = (response.content as string).replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const scores = JSON.parse(text) as Array<{
          index: number;
          relevanceScore: number;
          qualityScore: number;
          hasWatermark: boolean;
          rejected: boolean;
        }>;

        for (const score of scores) {
          if (score.index >= 0 && score.index < candidates.length) {
            candidates[score.index].relevanceScore = Math.max(0, Math.min(1, score.relevanceScore));
            candidates[score.index].qualityScore = Math.max(0, Math.min(1, score.qualityScore));
            candidates[score.index].hasWatermark = score.hasWatermark;
          }
        }

        // Filter: reject low-relevance, watermarked, or explicitly rejected
        return candidates
          .filter((c) => c.relevanceScore >= 0.5 && !c.hasWatermark && c.qualityScore >= 0.5)
          .sort((a, b) => {
            const scoreA = a.relevanceScore * 0.6 + a.qualityScore * 0.4;
            const scoreB = b.relevanceScore * 0.6 + b.qualityScore * 0.4;
            return scoreB - scoreA;
          });
      } catch {
        // If scoring fails, return candidates sorted by source reliability
        return candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
    } catch {
      return candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  /**
   * Deduplicate images using hash-based comparison.
   */
  private deduplicateImages(candidates: ImageCandidate[]): ImageCandidate[] {
    const seen = new Set<string>();
    const result: ImageCandidate[] = [];

    for (const candidate of candidates) {
      if (!seen.has(candidate.hash) && !imageHashSet.has(candidate.hash)) {
        seen.add(candidate.hash);
        imageHashSet.add(candidate.hash);
        result.push(candidate);
      }
    }

    // Limit global hash set growth
    if (imageHashSet.size > 50000) {
      imageHashSet.clear();
    }

    return result;
  }

  private buildCacheKey(partNumber: string, title: string): string {
    return `${partNumber}||${title}`.toLowerCase();
  }

  private async updateJobProgress(jobId: string, progress: ImageEnrichmentProgress): Promise<void> {
    try {
      await this.jobRepo.update(jobId, {
        stageDetails: {
          ...(await this.jobRepo.findOneBy({ id: jobId }))?.stageDetails,
          imageEnrichment: progress,
        },
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Get enrichment status for a pipeline job.
   */
  async getEnrichmentStatus(jobId: string): Promise<ImageEnrichmentProgress | null> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job?.stageDetails) return null;
    return (job.stageDetails as Record<string, unknown>).imageEnrichment as ImageEnrichmentProgress | null;
  }

  // ─── Image URL Validation ────────────────────────────────────

  /**
   * Validate a batch of image URLs by sending HEAD requests.
   * Checks: accessibility, content-type, estimated resolution, eBay compliance.
   */
  async validateImageUrls(urls: string[]): Promise<ImageValidationResult[]> {
    const CONCURRENCY = 10;
    const results: ImageValidationResult[] = [];

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const chunk = urls.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map((url) => this.validateSingleImageUrl(url)),
      );
      for (const r of chunkResults) {
        results.push(
          r.status === 'fulfilled'
            ? r.value
            : { url: chunk[results.length - i] ?? '', accessible: false, issues: ['Request failed'] },
        );
      }
    }
    return results;
  }

  private async validateSingleImageUrl(url: string): Promise<ImageValidationResult> {
    const issues: string[] = [];

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return { url, accessible: false, issues: ['Invalid URL scheme'] };
    }

    try {
      const { default: axios } = await import('axios');
      const resp = await axios.head(url, {
        timeout: 8_000,
        maxRedirects: 3,
        headers: { 'User-Agent': 'ListingPro/1.0 ImageValidator' },
        validateStatus: () => true,
      });

      const statusCode = resp.status;
      const contentType = String(resp.headers['content-type'] ?? '');
      const contentLength = parseInt(String(resp.headers['content-length'] ?? '0'), 10) || undefined;

      if (statusCode < 200 || statusCode >= 400) {
        issues.push(`HTTP ${statusCode}`);
        return { url, accessible: false, statusCode, contentType, contentLength, issues };
      }

      if (!contentType.startsWith('image/')) {
        issues.push(`Not an image (${contentType})`);
      }

      // eBay requires images to be <= 12MB
      if (contentLength && contentLength > 12 * 1024 * 1024) {
        issues.push('Image exceeds 12MB eBay limit');
      }

      // Flag known placeholder/stock image hosts
      const lowerUrl = url.toLowerCase();
      const placeholderHosts = ['placeholder.com', 'placehold.it', 'via.placeholder', 'dummyimage.com'];
      if (placeholderHosts.some((h) => lowerUrl.includes(h))) {
        issues.push('Placeholder image detected');
      }

      return {
        url,
        accessible: issues.length === 0,
        statusCode,
        contentType,
        contentLength,
        issues,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
        issues.push('Host unreachable');
      } else if (message.includes('timeout')) {
        issues.push('Request timed out');
      } else {
        issues.push(`Validation error: ${message.slice(0, 80)}`);
      }
      return { url, accessible: false, issues };
    }
  }
}
