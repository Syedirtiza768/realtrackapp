import {
  hasHttpImageUrls,
  mergeImageUrls,
  parseImageUrlPipe,
} from './pipeline-image-matching.util';

describe('pipeline-image-matching.util', () => {
  it('ignores warehouse/bin placeholders when parsing listing images', () => {
    expect(
      parseImageUrlPipe(
        'BU1-14349|https://cdn.example.test/part-a.jpg|not-an-image',
      ),
    ).toEqual(['https://cdn.example.test/part-a.jpg']);
    expect(hasHttpImageUrls('BU1-14349')).toBe(false);
  });

  it('recognizes catalog URL arrays but not placeholder arrays', () => {
    expect(hasHttpImageUrls(['BU1-14349'])).toBe(false);
    expect(hasHttpImageUrls(['https://cdn.example.test/part-a.jpg'])).toBe(
      true,
    );
  });

  it('puts matched Drive URLs first, deduplicates, and preserves valid URLs', () => {
    expect(
      mergeImageUrls(
        ['BU1-14349', 'https://source.example.test/part-a.jpg'],
        [
          'https://drive.example.test/part-a.jpg',
          'https://source.example.test/part-a.jpg',
        ],
      ),
    ).toEqual([
      'https://drive.example.test/part-a.jpg',
      'https://source.example.test/part-a.jpg',
    ]);
  });
});
