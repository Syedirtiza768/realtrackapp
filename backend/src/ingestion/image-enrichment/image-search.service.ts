import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export interface WebImageResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  source: string;
  hostPage: string;
  width: number;
  height: number;
  format: string;
}

/**
 * ImageSearchService — fetches product images from multiple web sources.
 *
 * Supports:
 *  - Bing Image Search API (primary)
 *  - Google Custom Search API (fallback)
 *  - Structured OEM catalog URL generation
 */
@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  private readonly bingKey: string;
  private readonly bingEndpoint: string;
  private readonly googleKey: string;
  private readonly googleCx: string;

  constructor(private readonly config: ConfigService) {
    this.bingKey = this.config.get<string>('BING_IMAGE_SEARCH_KEY', '');
    this.bingEndpoint = this.config.get<string>(
      'BING_IMAGE_SEARCH_ENDPOINT',
      'https://api.bing.microsoft.com/v7.0/images/search',
    );
    this.googleKey = this.config.get<string>('GOOGLE_CUSTOM_SEARCH_KEY', '');
    this.googleCx = this.config.get<string>('GOOGLE_CUSTOM_SEARCH_CX', '');
  }

  /**
   * Search for product images using all available providers.
   */
  async search(
    queries: string[],
    options: { maxPerQuery?: number; minWidth?: number } = {},
  ): Promise<WebImageResult[]> {
    const maxPerQuery = options.maxPerQuery ?? 8;
    const allResults: WebImageResult[] = [];

    for (const query of queries) {
      try {
        let results: WebImageResult[] = [];

        if (this.bingKey) {
          results = await this.searchBing(query, maxPerQuery);
        } else if (this.googleKey && this.googleCx) {
          results = await this.searchGoogle(query, maxPerQuery);
        }

        // Generate OEM catalog URLs as supplement
        const oemResults = this.generateOemCatalogUrls(query);
        results.push(...oemResults);

        allResults.push(...results);
      } catch (err) {
        this.logger.warn(`Image search failed for query "${query}": ${err}`);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  /**
   * Search Bing Image Search API v7.
   */
  private async searchBing(
    query: string,
    count: number,
  ): Promise<WebImageResult[]> {
    try {
      const response = await axios.get(this.bingEndpoint, {
        headers: { 'Ocp-Apim-Subscription-Key': this.bingKey },
        params: {
          q: query,
          count,
          imageType: 'Photo',
          size: 'Large',
          aspect: 'Square',
          safeSearch: 'Strict',
          minWidth: 500,
          minHeight: 500,
        },
        timeout: 10_000,
      });

      const values = response.data?.value ?? [];
      return values.map((img: Record<string, unknown>) => ({
        url: String(img.contentUrl ?? ''),
        thumbnailUrl: String(img.thumbnailUrl ?? ''),
        title: String(img.name ?? ''),
        source: 'bing_image_search',
        hostPage: String(img.hostPageUrl ?? ''),
        width: Number(img.width ?? 0),
        height: Number(img.height ?? 0),
        format: this.inferFormat(String(img.encodingFormat ?? img.contentUrl ?? '')),
      }));
    } catch (err) {
      this.logger.warn(`Bing image search error: ${err}`);
      return [];
    }
  }

  /**
   * Search Google Custom Search API (Image mode).
   */
  private async searchGoogle(
    query: string,
    count: number,
  ): Promise<WebImageResult[]> {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: this.googleKey,
            cx: this.googleCx,
            q: query,
            searchType: 'image',
            num: Math.min(count, 10),
            imgSize: 'xlarge',
            safe: 'active',
          },
          timeout: 10_000,
        },
      );

      const items = response.data?.items ?? [];
      return items.map((item: Record<string, unknown>) => {
        const image = (item.image ?? {}) as Record<string, unknown>;
        return {
          url: String(item.link ?? ''),
          thumbnailUrl: String(image.thumbnailLink ?? ''),
          title: String(item.title ?? ''),
          source: 'google_custom_search',
          hostPage: String(image.contextLink ?? ''),
          width: Number(image.width ?? 0),
          height: Number(image.height ?? 0),
          format: this.inferFormat(String(item.link ?? '')),
        };
      });
    } catch (err) {
      this.logger.warn(`Google image search error: ${err}`);
      return [];
    }
  }

  /**
   * Generate structured OEM catalog URLs for known manufacturers.
   */
  private generateOemCatalogUrls(query: string): WebImageResult[] {
    // Extract brand-like tokens from the query for structured URL patterns
    const tokens = query.toLowerCase().split(/\s+/);
    const results: WebImageResult[] = [];

    // Map known brands to their catalog URL patterns
    const brandPatterns: Record<string, string> = {
      dorman: 'https://www.dormanproducts.com/p-{pn}',
      moog: 'https://www.moogparts.com/parts/{pn}',
      acdelco: 'https://www.acdelco.com/parts/{pn}',
      bosch: 'https://www.boschautoparts.com/en/auto/{pn}',
      denso: 'https://www.densoautoparts.com/products/{pn}',
      ngk: 'https://www.ngksparkplugs.com/en/product-detail/{pn}',
      gates: 'https://www.gates.com/us/en/search/{pn}',
      motorcraft: 'https://parts.ford.com/shop/en/us/{pn}',
    };

    for (const [brand, pattern] of Object.entries(brandPatterns)) {
      if (tokens.some((t) => t.includes(brand))) {
        // Extract part number-like tokens (alphanumeric with dashes)
        const pnToken = tokens.find((t) => /^[a-z0-9]{3,}[-]?[a-z0-9]+$/i.test(t));
        if (pnToken) {
          results.push({
            url: pattern.replace('{pn}', pnToken.toUpperCase()),
            thumbnailUrl: '',
            title: `OEM ${brand} ${pnToken}`,
            source: `oem_${brand}`,
            hostPage: pattern.replace('{pn}', pnToken.toUpperCase()),
            width: 1200,
            height: 1200,
            format: 'jpg',
          });
        }
      }
    }

    return results;
  }

  private inferFormat(urlOrType: string): string {
    const lower = urlOrType.toLowerCase();
    if (lower.includes('png')) return 'png';
    if (lower.includes('webp')) return 'webp';
    if (lower.includes('gif')) return 'gif';
    return 'jpg';
  }
}
