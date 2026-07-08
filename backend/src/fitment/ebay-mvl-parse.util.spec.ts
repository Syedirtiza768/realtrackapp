import {
  expandYearsFromDePeriod,
  expandYearsFromValue,
  parseAuMvlRow,
  parseDeMvlRow,
  parseUkMvlRow,
  parseUsMvlRow,
  detectMvlMarketplaceFromFileName,
} from './ebay-mvl-parse.util.js';

describe('ebay-mvl-parse.util', () => {
  it('expands pipe-separated UK years', () => {
    expect(expandYearsFromValue('2009|2010|2011')).toEqual([2009, 2010, 2011]);
  });

  it('expands DE production periods', () => {
    expect(expandYearsFromDePeriod('2019/01-2021/12')).toEqual([
      2019, 2020, 2021,
    ]);
  });

  it('parses US rows with single year', () => {
    const rows = parseUsMvlRow({
      ePID: '1',
      Make: 'Porsche',
      Model: '911',
      Year: '1993',
      Trim: 'Carrera',
      Engine: '3.6L',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      make: 'Porsche',
      model: '911',
      year: 1993,
      trim: 'Carrera',
    });
  });

  it('parses UK rows into multiple years', () => {
    const rows = parseUkMvlRow({
      Make: 'Ford',
      Model: 'Ka',
      Year: '1997|1998',
      Engine: '999cc',
      'K-Type': '15279',
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.year)).toEqual([1997, 1998]);
  });

  it('parses AU rows', () => {
    const rows = parseAuMvlRow({
      ePID: '127',
      Make: 'BMW',
      Model: 'X6',
      Year: '2008',
      Engine: '2979cc',
    });
    expect(rows[0].make).toBe('BMW');
    expect(rows[0].year).toBe(2008);
  });

  it('parses DE rows with production period', () => {
    const rows = parseDeMvlRow({
      'K-Type': '135372',
      Marke_Make_EN: 'Ford',
      Modell_Model_EN: 'Mondeo V Turnier',
      Typ_Type_EN: '2.0 EcoBlue',
      Baujahr_ProductionPeriod_EN: '2019/01-2020/12',
      Motor_Engine_EN: '1995 ccm',
    });
    expect(rows.map((r) => r.year)).toEqual([2019, 2020]);
  });

  it('detects marketplace from filename', () => {
    expect(detectMvlMarketplaceFromFileName('US_MVL_2026_05.xlsx')).toBe('US');
    expect(detectMvlMarketplaceFromFileName('UK_MVL_2026_04.xlsx')).toBe('GB');
    expect(
      detectMvlMarketplaceFromFileName(
        'eBay-AU_Master_Vehicle_List_202604.xlsx',
      ),
    ).toBe('AU');
  });
});
