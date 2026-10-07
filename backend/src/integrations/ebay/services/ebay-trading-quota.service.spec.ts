import { ServiceUnavailableException } from '@nestjs/common';
import { EbayTradingQuotaService } from './ebay-trading-quota.service.js';

describe('EbayTradingQuotaService', () => {
  const originalFetch = global.fetch;
  const auth = {
    getApplicationToken: jest.fn().mockResolvedValue('app-token'),
    getApiConfig: jest
      .fn()
      .mockReturnValue({ baseUrl: 'https://api.ebay.com' }),
  };
  const service = new EbayTradingQuotaService(auth as never);

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads the shared AddFixedPriceItem allowance and reset time', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        rateLimits: [
          {
            resources: [
              {
                name: 'AddFixedPriceItem',
                rates: [
                  {
                    limit: 5_000,
                    remaining: 56,
                    reset: '2026-10-08T07:00:00.000Z',
                  },
                ],
              },
            ],
          },
        ],
      }),
    }) as never;

    await expect(service.getPublishCapacity()).resolves.toEqual({
      limit: 5_000,
      remaining: 56,
      reset: new Date('2026-10-08T07:00:00.000Z'),
    });
  });

  it('pauses bulk publishing if eBay does not report a usable allowance', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ rateLimits: [] }),
    }) as never;

    await expect(service.getPublishCapacity()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
