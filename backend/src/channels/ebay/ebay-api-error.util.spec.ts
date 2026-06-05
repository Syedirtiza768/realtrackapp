import {
  formatEbayApiError,
  isEbayInvalidAccessTokenError,
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
              parameters: [
                { name: 'Brand', value: 'Brand is required.' },
              ],
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
});
