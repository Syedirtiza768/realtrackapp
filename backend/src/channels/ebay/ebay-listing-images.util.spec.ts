import {
  applyImageOrderOverride,
  sanitizeEbayImageUrls,
} from './ebay-listing-images.util.js';

describe('ebay-listing-images.util', () => {
  it('filters blank and invalid image URLs', () => {
    const { imageUrls } = sanitizeEbayImageUrls([
      '',
      '   ',
      'not-a-url',
      'https://cdn.example.com/part-1.jpg',
    ]);
    expect(imageUrls).toEqual(['https://cdn.example.com/part-1.jpg']);
  });

  it('normalizes protocol-relative URLs', () => {
    const { imageUrls } = sanitizeEbayImageUrls(['//cdn.example.com/part.jpg']);
    expect(imageUrls).toEqual(['https://cdn.example.com/part.jpg']);
  });

  it('expands pipe-delimited image strings', () => {
    const { imageUrls } = sanitizeEbayImageUrls([
      'https://cdn.example.com/a.jpg|https://cdn.example.com/b.jpg',
    ]);
    expect(imageUrls).toHaveLength(2);
  });

  it('dedupes images case-insensitively', () => {
    const { imageUrls } = sanitizeEbayImageUrls([
      'https://cdn.example.com/a.jpg',
      'HTTPS://cdn.example.com/a.jpg',
    ]);
    expect(imageUrls).toHaveLength(1);
  });

  it('applies image order override when provided', () => {
    const ordered = applyImageOrderOverride(
      ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      ['https://cdn.example.com/b.jpg', 'https://cdn.example.com/a.jpg'],
    );
    expect(ordered[0]).toBe('https://cdn.example.com/b.jpg');
    expect(ordered[1]).toBe('https://cdn.example.com/a.jpg');
  });
});
