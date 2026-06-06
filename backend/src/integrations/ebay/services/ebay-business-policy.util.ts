import { mapToEbayConditionEnum } from '../../../channels/ebay/ebay-listing-condition.util.js';
import type { EbayConditionEnum } from '../../../channels/ebay/ebay-api.types.js';

export type EbayPolicyKind = 'fulfillment' | 'payment' | 'return';

const REST_ID_KEYS: Record<EbayPolicyKind, string[]> = {
  fulfillment: ['fulfillmentPolicyId', 'fulfillment_policy_id'],
  payment: ['paymentPolicyId', 'payment_policy_id'],
  return: ['returnPolicyId', 'return_policy_id'],
};

/** eBay REST business policy IDs are long numeric strings (typically 11–12 digits). */
export function isLikelyEbayRestPolicyId(
  id: string | null | undefined,
): boolean {
  if (!id?.trim()) return false;
  return /^\d{10,}$/.test(id.trim());
}

export function extractEbayRestPolicyId(
  raw: Record<string, unknown>,
  kind: EbayPolicyKind,
): string | null {
  const details =
    (raw.policy_details as Record<string, unknown> | undefined) ??
    (raw.policyDetails as Record<string, unknown> | undefined);

  for (const key of REST_ID_KEYS[kind]) {
    const fromDetails = details?.[key];
    if (fromDetails != null && isLikelyEbayRestPolicyId(String(fromDetails))) {
      return String(fromDetails).trim();
    }
    const fromRoot = raw[key];
    if (fromRoot != null && isLikelyEbayRestPolicyId(String(fromRoot))) {
      return String(fromRoot).trim();
    }
  }

  const fallback = raw.policyId ?? raw.id;
  if (fallback != null && isLikelyEbayRestPolicyId(String(fallback))) {
    return String(fallback).trim();
  }

  return null;
}

export function readPolicyGeoSite(raw: Record<string, unknown>): string | null {
  const details =
    (raw.policy_details as Record<string, unknown> | undefined) ??
    (raw.policyDetails as Record<string, unknown> | undefined);
  const geo =
    raw.geoSite ??
    raw.geo_site ??
    details?.geoSite ??
    details?.marketplaceId ??
    details?.marketplace_id ??
    raw.marketplaceId;
  return geo != null ? String(geo).trim().toUpperCase() : null;
}

const US_PA_RETURN_MARKETPLACES = new Set([
  'EBAY_US',
  'EBAY_MOTORS_US',
  'EBAY_MOTORS',
]);

export function geoSitePreferenceForMarketplace(marketplaceId: string): string[] {
  const mp = marketplaceId.trim().toUpperCase();
  if (mp === 'EBAY_MOTORS_US' || mp === 'EBAY_MOTORS') {
    return ['EBAY_MOTORS_US', 'EBAY_MOTORS', 'EBAY_US'];
  }
  if (mp === 'EBAY_US') return ['EBAY_US'];
  if (mp === 'EBAY_DE') return ['EBAY_DE'];
  if (mp === 'EBAY_GB') return ['EBAY_GB'];
  if (mp === 'EBAY_AU') return ['EBAY_AU'];
  return [mp, 'EBAY_US'];
}

/** True when policy geoSite is blank (wildcard) or matches the target marketplace. */
export function policyMatchesMarketplaceGeo(
  policyGeoSite: string | null | undefined,
  marketplaceId: string,
): boolean {
  if (!policyGeoSite?.trim()) return true;
  const prefs = geoSitePreferenceForMarketplace(marketplaceId);
  return prefs.includes(policyGeoSite.trim().toUpperCase());
}

export interface PolicyPickCandidate {
  ebayPolicyId: string;
  isDefault: boolean;
  geoSite: string | null;
  rawPayload?: Record<string, unknown>;
}

export interface ReturnPolicyPickCandidate extends PolicyPickCandidate {
  rawPayload?: Record<string, unknown>;
}

const PA_RETURN_GUIDANCE =
  'New and New Other Parts & Accessories listings require a return policy with at least 30 days and seller-paid return shipping (eBay June 2025 P&A rule). Used and other conditions may keep buyer-paid return shipping when 30+ days and returns are accepted. Update a return business policy in eBay Seller Hub if needed, re-sync policies in Settings → eBay Integrations, then publish again.';

const MANDATORY_PA_FREE_RETURN_CONDITIONS = new Set<EbayConditionEnum>([
  'NEW',
  'NEW_OTHER',
]);

export function partsAccessoriesReturnPolicyGuidance(): string {
  return PA_RETURN_GUIDANCE;
}

export type ReturnPolicyStateSummary = {
  days: number | null;
  payer: string | null;
  returnsAccepted: boolean;
  paCompliant: boolean;
  evaluable: boolean;
};

export function summarizeReturnPolicyState(
  raw: Record<string, unknown> | null | undefined,
): ReturnPolicyStateSummary {
  const evaluable = canEvaluateReturnPolicyCompliance(raw);
  return {
    days: evaluable ? readReturnPeriodDays(raw ?? {}) : null,
    payer: evaluable ? readReturnShippingCostPayer(raw ?? {}) : null,
    returnsAccepted: raw ? readReturnsAccepted(raw) : true,
    paCompliant: isPartsAccessoriesCompliantReturnPolicy(raw),
    evaluable,
  };
}

/** Actionable publish error when a known return policy id is not P&A-compliant. */
export function paReturnPolicyBlockedMessage(params: {
  returnPolicyId: string;
  raw?: Record<string, unknown> | null;
  storeName?: string;
  marketplaceId?: string;
  condition?: string | null;
  accountApiUnavailable?: boolean;
}): string {
  const state = summarizeReturnPolicyState(params.raw);
  const store = params.storeName ? `"${params.storeName}"` : 'this store';
  const policyGeo = readPolicyGeoSite(params.raw ?? {});
  const parts: string[] = [
    `Return policy ${params.returnPolicyId} for ${store} is not P&A-compliant`,
  ];
  if (state.evaluable) {
    parts.push(
      `(returns: ${state.returnsAccepted ? 'yes' : 'no'}, window: ${state.days ?? '?'} days, return shipping: ${state.payer ?? 'unknown'})`,
    );
  }
  if (params.condition?.trim()) {
    parts.push(`Listing condition: ${params.condition.trim()}.`);
  }
  if (
    params.marketplaceId &&
    policyGeo &&
    !policyMatchesMarketplaceGeo(policyGeo, params.marketplaceId)
  ) {
    parts.push(
      `This policy is for ${policyGeo} but you are publishing to ${params.marketplaceId} — create or sync ${params.marketplaceId} return policies in Seller Hub, enable that marketplace on the store, or publish to ${policyGeo} instead.`,
    );
  }
  if (params.condition?.trim()) {
    const mapped = mapToEbayConditionEnum(params.condition);
    if (!conditionRequiresMandatoryPaFreeReturn(mapped)) {
      parts.push(
        `This block applies because the listing is being published as "${mapped}" (seller-paid returns are only required for New / New Other). If this is used inventory, set Condition ID to 3000 (Used) on the catalog/listing and publish again.`,
      );
    }
  }
  parts.push(
    'eBay US requires returns accepted, 30+ days, and seller-paid return shipping for New and New Other Parts & Accessories listings. Used salvage parts may keep buyer-paid return shipping when the catalog Condition ID is 3000 (Used) or similar.',
  );
  if (params.accountApiUnavailable) {
    parts.push(
      'Automatic policy upgrade via eBay Account API is unavailable for this SellerPundit-linked store (token lacks sell.account access).',
    );
  }
  parts.push(
    'In eBay Seller Hub, edit the return business policy (or create a new one), then re-sync policies in Settings → eBay Integrations and publish again.',
  );
  return parts.join(' ');
}

/** US marketplace/category scope where eBay's June 2025 P&A return rule applies. */
export function marketplaceRequiresPartsAccessoriesReturnPolicy(
  marketplaceId: string,
  categoryId?: string | null,
): boolean {
  const mp = marketplaceId.trim().toUpperCase();
  if (!US_PA_RETURN_MARKETPLACES.has(mp)) return false;
  if (mp === 'EBAY_MOTORS_US' || mp === 'EBAY_MOTORS') return true;

  const cat = Number.parseInt(String(categoryId ?? '').trim(), 10);
  if (!Number.isFinite(cat) || cat <= 0) return false;
  // Motors P&A and common US parts category ranges (eBay enforces per listing category).
  return (cat >= 6000 && cat < 7000) || cat >= 33_000;
}

/**
 * eBay's June 2025 P&A mandate applies to New / New Other fixed-price listings only.
 * @see https://www.ebay.com/sellercenter/news/2025-june/parts-accessories-return-policy
 */
export function conditionRequiresMandatoryPaFreeReturn(
  condition: string | null | undefined,
): boolean {
  if (!condition?.trim()) return false;
  const mapped = mapToEbayConditionEnum(condition);
  return MANDATORY_PA_FREE_RETURN_CONDITIONS.has(mapped);
}

/** Full listing-level check: P&A marketplace/category scope + New/New Other condition. */
export function listingRequiresPartsAccessoriesReturnPolicy(
  marketplaceId: string,
  categoryId?: string | null,
  condition?: string | null,
): boolean {
  return (
    marketplaceRequiresPartsAccessoriesReturnPolicy(marketplaceId, categoryId) &&
    conditionRequiresMandatoryPaFreeReturn(condition)
  );
}

function policyDetails(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const details = raw.policy_details ?? raw.policyDetails;
  return details != null && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : undefined;
}

function readReturnPeriodDays(raw: Record<string, unknown>): number | null {
  const period =
    raw.returnPeriod ??
    raw.return_period ??
    policyDetails(raw)?.returnPeriod ??
    policyDetails(raw)?.return_period;
  if (period != null && typeof period === 'object' && !Array.isArray(period)) {
    const p = period as { value?: number | string; unit?: string };
    const unit = String(p.unit ?? 'DAY').toUpperCase();
    if (unit === 'DAY') {
      const days = Number(p.value);
      return Number.isFinite(days) ? days : null;
    }
  }

  for (const key of [
    'returnWithinDays',
    'return_within_days',
    'returnsWithinDays',
    'returns_within_days',
  ]) {
    const n = Number(raw[key] ?? policyDetails(raw)?.[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const details = policyDetails(raw);
  const within =
    details?.ReturnsWithinOption ??
    details?.returnsWithinOption ??
    raw.ReturnsWithinOption ??
    raw.returnsWithinOption;
  if (typeof within === 'string') {
    const match = within.match(/(\d+)/);
    if (match) return Number(match[1]);
  }
  if (typeof within === 'number' && within > 0) return within;
  return null;
}

function readReturnShippingCostPayer(raw: Record<string, unknown>): string | null {
  const payer =
    raw.returnShippingCostPayer ??
    raw.return_shipping_cost_payer ??
    policyDetails(raw)?.returnShippingCostPayer ??
    policyDetails(raw)?.return_shipping_cost_payer ??
    policyDetails(raw)?.ShippingCostPaidByOption ??
    policyDetails(raw)?.shippingCostPaidByOption ??
    raw.ShippingCostPaidByOption ??
    raw.shippingCostPaidByOption;
  return payer != null ? String(payer).trim().toUpperCase() : null;
}

function readReturnsAccepted(raw: Record<string, unknown>): boolean {
  const val =
    raw.returnsAccepted ??
    raw.returns_accepted ??
    policyDetails(raw)?.ReturnsAcceptedOption ??
    policyDetails(raw)?.returnsAcceptedOption;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    if (s === 'FALSE' || s === 'RETURNSNOTACCEPTED' || s === 'NO_RETURNS') {
      return false;
    }
    return s === 'TRUE' || s.includes('ACCEPTED');
  }
  return true;
}

/** Whether return-policy compliance can be evaluated from cached payload fields. */
export function canEvaluateReturnPolicyCompliance(
  raw: Record<string, unknown> | null | undefined,
): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return readReturnPeriodDays(raw) != null && readReturnShippingCostPayer(raw) != null;
}

/** eBay P&A: returns accepted, >= 30 days, seller pays return shipping (domestic). */
export function isPartsAccessoriesCompliantReturnPolicy(
  raw: Record<string, unknown> | null | undefined,
): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (!canEvaluateReturnPolicyCompliance(raw)) return false;
  if (!readReturnsAccepted(raw)) return false;

  const days = readReturnPeriodDays(raw);
  if (days == null || days < 30) return false;

  const payer = readReturnShippingCostPayer(raw);
  if (!payer) return false;
  return payer === 'SELLER' || payer.includes('SELLER');
}

/** Return policy that accepts returns 30+ days but buyer pays — candidate for eBay API upgrade. */
export function pickReturnPolicyUpgradeCandidate(
  items: ReturnPolicyPickCandidate[],
  marketplaceId: string,
  preferredPolicyId?: string | null,
): ReturnPolicyPickCandidate | null {
  const valid = items.filter(
    (x) =>
      isLikelyEbayRestPolicyId(x.ebayPolicyId) &&
      policyMatchesMarketplaceGeo(x.geoSite, marketplaceId),
  );
  if (!valid.length) return null;

  const prefs = geoSitePreferenceForMarketplace(marketplaceId);
  const matchesGeo = (x: ReturnPolicyPickCandidate) =>
    policyMatchesMarketplaceGeo(x.geoSite, marketplaceId);

  const upgradeable = valid.filter((x) => {
    if (!matchesGeo(x)) return false;
    const raw = x.rawPayload ?? {};
    if (!canEvaluateReturnPolicyCompliance(raw)) return false;
    if (!readReturnsAccepted(raw)) return false;
    const days = readReturnPeriodDays(raw);
    if (days == null || days < 30) return false;
    const payer = readReturnShippingCostPayer(raw);
    return payer != null && !payer.includes('SELLER');
  });
  if (!upgradeable.length) return null;

  if (preferredPolicyId) {
    const preferred = upgradeable.find((x) => x.ebayPolicyId === preferredPolicyId);
    if (preferred) return preferred;
  }

  for (const geo of prefs) {
    const match =
      upgradeable.find((x) => x.geoSite === geo && x.isDefault) ??
      upgradeable.find((x) => x.geoSite === geo);
    if (match) return match;
  }

  return upgradeable.find((x) => x.isDefault) ?? upgradeable[0] ?? null;
}

export function buildPaCompliantReturnPolicyRequest(
  marketplaceId: string,
  template?: Record<string, unknown> | null,
): Record<string, unknown> {
  const raw = template ?? {};
  const categoryTypes =
    raw.categoryTypes ??
    policyDetails(raw)?.categoryTypes ??
    [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }];
  const days = Math.max(30, readReturnPeriodDays(raw) ?? 30);
  return {
    name: String(raw.name ?? 'P&A Compliant Return (RealTrack)'),
    description:
      typeof raw.description === 'string' ? raw.description : undefined,
    marketplaceId,
    categoryTypes,
    returnsAccepted: true,
    returnPeriod: { value: days, unit: 'DAY' },
    returnShippingCostPayer: 'SELLER',
    refundMethod: raw.refundMethod ?? 'MONEY_BACK',
    returnMethod: raw.returnMethod ?? 'MERCHANT_RETURN',
  };
}

export function pickReturnPolicyIdForListing(
  items: ReturnPolicyPickCandidate[],
  marketplaceId: string,
  categoryId?: string | null,
  condition?: string | null,
): string | null {
  const valid = items.filter(
    (x) =>
      isLikelyEbayRestPolicyId(x.ebayPolicyId) &&
      policyMatchesMarketplaceGeo(x.geoSite, marketplaceId),
  );
  if (!valid.length) return null;

  const requiresPa = listingRequiresPartsAccessoriesReturnPolicy(
    marketplaceId,
    categoryId,
    condition,
  );
  if (requiresPa) {
    const compliant = valid.filter((x) =>
      isPartsAccessoriesCompliantReturnPolicy(x.rawPayload ?? {}),
    );
    if (compliant.length) {
      const prefs = geoSitePreferenceForMarketplace(marketplaceId);
      for (const geo of prefs) {
        const match =
          compliant.find((x) => x.geoSite === geo && x.isDefault) ??
          compliant.find((x) => x.geoSite === geo);
        if (match) return match.ebayPolicyId;
      }
      const anyDefault = compliant.find((x) => x.isDefault);
      return anyDefault?.ebayPolicyId ?? compliant[0]?.ebayPolicyId ?? null;
    }
    // Do not fall back to a non-compliant return policy for P&A listings.
    return null;
  }

  return pickPolicyIdForMarketplace(valid, marketplaceId);
}

export function pickPolicyIdForMarketplace(
  items: PolicyPickCandidate[],
  marketplaceId: string,
): string | null {
  const valid = items.filter(
    (x) =>
      isLikelyEbayRestPolicyId(x.ebayPolicyId) &&
      policyMatchesMarketplaceGeo(x.geoSite, marketplaceId),
  );
  if (!valid.length) return null;

  const prefs = geoSitePreferenceForMarketplace(marketplaceId);
  for (const geo of prefs) {
    const match =
      valid.find((x) => x.geoSite === geo && x.isDefault) ??
      valid.find((x) => x.geoSite === geo);
    if (match) return match.ebayPolicyId;
  }

  const anyDefault = valid.find((x) => x.isDefault);
  return anyDefault?.ebayPolicyId ?? valid[0]?.ebayPolicyId ?? null;
}

/** Prefer the first candidate that looks like a valid eBay REST policy id. */
export function coalesceValidPolicyId(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const c of candidates) {
    if (c?.trim() && isLikelyEbayRestPolicyId(c)) {
      return c.trim();
    }
  }
  return undefined;
}

export function hasValidDefaultPolicyIds(row: {
  defaultFulfillmentPolicyId?: string | null;
  defaultPaymentPolicyId?: string | null;
  defaultReturnPolicyId?: string | null;
} | null | undefined): boolean {
  if (!row) return false;
  return (
    isLikelyEbayRestPolicyId(row.defaultFulfillmentPolicyId) &&
    isLikelyEbayRestPolicyId(row.defaultPaymentPolicyId) &&
    isLikelyEbayRestPolicyId(row.defaultReturnPolicyId)
  );
}
