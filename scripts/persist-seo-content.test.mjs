#!/usr/bin/env node
/**
 * Tests for the pure validation logic of persist-seo-content.mjs.
 * (The database steps are exercised by the script's own dry-run/backup/read-back.)
 * Run: node --test scripts/persist-seo-content.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTitle, buildUpdates } from './persist-seo-content.mjs';

const row = (overrides = {}) => ({
  'Custom Label (SKU)': 'NAPA-242-6829',
  'Fitment Status': 'verified_mvl',
  'SEO Title': 'NAPA 242-6829 Brake Caliper Front Left for Chevy Silverado 1500 GMC Sierra 1500',
  'SEO Description': '<p><b>NAPA 242-6829 Brake Caliper</b></p>',
  ...overrides,
});

test('normalizeTitle matches the catalog convention', () => {
  assert.equal(normalizeTitle('Skf BR930071 Wheel Bearing & Hub Assembly!'), 'skf br930071 wheel bearing hub assembly');
  assert.equal(normalizeTitle('  Front   Left  '), 'front left');
});

test('only validated-fitment rows are persisted', () => {
  const { updates, skipped } = buildUpdates([row(), row({ 'Custom Label (SKU)': 'NAPA-1', 'Fitment Status': 'fitment_pending' })]);
  assert.deepEqual(updates.map((u) => u.sku), ['NAPA-242-6829']);
  assert.equal(skipped.length, 0, 'a row that is simply not part of this job is not an error');
});

test('every update carries the normalized title', () => {
  const [update] = buildUpdates([row()]).updates;
  assert.equal(update.titleNormalized, normalizeTitle(update.title));
});

test('rows that fail validation are reported with a reason, never silently dropped', () => {
  const { updates, skipped } = buildUpdates([
    row({ 'Custom Label (SKU)': 'A', 'SEO Title': '' }),
    row({ 'Custom Label (SKU)': 'B', 'SEO Title': 'x'.repeat(81) }),
    row({ 'Custom Label (SKU)': 'C', 'SEO Description': '' }),
    row({ 'Custom Label (SKU)': 'D', 'SEO Description': 'y'.repeat(4001) }),
    row({ 'Custom Label (SKU)': 'E' }),
  ]);
  assert.deepEqual(updates.map((u) => u.sku), ['E']);
  assert.deepEqual(skipped, [
    { sku: 'A', reason: 'empty_title' },
    { sku: 'B', reason: 'title_over_80' },
    { sku: 'C', reason: 'empty_description' },
    { sku: 'D', reason: 'description_over_4000' },
  ]);
});

test('a duplicated SKU in the CSV is flagged rather than written twice', () => {
  const { updates, skipped } = buildUpdates([row(), row()]);
  assert.equal(updates.length, 1);
  assert.deepEqual(skipped, [{ sku: 'NAPA-242-6829', reason: 'duplicate_sku_in_csv' }]);
});

test('rows without a SKU are ignored', () => {
  assert.deepEqual(buildUpdates([row({ 'Custom Label (SKU)': '' })]), { updates: [], skipped: [] });
});
