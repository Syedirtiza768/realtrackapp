import {
  applyAustralianSpelling,
  buildEnglishItemSpecifics,
  buildEnglishListingDescription,
  buildEnglishListingTitle,
  validateEnglishListing,
} from './ebay-english-listing.util.js';

describe('ebay-english-listing.util', () => {
  const sampleInput = {
    brand: 'Lexus',
    model: 'RX',
    generation: 'AL20',
    yearRange: '2015-2022',
    partType: 'Dashboard Dash Trim Panel Bezel',
    placement: 'Center',
    mpn: '1A421-034G',
    oemPartNumber: '1A421-034G',
    condition: 'Used',
    donorVehicle: '2018 Lexus RX350',
    sellerCountry: 'US',
    fitmentRows: [
      { year: '2018', make: 'Lexus', model: 'RX', trim: 'RX350' },
      { year: '2019', make: 'Lexus', model: 'RX', trim: 'RX450h' },
    ],
    fitmentConfirmed: false,
  };

  it('builds platform-aligned English title with variant tokens', () => {
    const title = buildEnglishListingTitle(sampleInput);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toMatch(/Lexus/);
    expect(title).toMatch(/RX350/);
    expect(title).toMatch(/AL20/);
  });

  it('builds structured English description with fitment section', () => {
    const html = buildEnglishListingDescription(sampleInput, 'US');
    expect(html).toMatch(/Vehicle Compatibility/);
    expect(html).toMatch(/1A421-034G/);
    expect(html).toMatch(/verify part number/i);
  });

  it('adds Year Range and Platform/Generation to item specifics', () => {
    const specifics = buildEnglishItemSpecifics(sampleInput);
    expect(specifics['Year Range']).toBe('2015-2022');
    expect(specifics['Platform/Generation']).toBe('AL20');
    expect(specifics['Manufacturer Part Number']).toBe('1A421-034G');
  });

  it('localises AU copy spelling', () => {
    expect(applyAustralianSpelling('Color Center Tire')).toMatch(/Colour/);
    expect(applyAustralianSpelling('Color Center Tire')).toMatch(/Centre/);
  });

  it('flags generation/year mismatch in English validation', () => {
    const badTitle =
      '2013-2021 Lexus RX AL20 Dashboard Trim 1A421-034G Used OEM';
    const result = validateEnglishListing({
      title: badTitle,
      description: buildEnglishListingDescription(sampleInput, 'US'),
      itemSpecifics: {
        ...buildEnglishItemSpecifics(sampleInput),
        Brand: 'Lexus',
        Model: 'RX',
        'Year Range': '2013-2021',
        'Platform/Generation': 'AL20',
      },
      categoryId: '33717',
      partType: 'Dashboard trim',
      mpn: '1A421-034G',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code.includes('GENERATION'))).toBe(true);
  });
});
