import {
  alignGenerationAndYearRange,
  detectTitleGenerationMismatch,
  extractFitmentVariantTokens,
  resolvePlatformGeneration,
  validateGenerationYearAlignment,
} from './platform-generation.util.js';

describe('platform-generation.util', () => {
  it('resolves Lexus RX AL20 for 2018 donor', () => {
    const gen = resolvePlatformGeneration('Lexus', 'RX350', 2018);
    expect(gen?.code).toBe('AL20');
    expect(gen?.start).toBe(2015);
    expect(gen?.end).toBe(2022);
  });

  it('resolves Lexus RX AL10 for 2013 donor', () => {
    const gen = resolvePlatformGeneration('Lexus', 'RX', 2013);
    expect(gen?.code).toBe('AL10');
    expect(gen?.start).toBe(2009);
    expect(gen?.end).toBe(2015);
  });

  it('flags AL20 with 2013-2021 year range as invalid', () => {
    const result = validateGenerationYearAlignment({
      generation: 'AL20',
      yearRange: '2013-2021',
      make: 'Lexus',
      model: 'RX',
      anchorYear: 2018,
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(
      /outside AL20|conflicts with expected AL10/i,
    );
  });

  it('aligns generation and year range from donor year', () => {
    const aligned = alignGenerationAndYearRange({
      make: 'Lexus',
      model: 'RX350',
      anchorYear: 2018,
      generation: 'AL20',
      yearRange: '2013-2021',
    });
    expect(aligned.generation).toBe('AL20');
    expect(aligned.yearRange).toBe('2015-2022');
  });

  it('detects mismatch in title text', () => {
    const msg = detectTitleGenerationMismatch(
      'Lexus RX AL20 2013-2021 Armaturenbrett OEM 1A421-034G',
      'Lexus',
      'RX',
      2018,
    );
    expect(msg).toBeTruthy();
  });

  it('extracts RX350/RX450h variant tokens from fitment', () => {
    const tokens = extractFitmentVariantTokens([
      { trim: 'RX350 F Sport', model: 'RX' },
      { trim: 'RX450h', model: 'RX' },
    ]);
    expect(tokens).toEqual(expect.arrayContaining(['RX350', 'RX450H']));
  });
});
