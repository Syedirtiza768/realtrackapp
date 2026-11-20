"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLikelyEbayRestPolicyId = isLikelyEbayRestPolicyId;
exports.extractEbayRestPolicyId = extractEbayRestPolicyId;
exports.readPolicyGeoSite = readPolicyGeoSite;
exports.geoSitePreferenceForMarketplace = geoSitePreferenceForMarketplace;
exports.policyMatchesMarketplaceGeo = policyMatchesMarketplaceGeo;
exports.partsAccessoriesReturnPolicyGuidance = partsAccessoriesReturnPolicyGuidance;
exports.summarizeReturnPolicyState = summarizeReturnPolicyState;
exports.paReturnPolicyBlockedMessage = paReturnPolicyBlockedMessage;
exports.marketplaceRequiresPartsAccessoriesReturnPolicy = marketplaceRequiresPartsAccessoriesReturnPolicy;
exports.conditionRequiresMandatoryPaFreeReturn = conditionRequiresMandatoryPaFreeReturn;
exports.listingRequiresPartsAccessoriesReturnPolicy = listingRequiresPartsAccessoriesReturnPolicy;
exports.canEvaluateReturnPolicyCompliance = canEvaluateReturnPolicyCompliance;
exports.isPartsAccessoriesCompliantReturnPolicy = isPartsAccessoriesCompliantReturnPolicy;
exports.pickReturnPolicyUpgradeCandidate = pickReturnPolicyUpgradeCandidate;
exports.buildPaCompliantReturnPolicyRequest = buildPaCompliantReturnPolicyRequest;
exports.pickReturnPolicyIdForListing = pickReturnPolicyIdForListing;
exports.pickPolicyIdForMarketplace = pickPolicyIdForMarketplace;
exports.coalesceValidPolicyId = coalesceValidPolicyId;
exports.hasValidDefaultPolicyIds = hasValidDefaultPolicyIds;
const ebay_listing_condition_util_js_1 = require("../../../channels/ebay/ebay-listing-condition.util.js");
const REST_ID_KEYS = {
    fulfillment: ['fulfillmentPolicyId', 'fulfillment_policy_id'],
    payment: ['paymentPolicyId', 'payment_policy_id'],
    return: ['returnPolicyId', 'return_policy_id'],
};
function isLikelyEbayRestPolicyId(id) {
    if (!id?.trim())
        return false;
    return /^\d{10,}$/.test(id.trim());
}
function extractEbayRestPolicyId(raw, kind) {
    const details = raw.policy_details ??
        raw.policyDetails;
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
function readPolicyGeoSite(raw) {
    const details = raw.policy_details ??
        raw.policyDetails;
    const geo = raw.geoSite ??
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
function geoSitePreferenceForMarketplace(marketplaceId) {
    const mp = marketplaceId.trim().toUpperCase();
    if (mp === 'EBAY_MOTORS_US' || mp === 'EBAY_MOTORS') {
        return ['EBAY_MOTORS_US', 'EBAY_MOTORS', 'EBAY_US'];
    }
    if (mp === 'EBAY_US')
        return ['EBAY_US'];
    if (mp === 'EBAY_DE')
        return ['EBAY_DE'];
    if (mp === 'EBAY_GB')
        return ['EBAY_GB'];
    if (mp === 'EBAY_AU')
        return ['EBAY_AU'];
    return [mp, 'EBAY_US'];
}
function policyMatchesMarketplaceGeo(policyGeoSite, marketplaceId) {
    if (!policyGeoSite?.trim())
        return true;
    const prefs = geoSitePreferenceForMarketplace(marketplaceId);
    return prefs.includes(policyGeoSite.trim().toUpperCase());
}
const PA_RETURN_GUIDANCE = 'New and New Other Parts & Accessories listings require a return policy with at least 30 days and seller-paid return shipping (eBay June 2025 P&A rule). Used and other conditions may keep buyer-paid return shipping when 30+ days and returns are accepted. Update a return business policy in eBay Seller Hub if needed, re-sync policies in Settings → eBay Integrations, then publish again.';
const MANDATORY_PA_FREE_RETURN_CONDITIONS = new Set([
    'NEW',
    'NEW_OTHER',
]);
function partsAccessoriesReturnPolicyGuidance() {
    return PA_RETURN_GUIDANCE;
}
function summarizeReturnPolicyState(raw) {
    const evaluable = canEvaluateReturnPolicyCompliance(raw);
    return {
        days: evaluable ? readReturnPeriodDays(raw ?? {}) : null,
        payer: evaluable ? readReturnShippingCostPayer(raw ?? {}) : null,
        returnsAccepted: raw ? readReturnsAccepted(raw) : true,
        paCompliant: isPartsAccessoriesCompliantReturnPolicy(raw),
        evaluable,
    };
}
function paReturnPolicyBlockedMessage(params) {
    const state = summarizeReturnPolicyState(params.raw);
    const store = params.storeName ? `"${params.storeName}"` : 'this store';
    const policyGeo = readPolicyGeoSite(params.raw ?? {});
    const parts = [
        `Return policy ${params.returnPolicyId} for ${store} is not P&A-compliant`,
    ];
    if (state.evaluable) {
        parts.push(`(returns: ${state.returnsAccepted ? 'yes' : 'no'}, window: ${state.days ?? '?'} days, return shipping: ${state.payer ?? 'unknown'})`);
    }
    if (params.condition?.trim()) {
        parts.push(`Listing condition: ${params.condition.trim()}.`);
    }
    if (params.marketplaceId &&
        policyGeo &&
        !policyMatchesMarketplaceGeo(policyGeo, params.marketplaceId)) {
        parts.push(`This policy is for ${policyGeo} but you are publishing to ${params.marketplaceId} — create or sync ${params.marketplaceId} return policies in Seller Hub, enable that marketplace on the store, or publish to ${policyGeo} instead.`);
    }
    if (params.condition?.trim()) {
        const mapped = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(params.condition);
        if (!conditionRequiresMandatoryPaFreeReturn(mapped)) {
            parts.push(`This block applies because the listing is being published as "${mapped}" (seller-paid returns are only required for New / New Other). If this is used inventory, set Condition ID to 3000 (Used) on the catalog/listing and publish again.`);
        }
    }
    parts.push('eBay US requires returns accepted, 30+ days, and seller-paid return shipping for New and New Other Parts & Accessories listings. Used salvage parts may keep buyer-paid return shipping when the catalog Condition ID is 3000 (Used) or similar.');
    if (params.accountApiUnavailable) {
        parts.push('Automatic policy upgrade via eBay Account API is unavailable for this SellerPundit-linked store (token lacks sell.account access).');
    }
    parts.push('In eBay Seller Hub, edit the return business policy (or create a new one), then re-sync policies in Settings → eBay Integrations and publish again.');
    return parts.join(' ');
}
function marketplaceRequiresPartsAccessoriesReturnPolicy(marketplaceId, categoryId) {
    const mp = marketplaceId.trim().toUpperCase();
    if (!US_PA_RETURN_MARKETPLACES.has(mp))
        return false;
    if (mp === 'EBAY_MOTORS_US' || mp === 'EBAY_MOTORS')
        return true;
    const cat = Number.parseInt(String(categoryId ?? '').trim(), 10);
    if (!Number.isFinite(cat) || cat <= 0)
        return false;
    return (cat >= 6000 && cat < 7000) || cat >= 33_000;
}
function conditionRequiresMandatoryPaFreeReturn(condition) {
    if (!condition?.trim())
        return false;
    const mapped = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(condition);
    return MANDATORY_PA_FREE_RETURN_CONDITIONS.has(mapped);
}
function listingRequiresPartsAccessoriesReturnPolicy(marketplaceId, categoryId, condition) {
    return (marketplaceRequiresPartsAccessoriesReturnPolicy(marketplaceId, categoryId) && conditionRequiresMandatoryPaFreeReturn(condition));
}
function policyDetails(raw) {
    const details = raw.policy_details ?? raw.policyDetails;
    return details != null &&
        typeof details === 'object' &&
        !Array.isArray(details)
        ? details
        : undefined;
}
function readReturnPeriodDays(raw) {
    const period = raw.returnPeriod ??
        raw.return_period ??
        policyDetails(raw)?.returnPeriod ??
        policyDetails(raw)?.return_period;
    if (period != null && typeof period === 'object' && !Array.isArray(period)) {
        const p = period;
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
        if (Number.isFinite(n) && n > 0)
            return n;
    }
    const details = policyDetails(raw);
    const within = details?.ReturnsWithinOption ??
        details?.returnsWithinOption ??
        raw.ReturnsWithinOption ??
        raw.returnsWithinOption;
    if (typeof within === 'string') {
        const match = within.match(/(\d+)/);
        if (match)
            return Number(match[1]);
    }
    if (typeof within === 'number' && within > 0)
        return within;
    return null;
}
function readReturnShippingCostPayer(raw) {
    const payer = raw.returnShippingCostPayer ??
        raw.return_shipping_cost_payer ??
        policyDetails(raw)?.returnShippingCostPayer ??
        policyDetails(raw)?.return_shipping_cost_payer ??
        policyDetails(raw)?.ShippingCostPaidByOption ??
        policyDetails(raw)?.shippingCostPaidByOption ??
        raw.ShippingCostPaidByOption ??
        raw.shippingCostPaidByOption;
    return payer != null ? String(payer).trim().toUpperCase() : null;
}
function readReturnsAccepted(raw) {
    const val = raw.returnsAccepted ??
        raw.returns_accepted ??
        policyDetails(raw)?.ReturnsAcceptedOption ??
        policyDetails(raw)?.returnsAcceptedOption;
    if (typeof val === 'boolean')
        return val;
    if (typeof val === 'string') {
        const s = val.trim().toUpperCase();
        if (s === 'FALSE' || s === 'RETURNSNOTACCEPTED' || s === 'NO_RETURNS') {
            return false;
        }
        return s === 'TRUE' || s.includes('ACCEPTED');
    }
    return true;
}
function canEvaluateReturnPolicyCompliance(raw) {
    if (!raw || typeof raw !== 'object')
        return false;
    return (readReturnPeriodDays(raw) != null &&
        readReturnShippingCostPayer(raw) != null);
}
function isPartsAccessoriesCompliantReturnPolicy(raw) {
    if (!raw || typeof raw !== 'object')
        return false;
    if (!canEvaluateReturnPolicyCompliance(raw))
        return false;
    if (!readReturnsAccepted(raw))
        return false;
    const days = readReturnPeriodDays(raw);
    if (days == null || days < 30)
        return false;
    const payer = readReturnShippingCostPayer(raw);
    if (!payer)
        return false;
    return payer === 'SELLER' || payer.includes('SELLER');
}
function pickReturnPolicyUpgradeCandidate(items, marketplaceId, preferredPolicyId) {
    const valid = items.filter((x) => isLikelyEbayRestPolicyId(x.ebayPolicyId) &&
        policyMatchesMarketplaceGeo(x.geoSite, marketplaceId));
    if (!valid.length)
        return null;
    const prefs = geoSitePreferenceForMarketplace(marketplaceId);
    const matchesGeo = (x) => policyMatchesMarketplaceGeo(x.geoSite, marketplaceId);
    const upgradeable = valid.filter((x) => {
        if (!matchesGeo(x))
            return false;
        const raw = x.rawPayload ?? {};
        if (!canEvaluateReturnPolicyCompliance(raw))
            return false;
        if (!readReturnsAccepted(raw))
            return false;
        const days = readReturnPeriodDays(raw);
        if (days == null || days < 30)
            return false;
        const payer = readReturnShippingCostPayer(raw);
        return payer != null && !payer.includes('SELLER');
    });
    if (!upgradeable.length)
        return null;
    if (preferredPolicyId) {
        const preferred = upgradeable.find((x) => x.ebayPolicyId === preferredPolicyId);
        if (preferred)
            return preferred;
    }
    for (const geo of prefs) {
        const match = upgradeable.find((x) => x.geoSite === geo && x.isDefault) ??
            upgradeable.find((x) => x.geoSite === geo);
        if (match)
            return match;
    }
    return upgradeable.find((x) => x.isDefault) ?? upgradeable[0] ?? null;
}
function buildPaCompliantReturnPolicyRequest(marketplaceId, template) {
    const raw = template ?? {};
    const categoryTypes = raw.categoryTypes ??
        policyDetails(raw)?.categoryTypes ?? [
        { name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true },
    ];
    const days = Math.max(30, readReturnPeriodDays(raw) ?? 30);
    return {
        name: String(raw.name ?? 'P&A Compliant Return (Omni Core)'),
        description: typeof raw.description === 'string' ? raw.description : undefined,
        marketplaceId,
        categoryTypes,
        returnsAccepted: true,
        returnPeriod: { value: days, unit: 'DAY' },
        returnShippingCostPayer: 'SELLER',
        refundMethod: raw.refundMethod ?? 'MONEY_BACK',
        returnMethod: raw.returnMethod ?? 'MERCHANT_RETURN',
    };
}
function pickReturnPolicyIdForListing(items, marketplaceId, categoryId, condition) {
    const valid = items.filter((x) => isLikelyEbayRestPolicyId(x.ebayPolicyId) &&
        policyMatchesMarketplaceGeo(x.geoSite, marketplaceId));
    if (!valid.length)
        return null;
    const requiresPa = listingRequiresPartsAccessoriesReturnPolicy(marketplaceId, categoryId, condition);
    if (requiresPa) {
        const compliant = valid.filter((x) => isPartsAccessoriesCompliantReturnPolicy(x.rawPayload ?? {}));
        if (compliant.length) {
            const prefs = geoSitePreferenceForMarketplace(marketplaceId);
            for (const geo of prefs) {
                const match = compliant.find((x) => x.geoSite === geo && x.isDefault) ??
                    compliant.find((x) => x.geoSite === geo);
                if (match)
                    return match.ebayPolicyId;
            }
            const anyDefault = compliant.find((x) => x.isDefault);
            return anyDefault?.ebayPolicyId ?? compliant[0]?.ebayPolicyId ?? null;
        }
        return null;
    }
    return pickPolicyIdForMarketplace(valid, marketplaceId);
}
function pickPolicyIdForMarketplace(items, marketplaceId) {
    const valid = items.filter((x) => isLikelyEbayRestPolicyId(x.ebayPolicyId) &&
        policyMatchesMarketplaceGeo(x.geoSite, marketplaceId));
    if (!valid.length)
        return null;
    const prefs = geoSitePreferenceForMarketplace(marketplaceId);
    for (const geo of prefs) {
        const match = valid.find((x) => x.geoSite === geo && x.isDefault) ??
            valid.find((x) => x.geoSite === geo);
        if (match)
            return match.ebayPolicyId;
    }
    const anyDefault = valid.find((x) => x.isDefault);
    return anyDefault?.ebayPolicyId ?? valid[0]?.ebayPolicyId ?? null;
}
function coalesceValidPolicyId(...candidates) {
    for (const c of candidates) {
        if (c?.trim() && isLikelyEbayRestPolicyId(c)) {
            return c.trim();
        }
    }
    return undefined;
}
function hasValidDefaultPolicyIds(row) {
    if (!row)
        return false;
    return (isLikelyEbayRestPolicyId(row.defaultFulfillmentPolicyId) &&
        isLikelyEbayRestPolicyId(row.defaultPaymentPolicyId) &&
        isLikelyEbayRestPolicyId(row.defaultReturnPolicyId));
}
//# sourceMappingURL=ebay-business-policy.util.js.map