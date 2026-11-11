import axios from 'axios';
import {
  EbayTradingApiService,
  type TradingFixedPriceItemInput,
} from './ebay-trading-api.service.js';

jest.mock('axios');

describe('EbayTradingApiService', () => {
  it('rejects a missing primary category before making a Trading API request', async () => {
    const post = jest.fn();
    (axios.create as jest.Mock).mockReturnValue({ post });

    const auth = {
      getApiConfig: jest.fn().mockReturnValue({
        baseUrl: 'https://api.ebay.com',
      }),
      getAccessToken: jest.fn().mockResolvedValue('token'),
    };
    const service = new EbayTradingApiService(auth as any);
    const input: TradingFixedPriceItemInput = {
      title: 'Test part',
      description: 'Test description',
      categoryId: '',
      conditionId: 1000,
      quantity: 1,
      price: 20,
      currency: 'USD',
      sku: 'TEST-001',
      imageUrls: ['https://example.com/part.jpg'],
    };

    await expect(
      service.addFixedPriceItem('store-1', input, 'EBAY_MOTORS_US'),
    ).rejects.toThrow(/primary category ID is missing or invalid/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('includes eBay message details when a Trading API listing is rejected', async () => {
    const post = jest.fn().mockResolvedValue({
      data: `
        <AddFixedPriceItemResponse>
          <Ack>Failure</Ack>
          <Errors>
            <ErrorCode>240</ErrorCode>
            <ShortMessage>Item cannot be listed.</ShortMessage>
            <LongMessage>Input data for the listing is invalid.</LongMessage>
            <Message>This seller is not approved to list this item type.</Message>
          </Errors>
        </AddFixedPriceItemResponse>`,
    });
    (axios.create as jest.Mock).mockReturnValue({ post });

    const auth = {
      getApiConfig: jest.fn().mockReturnValue({
        baseUrl: 'https://api.ebay.com',
      }),
      getAccessToken: jest.fn().mockResolvedValue('token'),
    };
    const service = new EbayTradingApiService(auth as any);

    await expect(
      service.addFixedPriceItem(
        'store-1',
        {
          title: 'Test part',
          description: 'Test description',
          categoryId: '9886',
          conditionId: 3000,
          quantity: 1,
          price: 20,
          currency: 'USD',
          sku: 'TEST-240',
          imageUrls: ['https://example.com/part.jpg'],
        },
        'EBAY_MOTORS_US',
      ),
    ).rejects.toThrow(
      /AddFixedPriceItem failed \(240\).*This seller is not approved to list this item type/i,
    );
  });

  it('strips optional fitment fields and retries without compatibility when Trading rejects all rows', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        data: `
          <AddFixedPriceItemResponse>
            <Ack>Failure</Ack>
            <Errors>
              <ErrorCode>21917122</ErrorCode>
              <LongMessage>All compatibilities are invalid, Item not listed.</LongMessage>
            </Errors>
          </AddFixedPriceItemResponse>`,
      })
      .mockResolvedValueOnce({
        data: `
          <AddFixedPriceItemResponse>
            <Ack>Success</Ack>
            <ItemID>123456789012</ItemID>
          </AddFixedPriceItemResponse>`,
      });
    (axios.create as jest.Mock).mockReturnValue({ post });

    const auth = {
      getApiConfig: jest.fn().mockReturnValue({
        baseUrl: 'https://api.ebay.com',
      }),
      getAccessToken: jest.fn().mockResolvedValue('token'),
    };
    const service = new EbayTradingApiService(auth as any);
    const input: TradingFixedPriceItemInput = {
      title: 'FEBEST test part',
      description: 'Test description',
      categoryId: '9886',
      conditionId: 1000,
      quantity: 1,
      price: 20,
      currency: 'USD',
      sku: 'FEBEST-TEST',
      imageUrls: ['https://example.com/part.jpg'],
      itemSpecifics: { Brand: ['FEBEST'] },
      compatibility: {
        compatibleProducts: [
          {
            compatibilityProperties: [
              { name: 'Make', value: 'Hyundai' },
              { name: 'Model', value: 'Tucson' },
              { name: 'Year', value: '2018' },
              { name: 'Trim', value: '2.0' },
              { name: 'Engine', value: 'HYUNDAI G4GC' },
            ],
            notes: 'Official FEBEST application',
          },
        ],
      },
      location: 'Warehouse',
      country: 'US',
      paymentProfileId: 'payment-1',
      shippingProfileId: 'shipping-1',
      returnProfileId: 'return-1',
    };

    await expect(
      service.addFixedPriceItem('store-1', input, 'EBAY_MOTORS_US'),
    ).resolves.toEqual({ itemId: '123456789012' });

    expect(post).toHaveBeenCalledTimes(2);
    const firstBody = post.mock.calls[0][1] as string;
    const secondBody = post.mock.calls[1][1] as string;
    expect(firstBody).toContain('<ItemCompatibilityList>');
    expect(firstBody).toContain('<Name>Make</Name><Value>Hyundai</Value>');
    expect(firstBody).not.toContain('<Name>Trim</Name>');
    expect(firstBody).not.toContain('<Name>Engine</Name>');
    expect(firstBody).not.toContain('Official FEBEST application');
    expect(secondBody).not.toContain('<ItemCompatibilityList>');
  });

  it('re-lists an ended fixed-price item with the revised fields and returns the new ItemID', async () => {
    const post = jest.fn().mockResolvedValue({
      data: `
        <RelistFixedPriceItemResponse>
          <Ack>Success</Ack>
          <ItemID>987654321098</ItemID>
        </RelistFixedPriceItemResponse>`,
    });
    (axios.create as jest.Mock).mockReturnValue({ post });

    const auth = {
      getApiConfig: jest
        .fn()
        .mockReturnValue({ baseUrl: 'https://api.ebay.com' }),
      getAccessToken: jest.fn().mockResolvedValue('token'),
    };
    const service = new EbayTradingApiService(auth as any);

    await expect(
      service.relistFixedPriceItem(
        'store-1',
        '123456789012',
        {
          title: 'Updated part title',
          description: 'Updated description',
          categoryId: '9886',
          quantity: 4,
          price: 35.5,
          currency: 'USD',
          imageUrls: ['https://example.com/part.jpg'],
          itemSpecifics: { Brand: ['Mercedes-Benz'] },
        },
        'EBAY_MOTORS_US',
      ),
    ).resolves.toEqual({ itemId: '987654321098' });

    const call = post.mock.calls[0] as unknown as [
      string,
      string,
      { headers: Record<string, string> },
    ];
    const body = call[1];
    const config = call[2];
    expect(config.headers['X-EBAY-API-CALL-NAME']).toBe('RelistFixedPriceItem');
    expect(config.headers['X-EBAY-API-SITEID']).toBe('100');
    expect(body).toContain('<RelistFixedPriceItemRequest');
    expect(body).toContain('<ItemID>123456789012</ItemID>');
    expect(body).toContain('<Title>Updated part title</Title>');
    expect(body).toContain('<Quantity>4</Quantity>');
    expect(body).toContain('<StartPrice currencyID="USD">35.50</StartPrice>');
  });
});
