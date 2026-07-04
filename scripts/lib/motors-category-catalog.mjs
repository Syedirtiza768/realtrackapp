/**
 * Motors leaf category catalog — maps AI / keyword output to real eBay category IDs.
 * Source: shared/motors-leaf-categories.json (extracted from pipeline keyword rules).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveCatalogPath() {
  const candidates = [
    path.resolve(__dirname, '../../shared/motors-leaf-categories.json'),
    path.resolve(__dirname, '../../config/motors-leaf-categories.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const CATALOG_PATH = resolveCatalogPath();

/** @type {{ id: string; name: string }[]} */
let catalog = [];

function loadCatalog() {
  if (catalog.length) return catalog;
  catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  return catalog;
}

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text) {
  return new Set(norm(text).split(' ').filter((t) => t.length > 1));
}

function scoreNameMatch(candidate, targetName) {
  const a = norm(candidate);
  const b = norm(targetName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  const precision = overlap / ta.size;
  const recall = overlap / tb.size;
  return (2 * precision * recall) / (precision + recall + 0.001);
}

/**
 * Resolve a free-text category name (from AI or supplier) to a catalog entry.
 * @returns {{ categoryId: string; categoryName: string; confidence: number } | null}
 */
export function resolveCategoryByName(name, minScore = 0.55) {
  const items = loadCatalog();
  const raw = String(name || '').trim();
  if (!raw) return null;

  let best = null;
  let bestScore = 0;
  for (const entry of items) {
    const score = scoreNameMatch(raw, entry.name);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best || bestScore < minScore) return null;
  return {
    categoryId: best.id,
    categoryName: best.name,
    confidence: Math.round(bestScore * 100) / 100,
  };
}

export function getMotorsLeafCategories() {
  return loadCatalog();
}

/** Compact list for AI system prompts (~55 leaf categories). */
export function getCategoryNamesForPrompt() {
  return loadCatalog()
    .map((c) => `- ${c.name}`)
    .join('\n');
}
