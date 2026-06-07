import { canaryBucketForSku } from './model-router.js';

describe('canaryBucketForSku', () => {
  it('returns stable bucket for same SKU', () => {
    expect(canaryBucketForSku('MB-12345-A')).toBe(
      canaryBucketForSku('MB-12345-A'),
    );
  });

  it('returns value in 0–99 range', () => {
    const bucket = canaryBucketForSku('TEST-SKU-999');
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it('differs across SKUs (distribution smoke test)', () => {
    const buckets = new Set(
      ['A', 'B', 'C', 'SKU-1', 'SKU-2', 'PART-XYZ'].map(canaryBucketForSku),
    );
    expect(buckets.size).toBeGreaterThan(1);
  });
});
