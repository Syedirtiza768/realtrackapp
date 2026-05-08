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
  };
  totalFitments: number;
  totalListings: number;
  matchStrategy: 'fitment' | 'fallback_text';
  listings: VinListingRecord[];
}

export function getListingsByVin(vin: string): Promise<VinListingsResponse> {
  return authGet(`${BASE}/vin/${encodeURIComponent(vin)}/listings`);
}

