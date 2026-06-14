import { authGet } from './authApi';

const BASE = '/api/fitment';

export interface VinListingRecord {
  id: string;
  customLabelSku: string | null;
  title: string | null;
  cBrand: string | null;
  cType: string | null;
  categoryId: string | null;
  categoryName: string | null;
  startPrice: string | null;
  quantity: string | null;
  conditionId: string | null;
  itemPhotoUrl: string | null;
  cManufacturerPartNumber: string | null;
  cOeOemPartNumber: string | null;
  location: string | null;
  format: string | null;
  sourceFileName: string | null;
  importedAt: string | null;
}

export interface VinListingsResponse {
  vin: string;
  vehicle: {
    vin: string;
    year: string;
    make: string;
    model: string;
    trim: string;
    bodyClass: string;
    driveType: string;
    engineCylinders: string;
    engineDisplacementL: string;
    fuelType: string;
    plantCountry: string;
    vehicleType: string;
    aiEnriched?: boolean;
    aiData?: {
      engineDescription?: string;
      transmission?: string;
      mpg?: string;
      horsepower?: string;
      torque?: string;
      seatingCapacity?: string;
      wheelbase?: string;
      curbWeight?: string;
      commonParts?: string[];
      knownFitment?: string[];
      description?: string;
    };
  };
  totalFitments: number;
  totalListings: number;
  matchStrategy: 'fitment' | 'fallback_text' | 'ai_enriched';
  listings: VinListingRecord[];
}

export function getListingsByVin(vin: string): Promise<VinListingsResponse> {
  return authGet(`${BASE}/vin/${encodeURIComponent(vin)}/listings`);
}

