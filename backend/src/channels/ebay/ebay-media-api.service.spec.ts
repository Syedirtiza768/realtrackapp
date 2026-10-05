import axios from 'axios';
import { EbayMediaApiService } from './ebay-media-api.service.js';

describe('EbayMediaApiService', () => {
  const auth = {
    getAccessToken: jest.fn().mockResolvedValue('token'),
    getApiBaseUrlForStore: jest.fn().mockResolvedValue('https://api.ebay.com'),
  };
  const repo = {
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  let service: EbayMediaApiService;

  beforeEach(() => {
    jest.restoreAllMocks();
    auth.getAccessToken.mockClear();
    auth.getApiBaseUrlForStore.mockClear();
    repo.findOne.mockReset().mockResolvedValue(null);
    repo.upsert.mockReset().mockResolvedValue(undefined);
    service = new EbayMediaApiService(auth as any, repo as any);
  });

  it('uploads source URLs to the eBay Media API and uses the maximum-size URL', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        imageUrl: 'https://i.ebayimg.com/images/g/source/s-l800.jpg',
        maxDimensionImageUrl:
          'https://i.ebayimg.com/images/g/source/s-l1600.jpg',
        expirationDate: '2026-09-01T00:00:00.000Z',
      },
      headers: {
        location: 'https://apim.ebay.com/commerce/media/v1_beta/image/id-1',
      },
    } as any);

    const urls = await service.hostImages('store-1', [
      'https://bucket.example.com/a.jpg',
    ]);

    expect(urls).toEqual(['https://i.ebayimg.com/images/g/source/s-l1600.jpg']);
    const [, , requestConfig] = post.mock.calls[0] as unknown as [
      string,
      unknown,
      { headers?: Record<string, string> },
    ];
    expect(requestConfig.headers?.Authorization).toBe('Bearer token');
    expect(post).toHaveBeenCalledWith(
      'https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_url',
      { imageUrl: 'https://bucket.example.com/a.jpg' },
      expect.anything(),
    );
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        sourceUrl: 'https://bucket.example.com/a.jpg',
        hostedUrl: 'https://i.ebayimg.com/images/g/source/s-l1600.jpg',
        imageId: 'id-1',
      }),
      ['storeId', 'sourceUrl'],
    );
  });

  it('does not upload an already eBay-hosted URL', async () => {
    const post = jest.spyOn(axios, 'post');

    const urls = await service.hostImages('store-1', [
      'https://i.ebayimg.com/images/g/existing/s-l1600.jpg',
    ]);

    expect(urls).toEqual([
      'https://i.ebayimg.com/images/g/existing/s-l1600.jpg',
    ]);
    expect(post).not.toHaveBeenCalled();
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('reuses a non-expired store-scoped cache entry', async () => {
    repo.findOne.mockResolvedValue({
      hostedUrl: 'https://i.ebayimg.com/images/g/cached/s-l1600.jpg',
      expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const post = jest.spyOn(axios, 'post');

    const urls = await service.hostImages('store-1', [
      'https://bucket.example.com/a.jpg?signature=secret',
    ]);

    expect(urls).toEqual(['https://i.ebayimg.com/images/g/cached/s-l1600.jpg']);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        storeId: 'store-1',
        sourceUrl: 'https://bucket.example.com/a.jpg',
      },
    });
    expect(post).not.toHaveBeenCalled();
  });
});
