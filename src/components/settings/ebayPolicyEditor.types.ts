export type PolicyRow = {
  id: string;
  marketplaceId: string;
  policyType: string;
  ebayPolicyId: string;
  name: string;
  isDefault: boolean;
};

export type MarketplacePolicyDefaults = {
  marketplaceId: string;
  defaultPaymentPolicyId: string | null;
  defaultReturnPolicyId: string | null;
  defaultFulfillmentPolicyId: string | null;
  defaultInventoryLocationKey: string | null;
};

export type AccountPolicyBundle = {
  id: string;
  accountDisplayName: string;
  marketplaces: MarketplacePolicyDefaults[];
};

export type PolicyDraft = {
  payment: string;
  ret: string;
  fulfillment: string;
  location: string;
};

export function draftFromMarketplace(m: MarketplacePolicyDefaults): PolicyDraft {
  return {
    payment: m.defaultPaymentPolicyId ?? '',
    ret: m.defaultReturnPolicyId ?? '',
    fulfillment: m.defaultFulfillmentPolicyId ?? '',
    location: m.defaultInventoryLocationKey ?? '',
  };
}

export function marketplacePoliciesComplete(m: MarketplacePolicyDefaults): boolean {
  return Boolean(
    m.defaultPaymentPolicyId &&
      m.defaultReturnPolicyId &&
      m.defaultFulfillmentPolicyId,
  );
}

export function accountPoliciesComplete(account: {
  marketplaces?: MarketplacePolicyDefaults[];
}): boolean {
  const mps = account.marketplaces ?? [];
  if (!mps.length) return false;
  return mps.every(marketplacePoliciesComplete);
}
