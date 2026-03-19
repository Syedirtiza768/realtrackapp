/**
 * templateApi — Typed frontend client for listing template CRUD + AI generation.
 *
 * Backend: /api/templates
 */

import { authGet, authPost, authDelete, fetchWithAuth } from './authApi';

const BASE = '/api/templates';

/* ── Types ── */

export interface ListingTemplate {
  id: string;
  name: string;
  description: string | null;
  channel: string | null;
  category: string | null;
  templateType: 'description' | 'title' | 'full';
  content: string;
  css: string | null;
  previewImage: string | null;
  variables: Record<string, unknown>[];
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  channel?: string;
  category?: string;
  templateType?: 'description' | 'title' | 'full';
  content: string;
  css?: string;
  variables?: Record<string, unknown>[];
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  channel?: string;
  category?: string;
  templateType?: 'description' | 'title' | 'full';
  content?: string;
  css?: string;
  variables?: Record<string, unknown>[];
  isDefault?: boolean;
  active?: boolean;
}

export interface TemplateQueryParams {
  channel?: string;
  templateType?: string;
  active?: string;
}

export interface TemplateGenerationResult {
  renderedHtml: string;
  generation: {
    title: string;
    subtitle: string | null;
    description: string;
    itemSpecifics: Record<string, string>;
    bulletPoints: string[];
    searchTerms: string[];
    pricePositioning: {
      suggestedPrice: number | null;
      rationale: string | null;
    };
  };
}

/* ── CRUD ── */

/**
 * List templates with optional filters.
 */
export function getTemplates(params?: TemplateQueryParams): Promise<ListingTemplate[]> {
  const query = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
    : '';
  return authGet(`${BASE}${query}`);
}

/**
 * Get a single template by ID.
 */
export function getTemplate(id: string): Promise<ListingTemplate> {
  return authGet(`${BASE}/${id}`);
}

/**
 * Create a new listing template.
 */
export function createTemplate(input: CreateTemplateInput): Promise<ListingTemplate> {
  return authPost(`${BASE}`, input);
}

/**
 * Update an existing template.
 */
export function updateTemplate(id: string, input: UpdateTemplateInput): Promise<ListingTemplate> {
  return fetchWithAuth(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }) as Promise<ListingTemplate>;
}

/**
 * Delete a template.
 */
export function deleteTemplate(id: string): Promise<void> {
  return authDelete(`${BASE}/${id}`);
}

/* ── Rendering & Generation ── */

/**
 * Render a template preview with provided variables.
 */
export function renderTemplatePreview(
  id: string,
  variables: Record<string, unknown>,
): Promise<{ html: string; css: string | null }> {
  return authPost(`${BASE}/${id}/preview`, { variables });
}

/**
 * Generate AI listing content using a template + product data.
 */
export function generateFromTemplate(
  id: string,
  productData: Record<string, unknown>,
  categoryName?: string,
  condition?: string,
): Promise<TemplateGenerationResult> {
  return authPost(`${BASE}/${id}/generate`, { productData, categoryName, condition });
}
