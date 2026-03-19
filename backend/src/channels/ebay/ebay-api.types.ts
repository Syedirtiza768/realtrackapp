/**
 * Shared eBay API type definitions.
 *
 * These types map to eBay REST API payloads for the
 * Inventory, Taxonomy, Fulfillment, Browse, and Commerce APIs.
 * Only used internally — never exposed to frontend.
 */

// ════════════════════════════════════════════
//  Inventory API types
// ════════════════════════════════════════════

export interface EbayInventoryItem {
  /** SKU is set in URL path for PUT; present in response from GET */
  sku?: string;
  locale?: string;
  product: {
    title: string;
    description?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>; // e.g. { "Brand": ["TRW"], "Type": ["Brake Pad"] }
    brand?: string;
    mpn?: string;
    upc?: string[];
    ean?: string[];
    epid?: string;
  };
  condition: EbayConditionEnum;
  conditionDescription?: string;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  packageWeightAndSize?: {
    weight?: { value: number; unit: 'POUND' | 'KILOGRAM' | 'OUNCE' | 'GRAM' };
    dimensions?: {
      length: { value: number; unit: 'INCH' | 'CENTIMETER' };
      width: { value: number; unit: 'INCH' | 'CENTIMETER' };
      height: { value: number; unit: 'INCH' | 'CENTIMETER' };
    };
  };
}

export type EbayConditionEnum =
  | 'NEW'
  | 'LIKE_NEW'
  | 'NEW_OTHER'
  | 'NEW_WITH_DEFECTS'
  | 'MANUFACTURER_REFURBISHED'
  | 'CERTIFIED_REFURBISHED'
  | 'EXCELLENT_REFURBISHED'
  | 'VERY_GOOD_REFURBISHED'
  | 'GOOD_REFURBISHED'
  | 'SELLER_REFURBISHED'
  | 'USED_EXCELLENT'
  | 'USED_VERY_GOOD'
  | 'USED_GOOD'
  | 'USED_ACCEPTABLE'
  | 'FOR_PARTS_OR_NOT_WORKING';

export interface EbayInventoryItemPage {
  href?: string;
  limit: number;
  next?: string;
  offset: number;
  prev?: string;
  size: number;
  total: number;
  inventoryItems: EbayInventoryItem[];
}

export interface EbayOffer {
  offerId?: string;
  sku: string;
  marketplaceId: string; // 'EBAY_US' | 'EBAY_MOTORS_US'
  format: 'FIXED_PRICE' | 'AUCTION';
  listingDescription?: string;
  availableQuantity?: number;
  categoryId: string;
  merchantLocationKey?: string;
  pricingSummary: {
    price: { value: string; currency: string };
    minimumAdvertisedPrice?: { value: string; currency: string };
  };
  listingPolicies?: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  };
  tax?: {
    applyTax: boolean;
  };
  /** Listing duration (e.g. 'GTC' for Good 'Til Cancelled) */
  listingDuration?: string;
  /** eBay-format vehicle compatibility */
  compatibility?: EbayCompatibilityPayload;
}

export interface EbayCompatibilityPayload {
  compatibleProducts: EbayCompatibleProduct[];
}

export interface EbayCompatibleProduct {
  compatibilityProperties: Array<{
    name: string; // 'Make' | 'Model' | 'Year' | 'Trim' | 'Engine'
    value: string;
  }>;
  notes?: string;
}

export interface EbayOfferResponse {
  offerId: string;
  sku: string;
  marketplaceId: string;
  format: string;
  listingId?: string;
}

export interface EbayPublishResponse {
  listingId: string;
  warnings?: EbayError[];
}

export interface EbayPriceQuantityUpdate {
  offers: Array<{
    offerId: string;
    availableQuantity?: number;
    price?: { value: string; currency: string };
  }>;
}

export interface EbayBulkResponse {
  responses: Array<{
    statusCode: number;
    offerId?: string;
    sku?: string;
    listingId?: string;
    errors?: EbayError[];
    warnings?: EbayError[];
  }>;
}

export interface EbayLocation {
  merchantLocationKey: string;
  location: {
    address: {
      addressLine1?: string;
      city?: string;
      stateOrProvince?: string;
      postalCode?: string;
      country: string;
    };
  };
  locationTypes: string[];
  name?: string;
  merchantLocationStatus: 'ENABLED' | 'DISABLED';
}

// ════════════════════════════════════════════
//  Taxonomy API types
// ════════════════════════════════════════════

export interface EbayCategoryTree {
  categoryTreeId: string;
  categoryTreeVersion: string;
  rootCategoryNode: EbayCategoryNode;
}

export interface EbayCategoryNode {
  category: {
    categoryId: string;
    categoryName: string;
  };
  categoryTreeNodeLevel: number;
  leafCategoryTreeNode: boolean;
  childCategoryTreeNodes?: EbayCategoryNode[];
}

export interface EbayCategorySubtree {
  categoryId: string;
  categoryName: string;
  categorySubtreeNode: EbayCategoryNode;
}

export interface EbayCategorySuggestion {
  category: {
    categoryId: string;
    categoryName: string;
  };
  categoryTreeNodeAncestors: Array<{
    categoryId: string;
    categoryName: string;
  }>;
  categoryTreeNodeLevel: number;
  relevancy: string;
}

export interface EbayAspect {
  localizedAspectName: string;
  aspectConstraint: {
    aspectDataType: string;
    aspectMode: 'FREE_TEXT' | 'SELECTION_ONLY';
    aspectRequired: boolean;
    aspectUsage: 'RECOMMENDED' | 'OPTIONAL';
  };
  aspectValues?: Array<{
    localizedValue: string;
    valueConstraints?: Array<{
      applicableForLocalizedAspectName: string;
      applicableForLocalizedAspectValues: string[];
    }>;
  }>;
}

export interface EbayCompatibilityProperty {
  propertyName: string; // 'Make' | 'Model' | 'Year' | 'Trim' | 'Engine'
  localizedPropertyName: string;
}

export interface EbayCompatibilityValue {
  value: string;
  displayName?: string;
}

// ════════════════════════════════════════════
//  Fulfillment API types
// ════════════════════════════════════════════

export interface EbayOrderPage {
  href?: string;
  limit: number;
  next?: string;
  offset: number;
  prev?: string;
  total: number;
  orders: EbayOrder[];
}

export interface EbayOrder {
  orderId: string;
  legacyOrderId?: string;
  creationDate: string;
  lastModifiedDate: string;
  orderFulfillmentStatus: string;
  orderPaymentStatus: string;
  buyer: {
    username: string;
  };
  pricingSummary: {
    total: { value: string; currency: string };
    subtotal?: { value: string; currency: string };
    deliveryCost?: { value: string; currency: string };
  };
  lineItems: EbayLineItem[];
  fulfillmentStartInstructions?: Array<{
    shippingStep?: {
      shipTo?: Record<string, unknown>;
      shippingCarrierCode?: string;
      shippingServiceCode?: string;
    };
  }>;
}

export interface EbayLineItem {
  lineItemId: string;
  legacyItemId?: string;
  sku?: string;
  title: string;
  quantity: number;
  lineItemCost: { value: string; currency: string };
  deliveryCost?: { value: string; currency: string };
}

export interface EbayFulfillment {
  fulfillmentId: string;
  shipmentTrackingNumber: string;
  shippingCarrierCode: string;
  shippedDate: string;
  lineItems: Array<{
    lineItemId: string;
    quantity: number;
  }>;
}

export interface EbayShippingFulfillmentRequest {
  lineItems: Array<{ lineItemId: string; quantity: number }>;
  shippingCarrierCode: string;
  trackingNumber: string;
}

// ════════════════════════════════════════════
//  Browse API types
// ════════════════════════════════════════════

export interface EbaySearchResult {
  href?: string;
  total: number;
  next?: string;
  offset: number;
  limit: number;
  itemSummaries?: EbayItemSummary[];
}

export interface EbayItemSummary {
  itemId: string;
  title: string;
  price: { value: string; currency: string };
  condition: string;
  conditionId: string;
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackPercentage: string;
    feedbackScore: number;
  };
  shippingOptions?: Array<{
    shippingCost?: { value: string; currency: string };
    type: string;
  }>;
  image?: { imageUrl: string };
  categories?: Array<{ categoryId: string; categoryName: string }>;
}

export interface EbayItem extends EbayItemSummary {
  description: string;
  shortDescription?: string;
  brand?: string;
  mpn?: string;
  gtin?: string;
  epid?: string;
  localizedAspects?: Array<{
    name: string;
    value: string;
  }>;
  quantityLimitPerBuyer?: number;
  estimatedAvailabilities?: Array<{
    estimatedAvailableQuantity: number;
    estimatedSoldQuantity: number;
  }>;
}

// ════════════════════════════════════════════
//  Common types
// ════════════════════════════════════════════

export interface EbayError {
  errorId: number;
  domain: string;
  subdomain?: string;
  category: string;
  message: string;
  longMessage?: string;
  parameters?: Array<{ name: string; value: string }>;
}

export interface EbayApiConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sandbox: boolean;
  baseUrl: string;
  authUrl: string;
}
