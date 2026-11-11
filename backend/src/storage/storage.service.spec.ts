import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { StorageService } from './storage.service';

describe('StorageService.mirroredObjectKey', () => {
  const makeService = (prefix = '', bucket = 'test-bucket') =>
    new StorageService(
      {
        get: (key: string, fallback?: string) => {
          if (key === 'AWS_S3_BUCKET' || key === 'S3_BUCKET') return bucket;
          if (key === 'AWS_S3_PREFIX' || key === 'S3_PREFIX') return prefix;
          if (key === 'AWS_S3_REGION' || key === 'S3_REGION')
            return 'us-east-1';
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
    expect(first).toMatch(
      /^catalog-images\/inventory\/listing-1\/[a-f0-9]{20}\.jpg$/,
    );
    expect(corrected).toMatch(
      /^catalog-images\/inventory\/listing-1\/[a-f0-9]{20}\.jpg$/,
    );
  });

  it('is stable for the same source (pipeline re-run skipExisting)', () => {
    const svc = makeService();
    const source = 'https://cdn.example.com/parts/abc.jpg';
    const a = svc.mirroredObjectKey('pipeline/job-9', source, '.jpg');
    const b = svc.mirroredObjectKey('pipeline/job-9', source, '.jpg');
    const digest = createHash('sha256')
      .update(source)
      .digest('hex')
      .slice(0, 20);
    expect(a).toBe(b);
    expect(a).toBe(`catalog-images/pipeline/job-9/${digest}.jpg`);
  });

  it('respects AWS_S3_PREFIX', () => {
    const svc = makeService('mhn/');
    const key = svc.mirroredObjectKey(
      'catalog-product/p1',
      'temp/x.webp',
      '.webp',
    );
    expect(key.startsWith('mhn/catalog-images/')).toBe(true);
  });
});

describe('StorageService first-party bucket alias', () => {
  const makeService = (bucket: string) =>
    new StorageService(
      {
        get: (key: string, fallback?: string) => {
          if (key === 'AWS_S3_BUCKET' || key === 'S3_BUCKET') return bucket;
          if (key === 'AWS_S3_PREFIX' || key === 'S3_PREFIX') return 'mhn/';
          if (key === 'AWS_S3_REGION' || key === 'S3_REGION')
            return 'us-east-1';
          return fallback;
        },
      } as unknown as ConfigService,
      { add: async () => undefined } as unknown as import('bullmq').Queue,
    );

  const live = 'solarrisebackupbucket-530142863136';
  const keyPath =
    'mhn/catalog-images/catalog-product/bdb0b91e-4d86-487a-b6b4-6cc1d89b777c/86e10306a3083d500550.png';

  it('extracts keys from the retired solarrisebackupbucket host', () => {
    const svc = makeService(live);
    expect(
      svc.keyFromUrl(`https://solarrisebackupbucket.s3.amazonaws.com/${keyPath}`),
    ).toBe(keyPath);
  });

  it('extracts keys from the account-qualified host and regional S3 host', () => {
    const svc = makeService(live);
    expect(
      svc.keyFromUrl(`https://${live}.s3.amazonaws.com/${keyPath}`),
    ).toBe(keyPath);
    expect(
      svc.keyFromUrl(`https://${live}.s3.us-east-1.amazonaws.com/${keyPath}`),
    ).toBe(keyPath);
  });

  it('does not treat an unrelated S3 bucket as first-party', () => {
    const svc = makeService(live);
    expect(
      svc.keyFromUrl(`https://other-bucket.s3.amazonaws.com/${keyPath}`),
    ).toBeNull();
  });

  it('flags only the retired hostname as a legacy alias', () => {
    const svc = makeService(live);
    expect(
      svc.isLegacyBucketAliasUrl(
        `https://solarrisebackupbucket.s3.amazonaws.com/${keyPath}`,
      ),
    ).toBe(true);
    expect(
      svc.isLegacyBucketAliasUrl(`https://${live}.s3.amazonaws.com/${keyPath}`),
    ).toBe(false);
  });

  it('emits canonical URLs on the configured account-qualified bucket', () => {
    const svc = makeService(live);
    expect(svc.getCdnUrl(keyPath)).toBe(
      `https://${live}.s3.amazonaws.com/${keyPath}`,
    );
  });
});
