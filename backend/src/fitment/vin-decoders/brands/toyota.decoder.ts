import type { BrandVinDecoder, DecodedVds, DecodedPlant, PlatformDefinition } from '../brand-decoder.types.js';

/**
 * Toyota/Lexus VIN Decoder
 *
 * Toyota VIN structure (positions 1-11):
 *   1-3:  WMI (World Manufacturer Identifier)
 *   4-5:  Vehicle line / model
 *   6:    Body type
 *   7:    Engine
 *   8:    Restraint system
 *   9:    Check digit
 *   10:   Model year
 *   11:   Assembly plant
 *
 * Known WMIs:
 *   JTD = Toyota (passenger cars, Japan)
 *   JTN = Toyota (passenger cars, Japan — alternate)
 *   JTJ = Toyota (SUVs/trucks, Japan)
 *   JTE = Toyota (trucks, Japan)
 *   JTH = Lexus (Japan)
 *   JTJ = Lexus (SUVs, Japan)
 *   4T1 = Toyota (USA — Georgetown, KY)
 *   5TD = Toyota (USA — San Antonio, TX)
 *   2T1 = Toyota (Canada — Cambridge, ON)
 *   3TM = Toyota (Mexico — Apaseo el Grande)
 *   SB1 = Toyota (UK — Burnaston)
 *   NMT = Toyota (Turkey — Sakarya)
 *   MR0 = Toyota (Thailand)
 */
export class ToyotaVinDecoder implements BrandVinDecoder {
  readonly brand = 'Toyota';

  readonly wmi = [
    'JTD', 'JTN', 'JTJ', 'JTE', 'JTH',  // Japan
    '4T1', '5TD', '4T3',                    // USA
    '2T1', '2T3',                            // Canada
    '3TM',                                    // Mexico
    'SB1',                                    // UK
    'NMT',                                    // Turkey
    'MR0', 'MR1',                            // Thailand
    'LFM', 'LFP', 'LFV',                    // China (GAC/FAW)
  ];

  decodeVds(vin: string): DecodedVds {
    const p4 = vin.charAt(3);
    const p5 = vin.charAt(4);
    const p6 = vin.charAt(5);
    const p7 = vin.charAt(6);
    const p8 = vin.charAt(7);

    const result: DecodedVds = {};

    // Positions 4-5: Vehicle line
    result.model = this.decodeModel(p4 + p5);

    // Position 6: Body type
    result.bodyStyle = this.decodeBodyType(p6);

    // Position 7: Engine
    result.engine = this.decodeEngine(p7);
    result.engineCode = this.decodeEngineCode(p7, result.model);

    // Position 8: Restraint (useful for trim inference)
    result.trim = this.decodeTrim(p8, result.model);

    return result;
  }

  decodePlant(code: string): DecodedPlant | null {
    const plants: Record<string, DecodedPlant> = {
      // Japan plants
      '0': { plantName: 'Toyota Motor Corporation - Tahara Plant', city: 'Tahara', state: 'Aichi', country: 'Japan' },
      '1': { plantName: 'Toyota Motor Corporation - Motomachi Plant', city: 'Toyota City', state: 'Aichi', country: 'Japan' },
      '2': { plantName: 'Toyota Motor Corporation - Tsutsumi Plant', city: 'Toyota City', state: 'Aichi', country: 'Japan' },
      '3': { plantName: 'Toyota Motor Corporation - Tsutsumi Plant', city: 'Toyota City', state: 'Aichi', country: 'Japan' },
      '4': { plantName: 'Toyota Motor Corporation - Miyata Plant', city: 'Miyawaka', state: 'Fukuoka', country: 'Japan' },
      '5': { plantName: 'Toyota Motor Corporation - Myochi Plant', city: 'Toyota City', state: 'Aichi', country: 'Japan' },
      '6': { plantName: 'Toyota Motor Corporation - Yoshiwara Plant', city: 'Toyota City', state: 'Aichi', country: 'Japan' },
      '7': { plantName: 'Toyota Motor Corporation - Fujimatsu Plant', city: 'Toyota City', state: 'Aichi', country: 'Japan' },
      '8': { plantName: 'Toyota Motor Corporation - Iwate Plant', city: 'Kanegasaki', state: 'Iwate', country: 'Japan' },
      '9': { plantName: 'Toyota Motor Corporation - Higashi Fuji Plant', city: 'Susono', state: 'Shizuoka', country: 'Japan' },
      'A': { plantName: 'Toyota Motor Corporation - Toyota Auto Body', city: 'Kariya', state: 'Aichi', country: 'Japan' },
      'B': { plantName: 'Toyota Motor Corporation - Kanto Auto Works', city: 'Yokkaichi', state: 'Mie', country: 'Japan' },
      'C': { plantName: 'Toyota Motor Corporation - Toyota Auto Body', city: 'Inabe', state: 'Mie', country: 'Japan' },
      // USA plants
      'U': { plantName: 'Toyota Motor Manufacturing Kentucky (TMMK)', city: 'Georgetown', state: 'Kentucky', country: 'United States' },
      'X': { plantName: 'Toyota Motor Manufacturing Indiana (TMMI)', city: 'Princeton', state: 'Indiana', country: 'United States' },
      'Y': { plantName: 'Toyota Motor Manufacturing Texas (TMMTX)', city: 'San Antonio', state: 'Texas', country: 'United States' },
      'Z': { plantName: 'Toyota Motor Manufacturing Mississippi (TMMMS)', city: 'Blue Springs', state: 'Mississippi', country: 'United States' },
      // UK
      'G': { plantName: 'Toyota Motor Manufacturing UK (TMUK)', city: 'Burnaston', state: 'Derbyshire', country: 'United Kingdom' },
      // Turkey
      'T': { plantName: 'Toyota Motor Manufacturing Turkey (TMMT)', city: 'Sakarya', country: 'Turkey' },
      // Thailand
      'D': { plantName: 'Toyota Motor Thailand (TMT)', city: 'Chachoengsao', country: 'Thailand' },
      // China
      'L': { plantName: 'GAC Toyota Motor', city: 'Guangzhou', state: 'Guangdong', country: 'China' },
    };

    return plants[code] || null;
  }

  readonly knownPlatforms: PlatformDefinition[] = [
    {
      platformCode: 'TNGA GA-C',
      vehicles: [
        { make: 'Toyota', model: 'C-HR', years: '2018-2022', engines: ['3ZR-FAE', '2ZR-FXE'] },
        { make: 'Toyota', model: 'Corolla', years: '2019-2024', engines: ['2ZR-FAE', 'M20A-FKS', 'M20A-FXS'] },
        { make: 'Toyota', model: 'Corolla Hatchback', years: '2019-2024', engines: ['M20A-FKS'] },
        { make: 'Toyota', model: 'Prius', years: '2016-2023', engines: ['2ZR-FXE'] },
        { make: 'Lexus', model: 'UX', years: '2019-2024', engines: ['M20A-FKS', 'M20A-FXS'] },
      ],
      shareableComponents: ['suspension_parts', 'steering_parts', 'brake_system', 'sensors_modules', 'cooling_system', 'electrical_components'],
      nonShareableComponents: ['body_panels', 'bumpers', 'lighting', 'interior_parts', 'exterior_trim'],
    },
    {
      platformCode: 'TNGA GA-K',
      vehicles: [
        { make: 'Toyota', model: 'Camry', years: '2018-2024', engines: ['A25A-FKS', 'A25A-FXS', '2AR-FE'] },
        { make: 'Toyota', model: 'RAV4', years: '2019-2024', engines: ['A25A-FKS', 'A25A-FXS'] },
        { make: 'Toyota', model: 'Highlander', years: '2020-2024', engines: ['A25A-FKS', 'A25A-FXS', '2GR-FKS'] },
        { make: 'Lexus', model: 'ES', years: '2019-2024', engines: ['A25A-FKS', 'A25A-FXS'] },
        { make: 'Lexus', model: 'NX', years: '2022-2024', engines: ['A25A-FKS', 'A25A-FXS'] },
      ],
      shareableComponents: ['suspension_parts', 'steering_parts', 'brake_system', 'sensors_modules', 'cooling_system', 'electrical_components', 'transmission_components'],
      nonShareableComponents: ['body_panels', 'bumpers', 'lighting', 'interior_parts', 'exterior_trim'],
    },
    {
      platformCode: 'TNGA GA-L',
      vehicles: [
        { make: 'Lexus', model: 'LS', years: '2018-2024', engines: ['V35A-FTS', '8GR-FXS'] },
        { make: 'Lexus', model: 'LC', years: '2018-2024', engines: ['8GR-FXS', '2UR-GSE'] },
        { make: 'Toyota', model: 'Mirai', years: '2021-2024', engines: ['fuel_cell'] },
      ],
      shareableComponents: ['sensors_modules', 'electrical_components'],
      nonShareableComponents: ['body_panels', 'bumpers', 'lighting', 'interior_parts', 'exterior_trim', 'suspension_parts', 'brake_system'],
    },
  ];

  /* ── Private decode helpers ── */

  private decodeModel(code: string): string {
    const models: Record<string, string> = {
      'A2': 'Prius',
      'A3': 'Prius Prime',
      'A4': 'Prius v',
      'B1': 'Prius c',
      'B2': 'C-HR',
      'B3': 'Corolla',
      'B4': 'Corolla Hatchback',
      'B5': 'Corolla Cross',
      'C1': 'Camry',
      'C2': 'Camry Hybrid',
      'C3': 'Crown',
      'D1': 'Avalon',
      'D2': 'Avalon Hybrid',
      'E1': 'RAV4',
      'E2': 'RAV4 Hybrid',
      'E3': 'RAV4 Prime',
      'F1': 'Highlander',
      'F2': 'Highlander Hybrid',
      'G1': '4Runner',
      'G2': 'Sequoia',
      'H1': 'Tacoma',
      'H2': 'Tundra',
      'J1': 'Land Cruiser',
      'J2': 'Land Cruiser 300',
      'K1': 'Sienna',
      'K2': 'Sienna Hybrid',
      'L1': 'Venza',
      'L2': 'Harrier',
      'M1': 'Supra',
      'N1': 'GR86',
      'N2': '86',
      'R1': 'Yaris',
      'R2': 'Yaris Cross',
      'S1': 'Aygo',
      'S2': 'Aygo X',
      'T1': 'GR Corolla',
      'T2': 'GR Yaris',
      'U1': 'bZ4X',
      'V1': 'Crown Signia',
    };

    return models[code] || '';
  }

  private decodeBodyType(code: string): string {
    const types: Record<string, string> = {
      '0': 'SUV/Crossover',
      '1': 'Sedan 2-door',
      '2': 'Sedan 4-door',
      '3': 'Hatchback 3-door',
      '4': 'Hatchback 5-door',
      '5': 'SUV/Crossover 5-door',
      '6': 'Wagon',
      '7': 'Van/Minivan',
      '8': 'Pickup Truck',
      '9': 'Convertible',
      'A': 'Sedan 4-door',
      'B': 'Hatchback 5-door',
      'C': 'SUV/Crossover',
      'D': 'SUV/Crossover',
      'E': 'Wagon',
      'F': 'Van/Minivan',
      'G': 'Pickup Truck',
      'H': 'SUV/Crossover',
      'J': 'Sedan 4-door',
      'K': 'Hatchback 5-door',
      'L': 'SUV/Crossover',
      'M': 'SUV/Crossover',
      'N': 'Pickup Truck',
      'P': 'SUV/Crossover',
      'R': 'Hatchback 5-door',
      'S': 'Sedan 4-door',
      'T': 'SUV/Crossover',
      'U': 'Sedan 4-door',
      'V': 'Hatchback 5-door',
      'W': 'SUV/Crossover',
      'X': 'SUV/Crossover',
      'Y': 'Sedan 4-door',
      'Z': 'Hatchback 5-door',
    };

    return types[code] || '';
  }

  private decodeEngine(code: string): string {
    const engines: Record<string, string> = {
      'A': '2.5L Hybrid (A25A-FXS)',
      'B': '1.5L Hybrid (1NZ-FXE)',
      'C': '1.8L Hybrid (2ZR-FXE)',
      'D': '2.0L (M20A-FKS)',
      'E': '2.0L (3ZR-FAE)',
      'F': '1.2L Turbo (8NR-FTS)',
      'G': '2.5L (A25A-FKS)',
      'H': '2.0L Valvematic (3ZR-FAE)',
      'J': '1.8L (2ZR-FE)',
      'K': '2.5L V6 (2GR-FKS)',
      'L': '3.5L V6 (2GR-FKS)',
      'M': '3.5L V6 Hybrid (2GR-FXS)',
      'N': '5.7L V8 (3UR-FE)',
      'P': '3.5L Twin-Turbo V6 (V35A-FTS)',
      'R': '2.4L Turbo (T24A-FTS)',
      'S': 'Electric (BEV)',
      'T': 'Hydrogen Fuel Cell',
      'U': '1.0L (1KR-FE)',
      'V': '1.3L (1NR-FE)',
      'W': '1.5L (1NZ-FE)',
      'X': '2.7L (1AR-FE)',
      'Y': '4.0L V6 (1GR-FE)',
      'Z': '4.6L V8 (1UR-FE)',
      '0': '2.4L (2AZ-FE)',
      '1': '3.3L V6 (3MZ-FE)',
      '2': '4.7L V8 (2UZ-FE)',
      '3': '3.0L (1MZ-FE)',
      '4': '1.6L (1ZR-FE)',
      '5': '2.0L (M20A-FXS) Hybrid',
      '6': '1.8L (2ZR-FAE)',
      '7': '2.5L Turbo (T24A-FTS)',
      '8': '2.4L Turbo (T24A-FTS)',
      '9': '3.5L V6 (7GR-FKS)',
    };

    return engines[code] || '';
  }

  private decodeEngineCode(code: string, model: string): string {
    // Engine code is model-dependent — same position 7 code can mean
    // different engines for different models
    const engineCodes: Record<string, Record<string, string>> = {
      'C-HR': {
        'H': '3ZR-FAE',
        'E': '3ZR-FAE',
        'C': '2ZR-FXE',
        'F': '8NR-FTS',
      },
      'Corolla': {
        'J': '2ZR-FAE',
        'D': 'M20A-FKS',
        'C': '2ZR-FXE',
      },
      'Corolla Hatchback': {
        'D': 'M20A-FKS',
      },
      'Camry': {
        'G': 'A25A-FKS',
        'A': 'A25A-FXS',
        'L': '2GR-FKS',
      },
      'RAV4': {
        'G': 'A25A-FKS',
        'A': 'A25A-FXS',
        'R': 'T24A-FTS',
      },
    };

    return engineCodes[model]?.[code] || '';
  }

  private decodeTrim(code: string, model: string): string {
    // Position 8 encodes restraint system, which can sometimes indicate trim
    // This is approximate — exact trim requires additional data
    const restraints: Record<string, string> = {
      '0': 'Standard',
      '1': 'Driver + Passenger Airbags',
      '2': 'Advanced Airbag System',
      '3': 'Advanced + Side Curtain',
      '4': 'Advanced + Side + Curtain + Knee',
      '5': 'Full Safety Suite',
      '6': 'Full Safety Suite + TSS',
      '7': 'Full Safety Suite + TSS 2.0',
      '8': 'Full Safety Suite + TSS 2.5',
      '9': 'Full Safety Suite + TSS 3.0',
      'A': 'Standard Restraint',
      'B': 'Driver Airbag',
      'C': 'Driver + Passenger',
      'D': 'Advanced Airbag',
      'E': 'Advanced + Side',
      'F': 'Advanced + Side + Curtain',
      'G': 'Full Safety Suite',
      'H': 'Full Safety Suite + TSS',
      'J': 'Full Safety Suite + TSS 2.0',
      'K': 'Full Safety Suite + TSS 2.5',
    };

    // For most Toyota models, trim is better inferred from other VIN positions
    // Return empty and let AI enrichment determine trim
    return '';
  }
}
