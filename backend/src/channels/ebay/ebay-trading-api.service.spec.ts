import { EbayTradingApiService } from './ebay-trading-api.service.js';
import type { TradingFixedPriceItemInput } from './ebay-trading-api.service.js';

describe('EbayTradingApiService batch listing operations', () => {
  const input = (sku: string): TradingFixedPriceItemInput => ({
    title: `Part ${sku}`,
    description: '<p>Used part</p>',
    categoryId: '6028',
    conditionId: 3000,
    quantity: 1,
    price: 49.99,
    currency: 'USD',
    sku,
    imageUrls: ['https://i.ebayimg.com/photo.jpg'],
    itemSpecifics: { Brand: ['Bosch'] },
    paymentProfileId: 'pay-1',
    shippingProfileId: 'ship-1',
    returnProfileId: 'return-1',
    immediatePayRequired: false,
    bestOfferEnabled: false,
  });

  function setup(response: string) {
    const service = new EbayTradingApiService({
      getApiConfig: jest
        .fn()
        .mockReturnValue({ baseUrl: 'https://api.ebay.com' }),
    } as never);
    const postTradingRequest = jest.fn().mockResolvedValue(response);
    (
      service as unknown as { postTradingRequest: typeof postTradingRequest }
    ).postTradingRequest = postTradingRequest;
    return { service, postTradingRequest };
  }

  it('adds up to five fixed-price listings and correlates returned item IDs', async () => {
    const { service, postTradingRequest } = setup(`<AddItemsResponse>
      <AddItemResponseContainer><CorrelationID>batch-1</CorrelationID><Ack>Success</Ack><ItemID>1001</ItemID></AddItemResponseContainer>
      <AddItemResponseContainer><CorrelationID>batch-2</CorrelationID><Ack>Warning</Ack><ItemID>1002</ItemID></AddItemResponseContainer>
    </AddItemsResponse>`);

    await expect(
      service.addFixedPriceItems(
        'store-1',
        [input('SKU-1'), input('SKU-2')],
        'EBAY_US',
      ),
    ).resolves.toEqual([
      { messageId: 'batch-1', success: true, itemId: '1001' },
      { messageId: 'batch-2', success: true, itemId: '1002' },
    ]);

    expect(postTradingRequest).toHaveBeenCalledWith(
      'store-1',
      'AddItems',
      expect.stringContaining('<AutoPay>false</AutoPay>'),
      'EBAY_US',
    );
    const requestBody = postTradingRequest.mock.calls[0][2] as string;
    expect(requestBody.match(/<AddItemRequestContainer>/g)).toHaveLength(2);
    // AddItems inherits AddItem's schema; ItemID tracking is the default, and
    // InventoryTrackingMethod is only accepted by AddFixedPriceItem.
    expect(requestBody).not.toContain('<InventoryTrackingMethod>');
    expect(requestBody).toContain('<PaymentProfileID>pay-1</PaymentProfileID>');
    expect(requestBody).toContain(
      '<BestOfferDetails><BestOfferEnabled>false</BestOfferEnabled></BestOfferDetails>',
    );
    expect(requestBody).toContain('<SKU>SKU-2</SKU>');
  });

  it('returns per-item failure codes without misassigning successful siblings', async () => {
    const { service } = setup(`<AddItemsResponse>
      <AddItemResponseContainer><CorrelationID>batch-1</CorrelationID><Ack>Failure</Ack><Errors><ErrorCode>21917122</ErrorCode><LongMessage>Invalid fitment</LongMessage></Errors></AddItemResponseContainer>
      <AddItemResponseContainer><CorrelationID>batch-2</CorrelationID><Ack>Success</Ack><ItemID>1002</ItemID></AddItemResponseContainer>
    </AddItemsResponse>`);

    await expect(
      service.addFixedPriceItems('store-1', [input('SKU-1'), input('SKU-2')]),
    ).resolves.toEqual([
      expect.objectContaining({
        messageId: 'batch-1',
        success: false,
        errorCode: '21917122',
      }),
      { messageId: 'batch-2', success: true, itemId: '1002' },
    ]);
  });

  it('rejects batches larger than the Trading API limit before making a request', async () => {
    const { service, postTradingRequest } = setup('<AddItemsResponse/>');
    await expect(
      service.addFixedPriceItems(
        'store-1',
        Array.from({ length: 6 }, (_value, index) => input(`SKU-${index}`)),
      ),
    ).rejects.toThrow('between one and five');
    expect(postTradingRequest).not.toHaveBeenCalled();
  });

  it('requires explicit business policy IDs instead of letting eBay create legacy policies', async () => {
    const { service, postTradingRequest } = setup('<AddItemsResponse/>');
    const withoutPolicy = {
      ...input('SKU-NO-POLICY'),
      paymentProfileId: null,
    };

    await expect(
      service.addFixedPriceItems('store-1', [withoutPolicy]),
    ).rejects.toThrow(
      'requires payment, shipping, and return business policy IDs',
    );
    expect(postTradingRequest).not.toHaveBeenCalled();
  });
});
