import { CatalogItem, SearchCompatibilityInput, VehicleFitment } from '../types/catalog';
import { GENERATED_IMPORT_META, GENERATED_INVENTORY_DATA } from './generatedInventory';

export const VIN_LOOKUP_SAMPLE: Record<string, VehicleFitment> = {
    '4T1G11AK1RU123456': { year: 2024, make: 'Toyota', model: 'Camry', trim: 'SE' },
    '1HGCV1F31NA765432': { year: 2022, make: 'Honda', model: 'Accord', trim: 'Sport' },
    '1FTEW1C50PFA11223': { year: 2023, make: 'Ford', model: 'F-150', trim: 'XLT' },
};

const CATALOG_ITEMS: CatalogItem[] = [
    {
        id: '1',
        sku: 'ALT-TOY-245',
        slug: 'toyota-camry-oem-alternator',
        title: 'OEM Alternator 150A for Toyota Camry 2.5L',
        description: 'Genuine Toyota alternator tested for stable 14.2V output.',
        brand: 'Toyota',
        placement: 'Front',
        material: 'Aluminum',
        color: 'Silver',
        condition: 'used',
        shippingType: 'free',
        availability: 'in_stock',
        sellerRating: 'premium',
        price: 129.99,
        quantity: 45,
        popularityScore: 95,
        imageUrl: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['27060-0V210'],
        aftermarketPartNumbers: ['A245-TRQ'],
        epids: ['ePID-88213'],
        kTypes: ['K-552100'],
        compatibility: [
            { year: 2024, make: 'Toyota', model: 'Camry', trim: 'SE' },
            { year: 2023, make: 'Toyota', model: 'Camry', trim: 'LE' },
            { year: 2022, make: 'Toyota', model: 'RAV4', trim: 'XLE' },
        ],
    },
    {
        id: '2',
        sku: 'BRK-PAD-002',
        slug: 'ceramic-brake-pad-set-front',
        title: 'Ceramic Brake Pad Set Front Axle',
        description: 'Low-dust ceramic brake pads for quiet stopping performance.',
        brand: 'Akebono',
        placement: 'Front',
        material: 'Ceramic',
        color: 'Black',
        condition: 'new',
        shippingType: 'free',
        availability: 'low_stock',
        sellerRating: 'top_rated',
        price: 54.5,
        quantity: 12,
        popularityScore: 86,
        imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['04465-06090'],
        aftermarketPartNumbers: ['ACT002'],
        epids: ['ePID-77100'],
        kTypes: ['K-442001'],
        compatibility: [
            { year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE' },
            { year: 2021, make: 'Toyota', model: 'Corolla', trim: 'XSE' },
            { year: 2020, make: 'Honda', model: 'Accord', trim: 'EX' },
        ],
    },
    {
        id: '3',
        sku: 'LGT-LED-444',
        slug: 'led-tail-light-assembly-right',
        title: 'LED Tail Light Rear Lamp Right Side',
        description: 'Aftermarket rear lamp with OE-style connector and lens fit.',
        brand: 'Depo',
        placement: 'Rear Right',
        material: 'Polycarbonate',
        color: 'Red',
        condition: 'new',
        shippingType: 'calculated',
        availability: 'in_stock',
        sellerRating: 'top_rated',
        price: 199.99,
        quantity: 18,
        popularityScore: 91,
        imageUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['81551-06230'],
        aftermarketPartNumbers: ['RL-444R'],
        epids: ['ePID-55519'],
        kTypes: ['K-331120'],
        compatibility: [
            { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE' },
            { year: 2023, make: 'Toyota', model: 'Camry', trim: 'SE' },
            { year: 2021, make: 'Honda', model: 'Civic', trim: 'Sport' },
        ],
    },
    {
        id: '4',
        sku: 'BUM-FRD-119',
        slug: 'ford-f150-front-bumper-cover-fascia',
        title: 'Front Bumper Cover Fascia for Ford F-150',
        description: 'Primed fascia ready for paint, direct replacement mount points.',
        brand: 'Sherman',
        placement: 'Front',
        material: 'ABS Plastic',
        color: 'Black',
        condition: 'new',
        shippingType: 'freight',
        availability: 'in_stock',
        sellerRating: 'standard',
        price: 329.0,
        quantity: 20,
        popularityScore: 89,
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['FL3Z-17D957-AA'],
        aftermarketPartNumbers: ['F119-FASCIA'],
        epids: ['ePID-10109'],
        kTypes: ['K-660020'],
        compatibility: [
            { year: 2023, make: 'Ford', model: 'F-150', trim: 'XLT' },
            { year: 2022, make: 'Ford', model: 'F-150', trim: 'Lariat' },
            { year: 2021, make: 'Ford', model: 'F-150', trim: 'XL' },
        ],
    },
    {
        id: '5',
        sku: 'SEN-O2-112',
        slug: 'upstream-oxygen-sensor-universal',
        title: 'Upstream Oxygen Sensor Heated O2 Sensor',
        description: 'Direct-fit sensor for improved fuel trim and emissions.',
        brand: 'Denso',
        placement: 'Engine Bay',
        material: 'Steel',
        color: 'Metallic',
        condition: 'new',
        shippingType: 'free',
        availability: 'out_of_stock',
        sellerRating: 'premium',
        price: 42.0,
        quantity: 0,
        popularityScore: 68,
        imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['89467-48011'],
        aftermarketPartNumbers: ['O2-112A'],
        epids: ['ePID-88912'],
        kTypes: ['K-778004'],
        compatibility: [
            { year: 2022, make: 'Toyota', model: 'RAV4', trim: 'XLE' },
            { year: 2021, make: 'Honda', model: 'CR-V', trim: 'EX' },
            { year: 2020, make: 'Chevrolet', model: 'Equinox', trim: 'LT' },
        ],
    },
    {
        id: '6',
        sku: 'FIL-OIL-999',
        slug: 'oil-filter-bulk-pack-24',
        title: 'Oil Filter Bulk Pack 24 Count',
        description: 'Commercial-grade bulk oil filters for maintenance shops.',
        brand: 'Mann',
        placement: 'Engine Bay',
        material: 'Cellulose Blend',
        color: 'Yellow',
        condition: 'new',
        shippingType: 'calculated',
        availability: 'in_stock',
        sellerRating: 'top_rated',
        price: 89.0,
        quantity: 1200,
        popularityScore: 93,
        imageUrl: 'https://images.unsplash.com/photo-1625768370122-f83f4f295f0d?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['90915-YZZF2'],
        aftermarketPartNumbers: ['HU7012Z-24'],
        epids: ['ePID-32010'],
        kTypes: ['K-210510'],
        compatibility: [
            { year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE' },
            { year: 2023, make: 'Honda', model: 'Accord', trim: 'Sport' },
            { year: 2021, make: 'Ford', model: 'Escape', trim: 'SE' },
        ],
    },
    {
        id: '7',
        sku: 'STR-CHE-355',
        slug: 'chevy-silverado-front-strut-assembly',
        title: 'Front Strut Assembly Pair for Chevrolet Silverado',
        description: 'Loaded struts designed for stable ride and reduced body roll.',
        brand: 'Monroe',
        placement: 'Front',
        material: 'Steel',
        color: 'Black',
        condition: 'remanufactured',
        shippingType: 'freight',
        availability: 'low_stock',
        sellerRating: 'standard',
        price: 249.99,
        quantity: 6,
        popularityScore: 74,
        imageUrl: 'https://images.unsplash.com/photo-1542367592-8849eb950fd8?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['84176631'],
        aftermarketPartNumbers: ['STS-355PR'],
        epids: ['ePID-66210'],
        kTypes: ['K-501212'],
        compatibility: [
            { year: 2022, make: 'Chevrolet', model: 'Silverado', trim: 'LT' },
            { year: 2021, make: 'Chevrolet', model: 'Silverado', trim: 'Custom' },
            { year: 2020, make: 'Ford', model: 'Explorer', trim: 'XLT' },
        ],
    },
    {
        id: '8',
        sku: 'HDL-HON-820',
        slug: 'honda-accord-led-headlight-left',
        title: 'LED Headlight Assembly Left for Honda Accord',
        description: 'DOT-compliant front lamp with adaptive beam support.',
        brand: 'TYC',
        placement: 'Front Left',
        material: 'Polycarbonate',
        color: 'Clear',
        condition: 'new',
        shippingType: 'calculated',
        availability: 'in_stock',
        sellerRating: 'premium',
        price: 289.5,
        quantity: 28,
        popularityScore: 88,
        imageUrl: 'https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['33150-TVA-A11'],
        aftermarketPartNumbers: ['HDL-820L'],
        epids: ['ePID-99087'],
        kTypes: ['K-402118'],
        compatibility: [
            { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport' },
            { year: 2023, make: 'Honda', model: 'Accord', trim: 'EX' },
            { year: 2022, make: 'Honda', model: 'Civic', trim: 'Touring' },
        ],
    },
    {
        id: '9',
        sku: 'RAD-TOY-610',
        slug: 'toyota-rav4-radiator-core',
        title: 'Radiator Core Cooling Unit for Toyota RAV4',
        description: 'High-efficiency cooling unit with anti-corrosion fins.',
        brand: 'Denso',
        placement: 'Front',
        material: 'Aluminum',
        color: 'Silver',
        condition: 'new',
        shippingType: 'freight',
        availability: 'in_stock',
        sellerRating: 'top_rated',
        price: 219.0,
        quantity: 30,
        popularityScore: 82,
        imageUrl: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['16400-0V340'],
        aftermarketPartNumbers: ['RAD-610T'],
        epids: ['ePID-31310'],
        kTypes: ['K-550920'],
        compatibility: [
            { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'Limited' },
            { year: 2023, make: 'Toyota', model: 'RAV4', trim: 'XLE' },
            { year: 2022, make: 'Toyota', model: 'Camry', trim: 'XLE' },
        ],
    },
    {
        id: '10',
        sku: 'MIR-FRD-200',
        slug: 'ford-escape-side-mirror-right-heated',
        title: 'Heated Side Mirror Right for Ford Escape',
        description: 'Power-adjusted mirror with integrated turn signal lamp.',
        brand: 'Ford',
        placement: 'Rear Right',
        material: 'ABS Plastic',
        color: 'Black',
        condition: 'used',
        shippingType: 'free',
        availability: 'in_stock',
        sellerRating: 'standard',
        price: 119.0,
        quantity: 40,
        popularityScore: 77,
        imageUrl: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['CJ5Z-17682-AA'],
        aftermarketPartNumbers: ['MIR-200R'],
        epids: ['ePID-74522'],
        kTypes: ['K-711803'],
        compatibility: [
            { year: 2023, make: 'Ford', model: 'Escape', trim: 'SE' },
            { year: 2022, make: 'Ford', model: 'Escape', trim: 'SEL' },
            { year: 2021, make: 'Ford', model: 'Explorer', trim: 'XLT' },
        ],
    },
    {
        id: '11',
        sku: 'GRL-CHE-140',
        slug: 'chevy-malibu-front-grille-assembly',
        title: 'Front Grille Assembly for Chevrolet Malibu',
        description: 'Gloss black grille assembly with chrome surround.',
        brand: 'GM',
        placement: 'Front',
        material: 'ABS Plastic',
        color: 'Black',
        condition: 'new',
        shippingType: 'calculated',
        availability: 'in_stock',
        sellerRating: 'top_rated',
        price: 165.0,
        quantity: 25,
        popularityScore: 69,
        imageUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['84027177'],
        aftermarketPartNumbers: ['GRL-140M'],
        epids: ['ePID-41098'],
        kTypes: ['K-312220'],
        compatibility: [
            { year: 2022, make: 'Chevrolet', model: 'Malibu', trim: 'LT' },
            { year: 2021, make: 'Chevrolet', model: 'Malibu', trim: 'RS' },
            { year: 2020, make: 'Honda', model: 'Civic', trim: 'EX' },
        ],
    },
    {
        id: '12',
        sku: 'CTL-HON-500',
        slug: 'honda-crv-control-arm-front-lower',
        title: 'Front Lower Control Arm for Honda CR-V',
        description: 'Includes bushings and ball joint pre-installed.',
        brand: 'Moog',
        placement: 'Front',
        material: 'Steel',
        color: 'Black',
        condition: 'new',
        shippingType: 'free',
        availability: 'in_stock',
        sellerRating: 'premium',
        price: 99.99,
        quantity: 67,
        popularityScore: 84,
        imageUrl: 'https://images.unsplash.com/photo-1619642741220-f03f8a2f2b2c?auto=format&fit=crop&w=800&q=80',
        oemPartNumbers: ['51350-TLA-A03'],
        aftermarketPartNumbers: ['CA-500FL'],
        epids: ['ePID-57112'],
        kTypes: ['K-834100'],
        compatibility: [
            { year: 2024, make: 'Honda', model: 'CR-V', trim: 'EX' },
            { year: 2023, make: 'Honda', model: 'CR-V', trim: 'Sport' },
            { year: 2022, make: 'Honda', model: 'Accord', trim: 'LX' },
        ],
    },
];

const SOURCE_ITEMS = GENERATED_INVENTORY_DATA.length > 0 ? GENERATED_INVENTORY_DATA : CATALOG_ITEMS;

const getUniqueSorted = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

export const INVENTORY_DATA = SOURCE_ITEMS;

export const COMPATIBILITY_OPTIONS = {
    years: Array.from(new Set(INVENTORY_DATA.flatMap(item => item.compatibility.map(c => c.year)))).sort((a, b) => b - a),
    makes: getUniqueSorted(INVENTORY_DATA.flatMap(item => item.compatibility.map(c => c.make))),
};

export const getModelsByMake = (make?: string) => {
    if (!make) {
        return [];
    }

    return getUniqueSorted(
        INVENTORY_DATA.flatMap(item => item.compatibility)
            .filter(item => item.make.toLowerCase() === make.toLowerCase())
            .map(item => item.model)
    );
};

export const getTrimsByModel = (make?: string, model?: string) => {
    if (!make || !model) {
        return [];
    }

    return getUniqueSorted(
        INVENTORY_DATA.flatMap(item => item.compatibility)
            .filter(item => item.make.toLowerCase() === make.toLowerCase() && item.model.toLowerCase() === model.toLowerCase())
            .map(item => item.trim)
    );
};

export const decodeVin = (vin: string): VehicleFitment | null => {
    if (!vin) {
        return null;
    }

    const normalizedVin = vin.trim().toUpperCase();
    return VIN_LOOKUP_SAMPLE[normalizedVin] ?? null;
};

export const compatibilityToLabel = (input: SearchCompatibilityInput) => {
    const parts = [input.year, input.make, input.model, input.trim].filter(Boolean);
    return parts.join(' ');
};

export const dataIntegrationNotes = {
    source: 'B12_p2_eBay_Verified.xlsx',
    generatedSource: GENERATED_IMPORT_META.sourceFile,
    generatedImportedAt: GENERATED_IMPORT_META.importedAt,
    normalization: [
        'Mapped source rows to CatalogItem schema with normalized enums.',
        'Extracted fitment rows into compatibility arrays for indexable matching.',
        'Preserved SKU and OEM/aftermarket part numbers as exact-match tokens.',
    ],
};

export const seedProfile = {
    totalSkus: INVENTORY_DATA.length,
    makeCoverage: new Set(INVENTORY_DATA.flatMap(item => item.compatibility.map(c => c.make))).size,
    importedRows: GENERATED_IMPORT_META.rowCount,
};
