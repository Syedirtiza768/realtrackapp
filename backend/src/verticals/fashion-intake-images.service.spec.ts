/* eslint-disable @typescript-eslint/require-await -- lightweight storage mocks */
import { ForbiddenException } from '@nestjs/common';
import sharp from 'sharp';
import { FashionIntakeImagesService } from './fashion-intake-images.service';

const ORG = '11111111-2222-3333-4444-555555555555';

async function setup() {
  const source = await sharp({
    create: { width: 600, height: 800, channels: 3, background: '#1e90ff' },
  })
    .jpeg()
    .toBuffer();
  const stored: Array<{ key: string; body: Buffer }> = [];
  const storage = {
    keyFromUrl: (url: string) =>
      url.startsWith('https://bucket.test/')
        ? url.slice('https://bucket.test/'.length)
        : null,
    getObjectBuffer: jest.fn(async () => source),
    putObject: jest.fn(async (key: string, body: Buffer) => {
      stored.push({ key, body });
    }),
    queueVariantGeneration: jest.fn(async () => undefined),
    buildDurableKey: (key: string) => `verify/${key}`,
    getCdnUrl: (key: string) => `https://bucket.test/${key}`,
  };
  const orgs = {
    resolveOrganizationId: jest.fn(async () => ({ organizationId: ORG })),
  };
  const service = new FashionIntakeImagesService(
    orgs as never,
    storage as never,
  );
  return { service, storage, stored };
}

const user = { id: 'user-1' } as never;

describe('FashionIntakeImagesService.banner', () => {
  it('composites a banner strip onto a copy of an organization photo', async () => {
    const { service, stored } = await setup();
    const result = await service.banner(user, {
      imageUrl: `https://bucket.test/verify/fashion/intake/${ORG}/AVP-0001-M-1-abc.webp`,
      text: 'Free shipping · Fast dispatch',
      position: 'bottom',
      theme: 'dark',
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toMatch(
      new RegExp(
        `^verify/fashion/intake/${ORG}/AVP-0001-M-1-abc-banner-[0-9a-f]+\\.webp$`,
      ),
    );
    expect(result.url).toBe(`https://bucket.test/${stored[0].key}`);

    const output = sharp(stored[0].body);
    const meta = await output.metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([600, 800]);
    const { data, info } = await output
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    // Top keeps the photo colour; the bottom strip is the dark banner.
    expect(pixel(10, 10)[2]).toBeGreaterThan(200);
    expect(Math.max(...pixel(10, 790))).toBeLessThan(60);
    if (process.env.FASHION_CHART_PREVIEW)
      await sharp(stored[0].body)
        .png()
        .toFile(
          process.env.FASHION_CHART_PREVIEW.replace(/\.png$/, '-banner.png'),
        );
  });

  it('refuses photos from other organizations or outside Fashion storage', async () => {
    const { service, storage } = await setup();
    for (const imageUrl of [
      'https://bucket.test/verify/fashion/intake/99999999-2222-3333-4444-555555555555/x.webp',
      'https://bucket.test/verify/catalog/originals/x.webp',
      'https://attacker.example/fashion/intake/' + ORG + '/x.webp',
    ]) {
      await expect(
        service.banner(user, {
          imageUrl,
          text: 'x',
          position: 'top',
          theme: 'brand',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });
});
