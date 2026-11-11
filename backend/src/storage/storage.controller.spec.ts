import { StorageController } from './storage.controller';

describe('StorageController WebP source selection', () => {
  type SourceKeySelector = {
    preferredWebpKey: (s3Key: string) => string;
    webpFallbackKeys: (s3Key: string) => string[];
  };

  const makeController = (): SourceKeySelector =>
    new StorageController(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    ) as unknown as SourceKeySelector;

  it('maps supported original image extensions to the sibling WebP key', () => {
    const controller = makeController();

    expect(controller.preferredWebpKey('catalog-images/part-1.jpg')).toBe(
      'catalog-images/part-1.webp',
    );
    expect(controller.preferredWebpKey('catalog-images/part-2.PNG')).toBe(
      'catalog-images/part-2.webp',
    );
  });

  it('does not rewrite existing WebP or responsive variant keys', () => {
    const controller = makeController();

    expect(controller.preferredWebpKey('originals/part-1.webp')).toBe(
      'originals/part-1.webp',
    );
    expect(controller.preferredWebpKey('originals/part-1_medium.webp')).toBe(
      'originals/part-1_medium.webp',
    );
    expect(controller.webpFallbackKeys('originals/part-1_medium.webp')).toEqual(
      [],
    );
  });

  it('returns original sibling candidates when the preferred WebP is missing', () => {
    const controller = makeController();

    expect(controller.webpFallbackKeys('originals/part-1.webp')).toEqual([
      'originals/part-1.png',
      'originals/part-1.jpg',
      'originals/part-1.jpeg',
      'originals/part-1.gif',
      'originals/part-1.bmp',
      'originals/part-1.heic',
      'originals/part-1.avif',
    ]);
  });
});
