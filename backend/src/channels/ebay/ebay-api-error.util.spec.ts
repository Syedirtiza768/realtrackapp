import {
  formatEbayApiError,
  formatEbayOverseasWarehouseBlockError,
  isEbayAvailabilityMissingTransientError,
  isEbayOverseasWarehouseBlockError,
  isEbayInvalidAccessTokenError,
  isEbayOfferUnavailableError,
  isEbayPartsAccessoriesReturnPolicyError,
  isEbayRecoverableBusinessPolicyError,
} from './ebay-api-error.util.js';

describe('formatEbayApiError', () => {
  it('extracts parameter details and drops generic wrapper', () => {
    const err = {
      response: {
        data: {
          message:
            'The request has errors. For help, see the documentation for this API.',
          errors: [
            {
              errorId: 25002,
              message: 'A user error has occurred.',
              parameters: [{ name: 'Brand', value: 'Brand is required.' }],
            },
          ],
        },
      },
    };
    const msg = formatEbayApiError(err, 'fallback');
    expect(msg).toContain('Brand is required.');
    expect(msg).not.toContain('documentation for this API');
  });

  it('detects P&A non-compliant return policy errors', () => {
    const err = {
      response: {
        data: {
          errors: [
            {
              message:
                'This P&A listing has a non-compliant domestic return policy. Please update the return window to 30-days (or more)',
            },
          ],
        },
      },
    };
    expect(isEbayPartsAccessoriesReturnPolicyError(err)).toBe(true);
    expect(isEbayRecoverableBusinessPolicyError(err)).toBe(true);
  });

  it('detects OAuth invalid access token errors', () => {
    const err = {
      response: {
        status: 401,
        data: {
          errors: [{ errorId: 1001, message: 'Invalid access token' }],
        },
      },
    };
    expect(isEbayInvalidAccessTokenError(err)).toBe(true);
  });

  it('detects transient availability propagation errors', () => {
    const err = {
      response: {
        data: {
          errors: [{ errorId: 25604, message: 'Availability not found' }],
        },
      },
    };
    expect(isEbayAvailabilityMissingTransientError(err)).toBe(true);
  });

  it('detects an eBay offer that no longer exists', () => {
    const err = {
      response: {
        data: {
          errors: [{ errorId: 25713, message: 'This Offer is not available.' }],
        },
      },
    };
    expect(isEbayOfferUnavailableError(err)).toBe(true);
  });

  it('detects the overseas warehouse block as a permanent policy error', () => {
    const err = {
      response: {
        data: {
          errors: [
            {
              errorId: 1276646,
              longMessage:
                'It appears you are listing a forward-deployed item in a country different from your registered address.',
            },
          ],
        },
      },
    };
    expect(isEbayOverseasWarehouseBlockError(err)).toBe(true);
    expect(
      formatEbayOverseasWarehouseBlockError(err, {
        storeName: 'Primemotive',
        merchantLocationKey: 'AE_Dubai',
      }),
    ).toContain('Overseas Warehouse Block Policy');
  });
});
