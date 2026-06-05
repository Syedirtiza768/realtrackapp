export type EbayConnectionSource = 'native_oauth' | 'sellerpundit';

export interface SellerpunditLoginResponse {
  token?: string;
  accessToken?: string;
  data?: { token?: string; accessToken?: string };
}

export interface SellerpunditTokenRow {
  id: number;
  userId?: string;
  accountName: string;
  marketPlaceId: number;
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number;
  refreshTokenExpiresIn?: number;
  lastTokenRefreshDate?: string | null;
  sellerId?: string | null;
  status?: string | null;
}

export interface SellerpunditApiErrorShape {
  httpStatus: number;
  message: string;
  code?: string;
  errors: string[];
  details?: Record<string, unknown>;
}

export interface SellerpunditPublishResult {
  success: boolean;
  offerId?: string;
  listingId?: string;
  error?: string;
  errors?: string[];
  /** True when SellerPundit bulk-create failed due to a known platform/SQL defect. */
  platformError?: boolean;
  sellerPunditResponse?: Record<string, unknown>;
}

export interface PublishErrorPayload {
  source: 'sellerpundit' | 'ebay' | 'internal';
  stage: 'policy_sync' | 'validation' | 'bulk_create' | 'build' | 'unknown';
  message: string;
  errors?: string[];
  warnings?: string[];
  httpStatus?: number;
  sellerPundit?: Record<string, unknown>;
}
