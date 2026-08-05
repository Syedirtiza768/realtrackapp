import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { StorageService } from './storage.service';

describe('StorageService.mirroredObjectKey', () => {
  const makeService = (prefix = '') =>
    new StorageService(
      {
        get: (key: string, fallback?: string) => {
          if (key === 'AWS_S3_BUCKET' || key === 'S3_BUCKET') return 'test-bucket';
          if (key === 'AWS_S3_PREFIX' || key === 'S3_PREFIX') return prefix;
          if (key === 'AWS_S3_REGION' || key === 'S3_REGION') return 'us-east-1';
          return fallback;
        },
      } as unknown as ConfigService,
      { add: async () => undefined } as unknown as import('bullmq').Queue,
    );

  it('uses a source-hash key so two different sources at the same index diverge', () => {
    const svc = makeService();
    const ns = 'inventory/listing-1';
    const first = svc.mirroredObjectKey(ns, 'temp/aaa-111.jpg', '.jpg');
    const corrected = svc.mirroredObjectKey(ns, 'temp/bbb-222.jpg', '.jpg');

    expect(first).not.toEqual(corrected);
    expect(first).toMatch(/^catalog-images\/inventory\/listing-1\/[a-f0-9]{20}\.jpg$/);
    expect(corrected).toMatch(
      /^catalog-images\/inventory\/listing-1\/[a-f0-9]{20}\.jpg$/,
    );
  });

  it('is stable for the same source (pipeline re-run skipExisting)', () => {
    const svc = makeService();
    const source = 'https://cdn.example.com/parts/abc.jpg';
    const a = svc.mirroredObjectKey('pipeline/job-9', source, '.jpg');
    const b = svc.mirroredObjectKey('pipeline/job-9', source, '.jpg');
    const digest = createHash('sha256').update(source).digest('hex').slice(0, 20);
    expect(a).toBe(b);
    expect(a).toBe(`catalog-images/pipeline/job-9/${digest}.jpg`);
  });

  it('respects AWS_S3_PREFIX', () => {
    const svc = makeService('mhn/');
    const key = svc.mirroredObjectKey('catalog-product/p1', 'temp/x.webp', '.webp');
    expect(key.startsWith('mhn/catalog-images/')).toBe(true);
  });
});
