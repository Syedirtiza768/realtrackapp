/**
 * Brand Knowledge Base
 *
 * Static, verified knowledge about automotive brands. Used to augment
 * AI prompts with brand-specific context so models don't hallucinate.
 *
 * Each brand entry contains:
 * - VIN pattern documentation
 * - Engine code mappings
 * - Plant code mappings
 * - OEM part number format
 * - Platform sharing data
 * - Common aftermarket brands
 */

export interface BrandKnowledge {
  brand: string;
  vinPatterns: string;
  engineCodes: string;
  plantCodes: string;
  partNumberFormat: string;
  partNumberExamples: string[];
  commonAftermarketBrands: string[];
  modelsByYear: Record<string, string[]>;
}

export const BRAND_KNOWLEDGE: Record<string, BrandKnowledge> = {
  Toyota: {
    brand: 'Toyota',
    vinPatterns: `Toyota VIN structure (positions 1-11):
Position 1: Country of origin (J=Japan, 4/5=USA, 2=Canada, 3=Mexico, N=Turkey, S=UK, M=Thailand, L=China)
Position 2-3: Manufacturer (TD/TN/TJ/TE/TH=Lexus = Toyota Japan; T1/T2/T3=Toyota USA)
Position 4-5: Vehicle line (B2=C-HR, B3=Corolla, B4=Corolla Hatchback, C1=Camry, E1=RAV4, F1=Highlander, G1=4Runner, H1=Tacoma, H2=Tundra, K1=Sienna)
Position 6: Body type (2=Sedan 4D, 4=Hatchback 5D, 5=SUV 5D, 8=Pickup)
Position 7: Engine (H=2.0L 3ZR-FAE, E=2.0L 3ZR-FAE, D=2.0L M20A-FKS, C=1.8L 2ZR-FXE, G=2.5L A25A-FKS, J=1.8L 2ZR-FAE, L=3.5L V6, F=1.2L Turbo)
Position 8: Restraint system
Position 9: Check digit
Position 10: Model year (K=2019, L=2020, M=2021, N=2022, P=2023, R=2024, S=2025, T=2026)
Position 11: Assembly plant (2/3=Tsutsumi Japan, 0=Tahara Japan, U=Kentucky USA, T=Turkey, D=Thailand)`,

    engineCodes: `Toyota engine code reference:
3ZR-FAE: 2.0L I4 DOHC 16V Valvematic (144hp, 139 lb-ft) — C-HR (2018-2022), Corolla (2014-2019)
2ZR-FE: 1.8L I4 DOHC 16V (132hp, 128 lb-ft) — Corolla (2009-2019), Matrix (2009-2013)
2ZR-FAE: 1.8L I4 DOHC 16V Valvematic (140hp) — Corolla (2014-2019)
2ZR-FXE: 1.8L I4 DOHC 16V Hybrid (98hp engine + electric) — Prius (2010-2015), C-HR Hybrid (non-NA)
M20A-FKS: 2.0L I4 DOHC 16V Dynamic Force (168hp, 151 lb-ft) — Corolla Hatchback (2019+), RAV4 (2019+)
M20A-FXS: 2.0L I4 DOHC 16V Dynamic Force Hybrid (150hp engine + electric) — Corolla Hybrid, C-HR Hybrid (Europe)
A25A-FKS: 2.5L I4 DOHC 16V Dynamic Force (203hp, 184 lb-ft) — Camry (2018+), RAV4 (2019+)
A25A-FXS: 2.5L I4 DOHC 16V Dynamic Force Hybrid (176hp engine + electric) — Camry Hybrid, RAV4 Hybrid
8NR-FTS: 1.2L I4 Turbo (114hp, 136 lb-ft) — C-HR (non-NA markets)
1NZ-FE: 1.5L I4 (106hp) — Yaris (2006-2014)
1KR-FE: 1.0L I3 (68hp) — Aygo
2GR-FKS: 3.5L V6 DOHC 24V (295hp) — Camry (V6), Highlander, Tacoma
2GR-FXS: 3.5L V6 DOHC 24V Hybrid (354hp combined) — Highlander Hybrid
V35A-FTS: 3.5L V6 Twin-Turbo (409hp) — LS500, Tundra, Sequoia
T24A-FTS: 2.4L I4 Turbo (275hp) — Crown, Grand Highlander`,

    plantCodes: `Toyota assembly plant codes (position 11):
0 = Tahara Plant, Aichi, Japan
1 = Motomachi Plant, Toyota City, Aichi, Japan
2 = Tsutsumi Plant, Toyota City, Aichi, Japan
3 = Tsutsumi Plant, Toyota City, Aichi, Japan
4 = Miyata Plant, Miyawaka, Fukuoka, Japan
8 = Iwate Plant (TMEJ), Kanegasaki, Iwate, Japan
U = TMMK, Georgetown, Kentucky, USA
X = TMMI, Princeton, Indiana, USA
Y = TMMTX, San Antonio, Texas, USA
Z = TMMMS, Blue Springs, Mississippi, USA
C = TMMC, Cambridge, Ontario, Canada
T = TMMT, Sakarya, Turkey
D = TMT, Chachoengsao, Thailand
G = TMUK, Burnaston, UK
L = GAC Toyota, Guangzhou, China`,

    partNumberFormat: 'Toyota OEM format: XXXXX-XXXXX (5 digits, dash, 4-5 digits). Example: 04465-F4021 (front brake pads)',
    partNumberExamples: [
      '04465-F4021 (front brake pads)',
      '04466-F4010 (rear brake pads)',
      '04152-YZZA1 (oil filter element)',
      '87139-F4010 (cabin air filter)',
      '17801-21060 (engine air filter)',
      '90919-01249 (spark plug, Denso FK20HBR11)',
      '52119-F4050 (front bumper cover)',
      '48510-F4010 (front strut assembly)',
      '90916-02790 (serpentine belt)',
    ],
    commonAftermarketBrands: [
      'Denso', 'Aisin', 'NGK', 'TRW', 'Bosch', 'KYB', 'Monroe',
      'ACDelco', 'Fram', 'Wix', 'K&N', 'Mobil 1', 'Idemitsu',
      'Gates', 'Dayco', 'Dorman', 'TYC', 'Depo', 'Koyo',
    ],
    modelsByYear: {
      '2018': ['Camry', 'Corolla', 'C-HR', 'RAV4', 'Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sienna', 'Prius', 'Prius Prime', 'Avalon', 'Land Cruiser', 'Yaris', '86', 'Supra'],
      '2019': ['Camry', 'Corolla', 'Corolla Hatchback', 'C-HR', 'RAV4', 'Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sienna', 'Prius', 'Prius Prime', 'Avalon', 'Land Cruiser', 'Yaris', '86', 'Supra'],
      '2020': ['Camry', 'Corolla', 'Corolla Hatchback', 'C-HR', 'RAV4', 'RAV4 Hybrid', 'Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sienna', 'Prius', 'Prius Prime', 'Avalon', 'Venza', 'Supra'],
      '2021': ['Camry', 'Corolla', 'Corolla Hatchback', 'C-HR', 'RAV4', 'RAV4 Prime', 'Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sienna', 'Prius', 'Prius Prime', 'Venza', 'Mirai', 'Supra', 'GR Supra'],
      '2022': ['Camry', 'Corolla', 'Corolla Cross', 'C-HR', 'RAV4', 'RAV4 Prime', 'Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sienna', 'Prius', 'Prius Prime', 'Venza', 'bZ4X', 'GR86', 'GR Supra', 'Corolla Cross'],
      '2023': ['Camry', 'Corolla', 'Corolla Cross', 'Crown', 'RAV4', 'RAV4 Prime', 'Highlander', 'Grand Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sequoia', 'Prius', 'Prius Prime', 'bZ4X', 'GR86', 'GR Corolla', 'GR Supra'],
      '2024': ['Camry', 'Corolla', 'Corolla Cross', 'Crown', 'Crown Signia', 'RAV4', 'RAV4 Prime', 'Highlander', 'Grand Highlander', '4Runner', 'Tacoma', 'Tundra', 'Sequoia', 'Prius', 'Prius Prime', 'bZ4X', 'GR86', 'GR Corolla', 'GR Supra'],
    },
  },

  BMW: {
    brand: 'BMW',
    vinPatterns: `BMW VIN structure:
Position 1-3: WMI (WBA=BMW AG, WBY=BMW i, WBS=BMW M, WBX=BMW X models)
Position 4-6: Model code (e.g., UL7=3 Series Sedan, VR5=X3, etc.)
Position 7-8: Engine/body variant
Position 9: Check digit
Position 10: Model year
Position 11: Assembly plant (0=Munich, 5=Dingolfing, 7=Dingolfing, E=Regensburg, L=Spartanburg USA, N=Rosslyn SA)`,
    engineCodes: `BMW engine families:
N20: 2.0L Turbo I4 (180-245hp) — F30 320i/328i, F10 528i
N26: 2.0L Turbo I4 SULEV — 328i SULEV
N55: 3.0L Turbo I6 (300-320hp) — 335i, 535i, X5 35i
B46/B48: 2.0L Turbo I4 (180-255hp) — G20 320i/330i, G01 X3 30i
B58: 3.0L Turbo I6 (335-385hp) — G20 M340i, G05 X5 40i
S55: 3.0L Twin-Turbo I6 (405-473hp) — F80 M3, F82 M4
S58: 3.0L Twin-Turbo I6 (473-503hp) — G80 M3, G82 M4
N63: 4.4L Twin-Turbo V8 (445-523hp) — 550i, 750i, X5 50i
S63: 4.4L Twin-Turbo V8 (553-617hp) — F90 M5, F91 M8`,
    plantCodes: `BMW assembly plants:
0 = Munich, Germany (BMW Group Plant Munich)
5 = Dingolfing, Germany (BMW Group Plant Dingolfing)
7 = Dingolfing, Germany
E = Regensburg, Germany (BMW Group Plant Regensburg)
L = Spartanburg, South Carolina, USA (BMW Manufacturing Co.)
N = Rosslyn, South Africa (BMW SA)
C = Oxford, UK (MINI Plant Oxford)
W = Steyr, Austria (BMW Motoren)
B = Beijing, China (BMW Brilliance)
D = Shenyang, China (BMW Brilliance Tiexi)
V = Leipzig, Germany (BMW Group Plant Leipzig)
P = Araquari, Brazil`,
    partNumberFormat: 'BMW OEM format: XX XX X XXX XXX (space-separated groups, or continuous 11 digits). Example: 34 11 6 796 827',
    partNumberExamples: [
      '34 11 6 796 827 (front brake pads)',
      '34 21 6 789 623 (front brake rotor)',
      '11 42 7 566 208 (oil filter)',
      '64 31 9 272 637 (cabin air filter)',
      '13 71 7 594 494 (ignition coil)',
    ],
    commonAftermarketBrands: ['Brembo', 'Zimmermann', 'Ate', 'Bosch', 'Mann-Filter', 'Mahle', 'Lemforder', 'Sachs', 'Bilstein', 'H&R', 'Dinan', 'Febi', 'Meyle'],
    modelsByYear: {
      '2019': ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4', 'i3', 'i8', 'M2', 'M3', 'M4', 'M5', 'M8'],
      '2020': ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4', 'i3', 'i8', 'M2', 'M3', 'M4', 'M5', 'M8', 'iX3'],
      '2024': ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4', 'i4', 'i5', 'i7', 'iX', 'iX1', 'iX2', 'M2', 'M3', 'M4', 'M5', 'M8'],
    },
  },

  Ford: {
    brand: 'Ford',
    vinPatterns: `Ford VIN structure:
Position 1-3: WMI (1FA=Ford USA passenger, 1FT=Ford USA truck, 1FM=Ford USA SUV, 1LN=Lincoln, 2FA=Ford Canada)
Position 4-6: Restraint/brake system + body style
Position 7: Engine (A=2.0L EcoBoost, B=2.3L EcoBoost, C=2.7L EcoBoost, D=3.0L EcoBoost, E=3.5L EcoBoost, F=5.0L V8, G=3.5L V6, H=2.0L Hybrid, K=3.5L PowerBoost Hybrid)
Position 8: Transmission/drivetrain
Position 9: Check digit
Position 10: Model year
Position 11: Assembly plant`,
    engineCodes: `Ford engine codes:
A: 2.0L EcoBoost I4 (250hp)
B: 2.3L EcoBoost I4 (270-310hp)
C: 2.7L EcoBoost V6 (325-335hp)
D: 3.0L EcoBoost V6 (400hp)
E: 3.5L EcoBoost V6 (375-450hp)
F: 5.0L Coyote V8 (460hp)
G: 3.5L Ti-VCT V6 (290hp)
H: 2.0L Atkinson Hybrid (188hp combined)
K: 3.5L PowerBoost Hybrid (430hp combined)
L: 5.2L Supercharged V8 (760hp) — GT500`,
    plantCodes: `Ford assembly plants:
A = Atlanta, Georgia
C = Chicago, Illinois
D = Avon Lake, Ohio
E = Edison, New Jersey
F = Dearborn, Michigan
H = Lorain, Ohio
K = Kansas City, Missouri
L = Wayne, Michigan
N = Norfolk, Virginia
P = Twin Cities, Minnesota
R = Hermosillo, Mexico
S = Allen Park, Michigan
U = Louisville, Kentucky
W = Wayne, Michigan`,
    partNumberFormat: 'Ford OEM format: XXXX-XXXXX-X (4 digits, dash, 5 digits, dash, letter suffix). Example: BR3Z-1006-A',
    partNumberExamples: [
      'BR3Z-1006-A (front bumper cover)',
      'BR3Z-13405-A (hood)',
      'BL3Z-1100-C (headlight assembly)',
      'F1TZ-6731-A (door handle)',
      'XL1Z-17A682-AA (intake manifold)',
    ],
    commonAftermarketBrands: ['Motorcraft', 'Dorman', 'Bosch', 'ACDelco', 'Monroe', 'Moog', 'Motorcraft', 'TYC', 'Depo', 'K&N'],
    modelsByYear: {
      '2019': ['F-150', 'F-250', 'F-350', 'Mustang', 'Explorer', 'Escape', 'Edge', 'Expedition', 'EcoSport', 'Fusion', 'Ranger', 'Transit', 'Bronco Sport'],
      '2024': ['F-150', 'F-250', 'F-350', 'Mustang', 'Explorer', 'Escape', 'Edge', 'Expedition', 'EcoSport', 'Bronco', 'Bronco Sport', 'Ranger', 'Transit', 'Maverick', 'F-150 Lightning', 'Mach-E'],
    },
  },

  Chevrolet: {
    brand: 'Chevrolet',
    vinPatterns: `GM/Chevrolet VIN structure:
Position 1-3: WMI (1G1=Chevrolet USA, 1GC=Chevrolet Truck, 1GT=GMC Truck, 1GY=Cadillac, 3GK=GM Mexico)
Position 4-8: Vehicle attributes (platform, body style, engine, series)
Position 9: Check digit
Position 10: Model year
Position 11: Assembly plant`,
    engineCodes: `GM engine codes:
L3B: 2.7L Turbo I4 (310hp) — Silverado, Sierra
L84: 5.3L V8 (355hp) — Silverado, Tahoe, Suburban
L87: 6.2L V8 (420hp) — Silverado, Tahoe, Escalade
L82: 6.2L V8 (490hp) — Camaro SS
LT4: 6.2L Supercharged V8 (650hp) — Camaro ZL1, C7 Z06
LT5: 6.2L Supercharged V8 (755hp) — C7 ZR1
LT2: 6.2L V8 (495hp) — C8 Stingray
LF4: 3.6L Twin-Turbo V6 (464hp) — ATS-V, CTS-V
LGX: 3.6L V6 (305-335hp) — Camaro, Colorado, Blazer`,
    plantCodes: `GM assembly plants:
1 = Oshawa, Ontario, Canada
2 = Moraine, Ohio (closed)
5 = Bowling Green, Kentucky (Corvette)
6 = Lansing, Michigan (Grand River)
7 = Lordstown, Ohio (closed)
9 = Detroit, Michigan (Hamtramck)
A = Lakewood, Georgia
C = Wentzville, Missouri
F = Flint, Michigan
G = Spring Hill, Tennessee
K = Kansas City, Kansas
L = Lansing, Michigan (Delta Township)
N = Silao, Mexico
P = Pontiac, Michigan
S = St. Louis, Missouri (closed)
U = Detroit, Michigan (Hamtramck)`,
    partNumberFormat: 'GM OEM format: XXXXXXXX (8 digits, no separator). Example: 84127658',
    partNumberExamples: [
      '84127658 (front brake pads)',
      '84127657 (rear brake pads)',
      '12663410 (oil filter)',
      '13598505 (cabin air filter)',
      '84558976 (headlight assembly)',
    ],
    commonAftermarketBrands: ['ACDelco', 'Dorman', 'Bosch', 'Monroe', 'Moog', 'KYB', 'Gates', 'Dayco', 'TYC', 'Depo'],
    modelsByYear: {
      '2019': ['Silverado 1500', 'Silverado 2500HD', 'Camaro', 'Corvette', 'Malibu', 'Impala', 'Cruze', 'Equinox', 'Traverse', 'Tahoe', 'Suburban', 'Colorado', 'Blazer', 'Trax'],
      '2024': ['Silverado 1500', 'Silverado 2500HD', 'Silverado 3500HD', 'Camaro', 'Corvette', 'Malibu', 'Equinox', 'Traverse', 'Tahoe', 'Suburban', 'Colorado', 'Blazer', 'Trax', 'Trailblazer', 'EV Blazer', 'Equinox EV', 'Silverado EV'],
    },
  },
};

/**
 * Get brand knowledge for AI prompt injection.
 * Falls back to a generic template if brand is not in the knowledge base.
 */
export function getBrandContext(brand: string): string {
  const knowledge = BRAND_KNOWLEDGE[brand];
  if (!knowledge) {
    return `No specific knowledge available for brand "${brand}". Use general automotive knowledge but be conservative — mark uncertain data.`;
  }

  return `BRAND: ${knowledge.brand}

VIN PATTERN KNOWLEDGE:
${knowledge.vinPatterns}

ENGINE CODES:
${knowledge.engineCodes}

PLANT CODES:
${knowledge.plantCodes}

OEM PART NUMBER FORMAT: ${knowledge.partNumberFormat}
Examples: ${knowledge.partNumberExamples.join(', ')}

COMMON AFTERMARKET BRANDS: ${knowledge.commonAftermarketBrands.join(', ')}`;
}
