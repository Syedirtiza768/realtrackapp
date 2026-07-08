import {
  buildGermanListingDescription,
  buildGermanListingTitle,
  formatGermanPlacement,
  hasAwkwardGermanPhrasing,
  resolveMotorsCategoryFromPart,
  validateGermanListing,
} from './ebay-german-listing.util.js';

describe('ebay-german-listing.util', () => {
  const sampleInput = {
    brand: 'Toyota',
    model: 'Camry',
    generation: 'XV70',
    yearRange: '2018-2024',
    partType: 'Door Armrest',
    placement: 'Rear, Left',
    mpn: '74260-33170-C0',
    oemPartNumber: '74260-33170-C0',
    condition: 'Used',
    donorVehicle: '2019 Toyota Camry XV70',
    sellerCountry: 'US',
    fitmentRows: [{ year: '2018', make: 'Toyota', model: 'Camry', trim: 'LE' }],
    fitmentConfirmed: false,
  };

  it('builds a native German title with OEM and gebraucht', () => {
    const title = buildGermanListingTitle(sampleInput);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toMatch(/Toyota/);
    expect(title).toMatch(/Camry/);
    expect(title).toMatch(/Armlehne/);
    expect(title).toMatch(/hinten links/i);
    expect(title).toMatch(/74260-33170-C0/);
    expect(title).toMatch(/gebraucht/i);
    expect(title).not.toMatch(/gebraucht OE/i);
  });

  it('maps rear left placement to hinten links', () => {
    expect(formatGermanPlacement('Rear, Left')).toBe('hinten links');
    expect(formatGermanPlacement('Front Right')).toBe('vorne rechts');
  });

  it('maps door armrest to interior category', () => {
    const cat = resolveMotorsCategoryFromPart('Door Armrest', 'rear left trim');
    expect(cat?.categoryId).toBe('33695');
  });

  it('builds a substantive German description with buyer verification', () => {
    const html = buildGermanListingDescription(sampleInput);
    expect(html).toMatch(/Teilenummer/);
    expect(html).toMatch(/Bitte vergleichen Sie die Teilenummer vor dem Kauf/);
    expect(html).toMatch(/Vereinigte Staaten/);
    expect(html).toMatch(/Orientierung/);
  });

  it('flags awkward machine-translated titles', () => {
    expect(hasAwkwardGermanPhrasing('Toyota OEM gebraucht OE 123')).toBe(true);
    expect(
      hasAwkwardGermanPhrasing(
        'Toyota Camry Armlehne OEM 123 Original gebraucht',
      ),
    ).toBe(false);
  });

  it('validates interior part in exterior category as error', () => {
    const result = validateGermanListing({
      title: buildGermanListingTitle(sampleInput),
      description: buildGermanListingDescription(sampleInput),
      itemSpecifics: {
        Einbauposition: 'hinten links',
        Herstellernummer: '74260-33170-C0',
      },
      categoryId: '33697',
      categoryName: 'Exterior Door Panels & Frames',
      partType: 'Door Armrest',
      placement: 'Rear, Left',
      mpn: '74260-33170-C0',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DE_CATEGORY_MISMATCH')).toBe(
      true,
    );
  });

  it('flags generation/year mismatch in German validation', () => {
    const result = validateGermanListing({
      title: 'Lexus RX AL20 2013-2021 Armaturenbrett OEM 1A421-034G gebraucht',
      description: buildGermanListingDescription(sampleInput),
      itemSpecifics: {
        Herstellernummer: '1A421-034G',
        'Plattform/Generation': 'AL20',
        Baujahrbereich: '2013-2021',
        Fahrzeugmarke: 'Lexus',
        Modell: 'RX',
      },
      categoryId: '33717',
      partType: 'Dashboard trim',
      mpn: '1A421-034G',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code.includes('GENERATION'))).toBe(true);
  });
});
