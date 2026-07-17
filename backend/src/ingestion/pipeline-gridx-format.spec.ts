import {
  validatePipelineGridxHeaders,
  PIPELINE_GRIDX_REQUIRED_HEADERS,
} from './pipeline-gridx-format.js';

describe('validatePipelineGridxHeaders', () => {
  const goodHeaders = [...PIPELINE_GRIDX_REQUIRED_HEADERS];

  it('accepts a valid GridX header row', () => {
    const rows = [
      ['#INFO', 'GridX Connect Advanced Template v4.0'],
      goodHeaders,
      ['8J0609721E', 119.99, 1, 'Audi', 'Brake cable', 'https://x/a.jpg', 'SKU-1'],
    ];
    expect(validatePipelineGridxHeaders(rows)).toEqual({
      ok: true,
      headers: goodHeaders,
    });
  });

  it('rejects corrupted all-Part-Number headers', () => {
    const rows = [
      ['#INFO', 'GridX Connect'],
      Array(8).fill('Part Number'),
      ['8J0609721E', 119.99, 1, 'Audi', 'Brake cable', 'https://x/a.jpg', 'SKU-1'],
    ];
    const result = validatePipelineGridxHeaders(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/corrupted/i);
    }
  });

  it('rejects missing Price and Image URLs', () => {
    const rows = [
      ['#INFO', 'GridX'],
      ['Part Number', 'Quantity', 'Vehicle Make', 'Description', 'SKU'],
      ['PN1', 1, 'Audi', 'desc', 'SKU-1'],
    ];
    const result = validatePipelineGridxHeaders(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(
        expect.arrayContaining(['Price', 'Image URLs']),
      );
    }
  });
});
