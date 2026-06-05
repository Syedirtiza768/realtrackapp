import {
  buildPaCompliantReturnPolicyRequest,
  coalesceValidPolicyId,
  extractEbayRestPolicyId,
  hasValidDefaultPolicyIds,
  isLikelyEbayRestPolicyId,
  isPartsAccessoriesCompliantReturnPolicy,
  conditionRequiresMandatoryPaFreeReturn,
  listingRequiresPartsAccessoriesReturnPolicy,
  marketplaceRequiresPartsAccessoriesReturnPolicy,
  pickPolicyIdForMarketplace,
  pickReturnPolicyIdForListing,
  paReturnPolicyBlockedMessage,
  pickReturnPolicyUpgradeCandidate,
  readPolicyGeoSite,
  summarizeReturnPolicyState,
} from './ebay-business-policy.util.js';

describe('ebay-business-policy.util', () => {
  it('detects eBay REST policy ids vs SellerPundit internal ids', () => {
    expect(isLikelyEbayRestPolicyId('410665908022')).toBe(true);
    expect(isLikelyEbayRestPolicyId('2770043')).toBe(false);
    expect(isLikelyEbayRestPolicyId('3059181')).toBe(false);
  });

  it('extracts REST id from SellerPundit policy_details', () => {
    const raw = {
      id: 3059181,
      geoSite: 'EBAY_US',
      policy_details: {
        fulfillmentPolicyId: '410665908022',
      },
    };
    expect(extractEbayRestPolicyId(raw, 'fulfillment')).toBe('410665908022');
    expect(readPolicyGeoSite(raw)).toBe('EBAY_US');
  });

  it('prefers marketplace geoSite when picking defaults', () => {
    const items = [
      {
        ebayPolicyId: '410665908022',
        isDefault: true,
        geoSite: 'EBAY_US',
      },
      {
        ebayPolicyId: '510665908022',
        isDefault: false,
        geoSite: 'EBAY_MOTORS_US',
      },
    ];
    expect(pickPolicyIdForMarketplace(items, 'EBAY_MOTORS_US')).toBe(
      '510665908022',
    );
    expect(pickPolicyIdForMarketplace(items, 'EBAY_US')).toBe('410665908022');
  });

  it('coalesceValidPolicyId skips stale short ids', () => {
    expect(
      coalesceValidPolicyId('2770043', '410665908022', undefined),
    ).toBe('410665908022');
  });

  it('detects P&A compliant return policies', () => {
    expect(
      isPartsAccessoriesCompliantReturnPolicy({
        returnsAccepted: true,
        returnPeriod: { value: 30, unit: 'DAY' },
        returnShippingCostPayer: 'SELLER',
      }),
    ).toBe(true);
    expect(
      isPartsAccessoriesCompliantReturnPolicy({
        returnsAccepted: true,
        returnPeriod: { value: 14, unit: 'DAY' },
        returnShippingCostPayer: 'SELLER',
      }),
    ).toBe(false);
    expect(
      isPartsAccessoriesCompliantReturnPolicy({
        policy_details: {
          ReturnsAcceptedOption: 'ReturnsAccepted',
          ReturnsWithinOption: 'Days_30',
          ShippingCostPaidByOption: 'Seller',
        },
      }),
    ).toBe(true);
  });

  it('does not fall back to non-compliant return policy for P&A listings', () => {
    const items = [
      {
        ebayPolicyId: '410665876022',
        isDefault: true,
        geoSite: 'EBAY_MOTORS_US',
        rawPayload: {
          returnsAccepted: true,
          returnPeriod: { value: 14, unit: 'DAY' },
          returnShippingCostPayer: 'BUYER',
        },
      },
    ];
    expect(
      pickReturnPolicyIdForListing(items, 'EBAY_MOTORS_US', '33684', 'NEW'),
    ).toBeNull();
  });

  it('allows buyer-paid 30-day return policy for used Motors listings', () => {
    const items = [
      {
        ebayPolicyId: '410665876022',
        isDefault: true,
        geoSite: 'EBAY_MOTORS_US',
        rawPayload: {
          returnsAccepted: true,
          returnPeriod: { value: 30, unit: 'DAY' },
          returnShippingCostPayer: 'BUYER',
        },
      },
    ];
    expect(
      pickReturnPolicyIdForListing(
        items,
        'EBAY_MOTORS_US',
        '33684',
        'USED_EXCELLENT',
      ),
    ).toBe('410665876022');
    expect(
      listingRequiresPartsAccessoriesReturnPolicy(
        'EBAY_MOTORS_US',
        '33684',
        'USED_EXCELLENT',
      ),
    ).toBe(false);
    expect(conditionRequiresMandatoryPaFreeReturn('NEW')).toBe(true);
    expect(conditionRequiresMandatoryPaFreeReturn('3000-Used')).toBe(false);
  });

  it('prefers P&A-compliant return policy on Motors marketplaces', () => {
    const items = [
      {
        ebayPolicyId: '410665876022',
        isDefault: true,
        geoSite: 'EBAY_MOTORS_US',
        rawPayload: {
          returnsAccepted: true,
          returnPeriod: { value: 14, unit: 'DAY' },
          returnShippingCostPayer: 'BUYER',
        },
      },
      {
        ebayPolicyId: '510665876022',
        isDefault: false,
        geoSite: 'EBAY_MOTORS_US',
        rawPayload: {
          returnsAccepted: true,
          returnPeriod: { value: 30, unit: 'DAY' },
          returnShippingCostPayer: 'SELLER',
        },
      },
    ];
    expect(
      pickReturnPolicyIdForListing(items, 'EBAY_MOTORS_US', '33684', 'NEW'),
    ).toBe('510665876022');
    expect(marketplaceRequiresPartsAccessoriesReturnPolicy('EBAY_MOTORS_US')).toBe(
      true,
    );
  });

  it('picks return policy upgrade candidate (30+ days, buyer-paid)', () => {
    const items = [
      {
        ebayPolicyId: '410665876022',
        isDefault: true,
        geoSite: 'EBAY_MOTORS_US',
        rawPayload: {
          returnsAccepted: true,
          returnPeriod: { value: 30, unit: 'DAY' },
          returnShippingCostPayer: 'BUYER',
        },
      },
      {
        ebayPolicyId: '410665876099',
        isDefault: false,
        geoSite: 'EBAY_MOTORS_US',
        rawPayload: {
          returnsAccepted: false,
          returnPeriod: { value: 30, unit: 'DAY' },
          returnShippingCostPayer: 'BUYER',
        },
      },
    ];
    expect(
      pickReturnPolicyUpgradeCandidate(items, 'EBAY_MOTORS_US', '410665876022')
        ?.ebayPolicyId,
    ).toBe('410665876022');
    expect(
      buildPaCompliantReturnPolicyRequest('EBAY_MOTORS_US', items[0].rawPayload),
    ).toMatchObject({
      returnsAccepted: true,
      returnPeriod: { value: 30, unit: 'DAY' },
      returnShippingCostPayer: 'SELLER',
    });
  });

  it('summarizeReturnPolicyState and blocked message for non-compliant policy', () => {
    const raw = {
      returnsAccepted: true,
      returnPeriod: { value: 30, unit: 'DAY' },
      returnShippingCostPayer: 'BUYER',
    };
    const state = summarizeReturnPolicyState(raw);
    expect(state.paCompliant).toBe(false);
    expect(state.days).toBe(30);
    expect(state.payer).toBe('BUYER');
    const msg = paReturnPolicyBlockedMessage({
      returnPolicyId: '410665876022',
      raw,
      storeName: 'All About Mercedes',
      accountApiUnavailable: true,
    });
    expect(msg).toContain('410665876022');
    expect(msg).toContain('seller-paid');
    expect(msg).toContain('sell.account');
  });

  it('hasValidDefaultPolicyIds requires all three REST ids', () => {
    expect(
      hasValidDefaultPolicyIds({
        defaultFulfillmentPolicyId: '410665908022',
        defaultPaymentPolicyId: '410665874022',
        defaultReturnPolicyId: '410665876022',
      }),
    ).toBe(true);
    expect(
      hasValidDefaultPolicyIds({
        defaultFulfillmentPolicyId: '2770043',
        defaultPaymentPolicyId: '410665874022',
        defaultReturnPolicyId: '410665876022',
      }),
    ).toBe(false);
  });
});
