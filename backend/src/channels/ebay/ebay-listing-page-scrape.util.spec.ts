import {
  buildPublicEbayItemUrl,
  extractCompatibilityFromHtml,
  extractEbayImageUrlsFromHtml,
  extractItemSpecificsFromHtml,
  isNonEnglishEbayListingHost,
  parseEbayListingPageHtml,
} from './ebay-listing-page-scrape.util.js';

describe('ebay-listing-page-scrape.util', () => {
  const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:image" content="https://i.ebayimg.com/images/g/abc/s-l140.jpg" />
  <script type="application/ld+json">
  {"@type":"Product","name":"Brake Pad","description":"OEM used brake pad set","image":["https://i.ebayimg.com/images/g/abc/s-l1600.jpg","https://i.ebayimg.com/images/g/def/s-l1600.jpg"]}
  </script>
</head>
<body>
  <div class="ux-labels-values__labels-content"><span>Brand</span></div>
  <div class="ux-labels-values__values-content"><span>TRW</span></div>
  <div class="ux-labels-values__labels-content"><span>Manufacturer Part Number</span></div>
  <div class="ux-labels-values__values-content"><span>BP-123</span></div>
  <table>
    <tr><td>2018</td><td>Toyota</td><td>Corolla</td><td>LE</td><td>1.8L</td></tr>
    <tr><td>2019</td><td>Toyota</td><td>Corolla</td><td>SE</td><td>2.0L</td></tr>
  </table>
  <div id="ds_div"><p>This is a longer listing description with enough characters for the parser.</p></div>
</body>
</html>`;

  it('extracts ebayimg URLs and og images', () => {
    const urls = extractEbayImageUrlsFromHtml(sampleHtml);
    expect(urls.some((u) => u.includes('ebayimg.com'))).toBe(true);
  });

  it('parses item specifics from label/value blocks', () => {
    const specifics = extractItemSpecificsFromHtml(sampleHtml);
    expect(specifics.Brand).toEqual(['TRW']);
    expect(specifics['Manufacturer Part Number']).toEqual(['BP-123']);
  });

  it('parses compatibility table rows', () => {
    const compat = extractCompatibilityFromHtml(sampleHtml);
    expect(compat?.compatibleProducts.length).toBeGreaterThanOrEqual(2);
    expect(compat?.compatibleProducts[0].compatibilityProperties).toEqual(
      expect.arrayContaining([
        { name: 'Year', value: '2018' },
        { name: 'Make', value: 'Toyota' },
        { name: 'Model', value: 'Corolla' },
      ]),
    );
  });

  it('parseEbayListingPageHtml merges json-ld title, description and images', () => {
    const parsed = parseEbayListingPageHtml(sampleHtml);
    expect(parsed.title).toBe('Brake Pad');
    expect(parsed.imageUrls.length).toBeGreaterThanOrEqual(2);
    expect(parsed.descriptionHtml).toContain('OEM used brake pad');
    expect(parsed.itemSpecifics.Brand).toEqual(['TRW']);
    expect(parsed.compatibility?.compatibleProducts.length).toBeGreaterThan(0);
    expect(parsed.sources.length).toBeGreaterThan(0);
  });

  it('detects non-English eBay hosts and builds ebay.com scrape URLs', () => {
    expect(isNonEnglishEbayListingHost('https://www.ebay.de/itm/1')).toBe(true);
    expect(isNonEnglishEbayListingHost('https://www.ebay.fr/itm/1')).toBe(true);
    expect(isNonEnglishEbayListingHost('https://www.ebay.com/itm/1')).toBe(
      false,
    );
    expect(buildPublicEbayItemUrl('99', 'https://www.ebay.de/itm/99')).toBe(
      'https://www.ebay.com/itm/99',
    );
  });
});
