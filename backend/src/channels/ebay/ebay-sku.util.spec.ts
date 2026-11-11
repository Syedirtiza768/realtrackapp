import { conflictSafeSkuFor } from './ebay-sku.util.js';

describe('conflictSafeSkuFor', () => {
  it('keeps the historical BLAP fallback for BLA SKUs', () => {
    expect(conflictSafeSkuFor('BLA-19279')).toBe('BLAP-19279');
  });

  it('derives a deterministic bounded fallback for imported SKU families', () => {
    const canonical = 'FORD-8250-RED-RS-01';
    const alternate = conflictSafeSkuFor(canonical);
    expect(alternate).toMatch(/-RT[A-Z0-9]{7}$/);
    expect(alternate).not.toBe(canonical);
    expect(conflictSafeSkuFor(canonical)).toBe(alternate);
    expect(alternate?.length).toBeLessThanOrEqual(50);
  });

  it('derives distinct deterministic variants when the first fallback is occupied', () => {
    const canonical = 'FORD-8250-RED-RS-01';
    const first = conflictSafeSkuFor(canonical);
    const second = conflictSafeSkuFor(canonical, 1);
    expect(second).toMatch(/-RT[A-Z0-9]{7}-1$/);
    expect(second).not.toBe(first);
  });

  it('rejects invalid SKUs instead of inventing a remote key', () => {
    expect(conflictSafeSkuFor('SKU WITH SPACES')).toBeNull();
  });
});
