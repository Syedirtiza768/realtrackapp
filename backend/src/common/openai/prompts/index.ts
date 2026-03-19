export { DATA_ENRICHMENT_PROMPT } from './data-enrichment.prompt.js';
export { LISTING_GENERATION_PROMPT } from './listing-generation.prompt.js';
export { COMPETITIVE_ANALYSIS_PROMPT } from './competitive-analysis.prompt.js';
export { CATEGORY_CLASSIFICATION_PROMPT } from './category-classification.prompt.js';
export { FITMENT_EXTRACTION_PROMPT } from './fitment-extraction.prompt.js';
export { IMAGE_ANALYSIS_PROMPT } from './image-analysis.prompt.js';
export { CROSS_REFERENCE_PROMPT } from './cross-reference.prompt.js';
export { PRICING_ANALYSIS_PROMPT } from './pricing-analysis.prompt.js';

import type { PromptTemplate } from '../openai.types.js';
import { DATA_ENRICHMENT_PROMPT } from './data-enrichment.prompt.js';
import { LISTING_GENERATION_PROMPT } from './listing-generation.prompt.js';
import { COMPETITIVE_ANALYSIS_PROMPT } from './competitive-analysis.prompt.js';
import { CATEGORY_CLASSIFICATION_PROMPT } from './category-classification.prompt.js';
import { FITMENT_EXTRACTION_PROMPT } from './fitment-extraction.prompt.js';
import { IMAGE_ANALYSIS_PROMPT } from './image-analysis.prompt.js';
import { CROSS_REFERENCE_PROMPT } from './cross-reference.prompt.js';
import { PRICING_ANALYSIS_PROMPT } from './pricing-analysis.prompt.js';

/**
 * Registry of all prompt templates, keyed by name.
 */
export const PROMPT_REGISTRY: Record<string, PromptTemplate> = {
  [DATA_ENRICHMENT_PROMPT.name]: DATA_ENRICHMENT_PROMPT,
  [LISTING_GENERATION_PROMPT.name]: LISTING_GENERATION_PROMPT,
  [COMPETITIVE_ANALYSIS_PROMPT.name]: COMPETITIVE_ANALYSIS_PROMPT,
  [CATEGORY_CLASSIFICATION_PROMPT.name]: CATEGORY_CLASSIFICATION_PROMPT,
  [FITMENT_EXTRACTION_PROMPT.name]: FITMENT_EXTRACTION_PROMPT,
  [IMAGE_ANALYSIS_PROMPT.name]: IMAGE_ANALYSIS_PROMPT,
  [CROSS_REFERENCE_PROMPT.name]: CROSS_REFERENCE_PROMPT,
  [PRICING_ANALYSIS_PROMPT.name]: PRICING_ANALYSIS_PROMPT,
};

/**
 * Render a prompt template by replacing {{variable}} placeholders.
 */
export function renderPrompt(
  template: PromptTemplate,
  variables: Record<string, string>,
): { systemPrompt: string; userPrompt: string } {
  let systemPrompt = template.systemPrompt;
  let userPrompt = template.userPrompt;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    systemPrompt = systemPrompt.replaceAll(placeholder, value);
    userPrompt = userPrompt.replaceAll(placeholder, value);
  }

  return { systemPrompt, userPrompt };
}
