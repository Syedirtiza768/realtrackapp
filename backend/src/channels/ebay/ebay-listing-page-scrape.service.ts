import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  buildPublicEbayItemUrl,
  parseEbayListingPageHtml,
  type ScrapedListingPage,
} from './ebay-listing-page-scrape.util.js';

/**
 * Bounded public-page fetch for published-listings enrichment when Trading
 * GetItem / Browse cannot fill description, gallery, specifics, or fitment.
 *
 * Disabled by default — enable with PUBLISHED_LISTINGS_SCRAPE_ENRICH=1.
 */
@Injectable()
export class EbayListingPageScrapeService {
  private readonly logger = new Logger(EbayListingPageScrapeService.name);
  private tokens: number;
  private lastRefill = Date.now();
  private readonly maxTokens: number;
  private readonly refillPerMs: number;

  constructor() {
    const rps = Math.max(
      0.2,
      Number(process.env.PUBLISHED_LISTINGS_SCRAPE_RPS ?? '0.5') || 0.5,
    );
    this.maxTokens = rps;
    this.tokens = rps;
    this.refillPerMs = rps / 1000;
  }

  isEnabled(): boolean {
    const flag = (
      process.env.PUBLISHED_LISTINGS_SCRAPE_ENRICH ?? ''
    ).toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
  }

  private async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillPerMs,
    );
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
    await new Promise((r) => setTimeout(r, waitMs));
    this.tokens = Math.max(0, this.tokens - 1);
  }

  async scrapeListingPage(input: {
    ebayItemId: string;
    listingUrl?: string | null;
  }): Promise<ScrapedListingPage | null> {
    if (!this.isEnabled()) return null;
    if (!input.ebayItemId?.trim()) return null;

    const url = buildPublicEbayItemUrl(input.ebayItemId, input.listingUrl, {
      preferEnglishSite: true,
    });
    const timeoutMs =
      Number(process.env.PUBLISHED_LISTINGS_SCRAPE_TIMEOUT_MS ?? '15000') ||
      15_000;

    try {
      await this.acquire();
      const { data, status } = await axios.get<string>(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        responseType: 'text',
        headers: {
          'User-Agent':
            process.env.PUBLISHED_LISTINGS_SCRAPE_UA ??
            'Mozilla/5.0 (compatible; RealTrackPublishedListingsBot/1.0; +https://mhn.realtrackapp.com)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      if (status >= 400 || typeof data !== 'string' || data.length < 200) {
        return null;
      }
      // Captcha / bot walls are usually short challenge pages
      if (/captcha|robot check|splashui\/challenge/i.test(data)) {
        this.logger.warn(`eBay scrape challenge page for ${input.ebayItemId}`);
        return null;
      }
      return parseEbayListingPageHtml(data);
    } catch (e) {
      this.logger.debug(
        `Listing page scrape failed for ${input.ebayItemId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return null;
    }
  }
}
