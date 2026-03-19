import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAiService } from '../openai.service.js';
import { renderPrompt } from '../prompts/index.js';
import { CROSS_REFERENCE_PROMPT } from '../prompts/cross-reference.prompt.js';
import { CrossReference } from '../../../listings/entities/cross-reference.entity.js';
import type { OpenAiChatResponse } from '../openai.types.js';

/* ── Types ── */

export interface CrossReferencePart {
  oemNumbers: string[];
  aftermarketNumbers: string[];
  brand: string | null;
  mpn: string | null;
  partType: string | null;
  confidence: number;
}

export interface CrossReferenceResult {
  parts: CrossReferencePart[];
  totalOemNumbers: number;
  totalAftermarketNumbers: number;
  totalCrossReferences: number;
  upsertedCount: number;
  rawResponse: OpenAiChatResponse;
}

/**
 * CrossReferencePipeline — Processes raw supplier data through OpenAI
 * to extract and standardize OEM ↔ aftermarket cross-references.
 *
 * Pipeline: raw text/CSV → OpenAI → structured parts → upsert cross_references table
 */
@Injectable()
export class CrossReferencePipeline {
  private readonly logger = new Logger(CrossReferencePipeline.name);

  constructor(
    private readonly openai: OpenAiService,
    @InjectRepository(CrossReference)
    private readonly crossRefRepo: Repository<CrossReference>,
  ) {}

  /**
   * Process raw supplier data and extract cross-references.
   *
   * @param rawText  Free-text, CSV rows, or part number lists
   * @param masterProductId  Link references to a specific master product
   */
  async processRawSupplierData(
    rawText: string,
    masterProductId: string,
  ): Promise<CrossReferenceResult> {
    this.logger.log(
      `Processing cross-reference data (${rawText.length} chars)${masterProductId ? ` for product ${masterProductId}` : ''}`,
    );

    const { systemPrompt, userPrompt } = renderPrompt(
      CROSS_REFERENCE_PROMPT,
      { rawData: rawText },
    );

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: CROSS_REFERENCE_PROMPT.temperature,
      maxTokens: CROSS_REFERENCE_PROMPT.maxTokens,
    });

    const parsed = response.content as Record<string, unknown>;
    const rawParts = Array.isArray(parsed.parts)
      ? (parsed.parts as Record<string, unknown>[])
      : [];

    // Normalize
    const parts: CrossReferencePart[] = rawParts.map((p) => ({
      oemNumbers: this.toStrArray(p.oem_numbers ?? p.oemNumbers),
      aftermarketNumbers: this.toStrArray(
        p.aftermarket_numbers ?? p.aftermarketNumbers,
      ),
      brand: this.str(p.brand),
      mpn: this.str(p.mpn),
      partType: this.str(p.part_type ?? p.partType),
      confidence: typeof p.confidence === 'number' ? p.confidence : 0,
    }));

    // Upsert cross_references
    let upsertedCount = 0;

    for (const part of parts) {
      for (const oem of part.oemNumbers) {
        // OEM reference
        await this.upsertRef(
          masterProductId,
          'oem',
          oem,
          part.brand,
          'openai',
        );
        upsertedCount++;

        // Cross-reference: each aftermarket ↔ this OEM
        for (const aftermarket of part.aftermarketNumbers) {
          await this.upsertRef(
            masterProductId,
            'alternate',
            aftermarket,
            part.brand,
            'openai',
          );
          upsertedCount++;

          await this.upsertRef(
            masterProductId,
            'interchange',
            `${oem}↔${aftermarket}`,
            part.brand,
            'openai',
          );
          upsertedCount++;
        }
      }
    }

    this.logger.log(
      `Cross-reference pipeline complete: ${parts.length} parts, ${upsertedCount} references upserted`,
    );

    return {
      parts,
      totalOemNumbers: parts.reduce((s, p) => s + p.oemNumbers.length, 0),
      totalAftermarketNumbers: parts.reduce(
        (s, p) => s + p.aftermarketNumbers.length,
        0,
      ),
      totalCrossReferences: upsertedCount,
      upsertedCount,
      rawResponse: response,
    };
  }

  /**
   * Process structured part data (e.g. from a CSV import) rather than free text.
   */
  async processStructuredParts(
    parts: Array<{
      oemNumber?: string;
      aftermarketNumber?: string;
      brand?: string;
      partType?: string;
    }>,
    masterProductId: string,
  ): Promise<{ upsertedCount: number }> {
    let count = 0;

    for (const part of parts) {
      if (part.oemNumber) {
        await this.upsertRef(
          masterProductId,
          'oem',
          part.oemNumber,
          part.brand ?? null,
          'csv-import',
        );
        count++;
      }
      if (part.aftermarketNumber) {
        await this.upsertRef(
          masterProductId,
          'alternate',
          part.aftermarketNumber,
          part.brand ?? null,
          'csv-import',
        );
        count++;
      }
      if (part.oemNumber && part.aftermarketNumber) {
        await this.upsertRef(
          masterProductId,
          'interchange',
          `${part.oemNumber}↔${part.aftermarketNumber}`,
          part.brand ?? null,
          'csv-import',
        );
        count++;
      }
    }

    return { upsertedCount: count };
  }

  /* ─── Private helpers ─── */

  private async upsertRef(
    masterProductId: string,
    referenceType: CrossReference['referenceType'],
    partNumber: string,
    brand: string | null,
    source: string,
  ): Promise<void> {
    const existing = await this.crossRefRepo.findOne({
      where: {
        masterProductId,
        referenceType,
        partNumber,
      },
    });

    if (existing) {
      existing.brand = brand ?? existing.brand;
      existing.source = source;
      await this.crossRefRepo.save(existing);
    } else {
      const ref = this.crossRefRepo.create({
        masterProductId,
        referenceType,
        partNumber,
        brand,
        source,
      });
      await this.crossRefRepo.save(ref);
    }
  }

  private str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  }

  private toStrArray(v: unknown): string[] {
    if (Array.isArray(v)) {
      return v
        .map((i) => (typeof i === 'string' ? i.trim() : ''))
        .filter(Boolean);
    }
    return [];
  }
}
