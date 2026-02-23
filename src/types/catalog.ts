export interface VehicleFitment {
    year: number;
    make: string;
    model: string;
    trim: string;
}

export interface CatalogItem {
    id: string;
    sku: string;
    slug: string;
    title: string;
    description: string;
    brand: string;
    placement: string;
    material: string;
    color: string;
    condition: 'new' | 'used' | 'remanufactured';
    shippingType: 'free' | 'calculated' | 'freight';
    availability: 'in_stock' | 'low_stock' | 'out_of_stock';
    sellerRating: 'standard' | 'top_rated' | 'premium';
    price: number;
    quantity: number;
    popularityScore: number;
    imageUrl: string;
    oemPartNumbers: string[];
    aftermarketPartNumbers: string[];
    epids: string[];
    kTypes: string[];
    compatibility: VehicleFitment[];
}

export interface SearchCompatibilityInput {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    vin?: string;
    epId?: string;
    kType?: string;
}

export interface CatalogFilterState {
    brands: string[];
    conditions: string[];
    placements: string[];
    availability: string[];
    shippingTypes: string[];
    sellerRatings: string[];
    guaranteedFitOnly: boolean;
    minPrice: number;
    maxPrice: number;
}

export interface CatalogQueryContext {
    query: string;
    compatibility: SearchCompatibilityInput;
    attributes: Pick<CatalogFilterState, 'brands' | 'placements'>;
}

export interface SearchResultItem {
    item: CatalogItem;
    score: number;
    guaranteedFit: boolean;
}
