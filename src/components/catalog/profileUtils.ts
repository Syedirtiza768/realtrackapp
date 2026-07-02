import type { StoreProfiles } from '../../lib/multiStoreApi';
import type { Store } from '../../types/multiStore';

export interface ProfileSelection {
  shippingProfileName: string;
  returnProfileName: string;
  paymentProfileName: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
}

export const EMPTY_PROFILE_SELECTION: ProfileSelection = {
  shippingProfileName: '',
  returnProfileName: '',
  paymentProfileName: '',
};

export function resolveProfilePolicyIds(
  profiles: StoreProfiles | undefined,
  selection: Pick<ProfileSelection, 'shippingProfileName' | 'returnProfileName' | 'paymentProfileName'>,
): Pick<ProfileSelection, 'fulfillmentPolicyId' | 'paymentPolicyId' | 'returnPolicyId'> {
  if (!profiles) return {};

  const shipping = profiles.shippingProfiles.find((p) => p.name === selection.shippingProfileName);
  const returns = profiles.returnProfiles.find((p) => p.name === selection.returnProfileName);
  const payment = profiles.paymentProfiles.find((p) => p.name === selection.paymentProfileName);

  return {
    fulfillmentPolicyId: shipping?.ebayPolicyId,
    paymentPolicyId: payment?.ebayPolicyId,
    returnPolicyId: returns?.ebayPolicyId,
  };
}

export function defaultProfileSelection(
  profiles: StoreProfiles | undefined,
  store?: Store | null,
  listing?: {
    shippingProfileName?: string | null;
    returnProfileName?: string | null;
    paymentProfileName?: string | null;
  } | null,
): ProfileSelection {
  const pickName = (
    listingName: string | null | undefined,
    storeName: string | null | undefined,
    options: Array<{ name: string }>,
  ): string => {
    if (listingName && options.some((o) => o.name === listingName)) return listingName;
    if (storeName && options.some((o) => o.name === storeName)) return storeName;
    return options[0]?.name ?? '';
  };

  const shippingProfileName = pickName(
    listing?.shippingProfileName,
    store?.fulfillmentPolicyName,
    profiles?.shippingProfiles ?? [],
  );
  const returnProfileName = pickName(
    listing?.returnProfileName,
    store?.returnPolicyName,
    profiles?.returnProfiles ?? [],
  );
  const paymentProfileName = pickName(
    listing?.paymentProfileName,
    store?.paymentPolicyName,
    profiles?.paymentProfiles ?? [],
  );

  return {
    shippingProfileName,
    returnProfileName,
    paymentProfileName,
    ...resolveProfilePolicyIds(profiles, {
      shippingProfileName,
      returnProfileName,
      paymentProfileName,
    }),
  };
}
