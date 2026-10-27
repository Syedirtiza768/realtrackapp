import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { PartsSearchImagesService, isPrivateAddress, upgradeEbayUrl } from './parts-search-images.service.js';

function makeService(options: { imageUrls?: string[]; objects?: Record<string, { body: string; type: string }> } = {}) {
  const partsSearch = {
    part: jest.fn().mockResolvedValue({ imageUrls: options.imageUrls ?? [], brand: 'Toyota', manufacturerPartNumber: '86401-12020', title: 'Camera' }),
  };
  const storage = {
    getObjectStream: jest.fn(async (key: string) => {
      const object = options.objects?.[key];
      if (!object) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
      return { stream: Readable.from([Buffer.from(object.body)]), contentType: object.type, contentLength: object.body.length, etag: 'x' };
    }),
  };
  const config = { get: jest.fn((key: string) => (key === 'AWS_S3_BUCKET' ? 'solarrisebackupbucket-530142863136' : undefined)) };
  const service = new PartsSearchImagesService(partsSearch as any, storage as any, config as any, { query: jest.fn() } as any, { listForUser: jest.fn() } as any);
  return { service, storage };
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  let body: Buffer | null = null;
  return {
    headers,
    get body() {
      return body;
    },
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    },
    end: (value: Buffer) => {
      body = value;
    },
  };
}

describe('image source resolution', () => {
  const { service } = makeService();

  it('reads our private bucket through storage, virtual-host and path style', () => {
    expect(service.resolve('https://solarrisebackupbucket-530142863136.s3.amazonaws.com/mhn/catalog-images/x/000.jpg')).toEqual({
      kind: 'bucket',
      key: 'mhn/catalog-images/x/000.jpg',
      candidates: ['mhn/catalog-images/x/000.jpg'],
    });
    expect(service.resolve('https://s3.us-east-1.amazonaws.com/solarrisebackupbucket-530142863136/mhn/a.png')).toMatchObject({ kind: 'bucket', key: 'mhn/a.png' });
    expect(service.resolve('/api/storage/serve/mhn/a/000.jpg')).toMatchObject({ kind: 'bucket', key: 'mhn/a/000.jpg' });
  });

  it('downloads the original instead of a responsive variant', () => {
    const source = service.resolve('/api/storage/serve/mhn/a/000_medium.webp');
    expect(source).toMatchObject({ kind: 'bucket' });
    expect((source as any).candidates.slice(0, 2)).toEqual(['mhn/a/000.jpg', 'mhn/a/000.jpeg']);
  });

  it('upgrades eBay images to the 1600 px rendition', () => {
    expect(upgradeEbayUrl('https://i.ebayimg.com/images/g/abc/s-l500.jpg')).toBe('https://i.ebayimg.com/images/g/abc/s-l1600.jpg');
    expect(upgradeEbayUrl('https://i.ebayimg.com/00/s/MTYw/z/7Uo/$_1.JPG?set_id=8800005007')).toBe('https://i.ebayimg.com/00/s/MTYw/z/7Uo/$_57.JPG?set_id=8800005007');
    expect(upgradeEbayUrl('https://i.ebayimg.com/thumbs/images/g/abc/s-l225.jpg')).toBe('https://i.ebayimg.com/images/g/abc/s-l1600.jpg');
    expect(service.resolve('https://i.ebayimg.com/images/g/abc/s-l300.jpg')).toEqual({
      kind: 'remote',
      url: 'https://i.ebayimg.com/images/g/abc/s-l1600.jpg',
      fallbackUrl: 'https://i.ebayimg.com/images/g/abc/s-l300.jpg',
    });
  });

  it('makes PartsBazar360 relative paths absolute and refuses non-http schemes', () => {
    expect(service.resolve('/uploads/a.jpg')).toEqual({ kind: 'remote', url: 'https://partsbazar360.com/uploads/a.jpg' });
    expect(service.resolve('file:///etc/passwd')).toBeNull();
    expect(service.resolve('javascript:alert(1)')).toBeNull();
    expect(service.resolve('/api/storage/serve/../../secret')).toBeNull();
  });
});

describe('remote fetch safety', () => {
  it('classifies private and loopback addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.3.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1', '0.0.0.0']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['151.101.1.1', '34.196.184.100', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });

  it('never fetches an image from a private address (cloud metadata, localhost)', async () => {
    const { service } = makeService();
    await expect(service.fetchBest({ kind: 'remote', url: 'http://169.254.169.254/latest/meta-data/' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.fetchBest({ kind: 'remote', url: 'http://127.0.0.1:4191/api/health' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.fetchBest({ kind: 'remote', url: 'http://localhost/x.jpg' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('downloads', () => {
  it('sends the original from our bucket as an attachment named after the part', async () => {
    const { service } = makeService({
      imageUrls: ['https://solarrisebackupbucket-530142863136.s3.amazonaws.com/mhn/a/000.jpg'],
      objects: { 'mhn/a/000.jpg': { body: 'JPEGDATA', type: 'image/jpeg' } },
    });
    const res = fakeResponse();
    await service.downloadPartImage('p1', 0, res as any);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['content-disposition']).toBe('attachment; filename="Toyota-86401-12020-1.jpg"');
    expect(res.body?.toString()).toBe('JPEGDATA');
  });

  it('falls back from a missing original extension to the next candidate', async () => {
    const { service, storage } = makeService({
      imageUrls: ['/api/storage/serve/mhn/a/000_lg.webp'],
      objects: { 'mhn/a/000.png': { body: 'PNG', type: 'image/png' } },
    });
    const res = fakeResponse();
    await service.downloadPartImage('p1', 0, res as any);
    expect(storage.getObjectStream).toHaveBeenCalledWith('mhn/a/000.jpg');
    expect(res.headers['content-disposition']).toMatch(/-1\.png"$/);
  });

  it('falls back to the stored eBay size when the 1600 px rendition is missing', async () => {
    const { service } = makeService();
    const fetchRemote = jest
      .fn()
      .mockRejectedValueOnce(new NotFoundException('Image host returned HTTP 404'))
      .mockResolvedValueOnce({ body: Buffer.from('JPG'), contentType: 'image/jpeg', ext: 'jpg' });
    (service as any).fetchRemote = fetchRemote;
    const file = await service.fetchBest(service.resolve('https://i.ebayimg.com/images/g/abc/s-l500.jpg')!);
    expect(fetchRemote.mock.calls.map((c) => c[0])).toEqual([
      'https://i.ebayimg.com/images/g/abc/s-l1600.jpg',
      'https://i.ebayimg.com/images/g/abc/s-l500.jpg',
    ]);
    expect(file.ext).toBe('jpg');
  });

  it('404s for an index the part does not have', async () => {
    const { service } = makeService({ imageUrls: ['/api/storage/serve/mhn/a/000.jpg'] });
    await expect(service.downloadPartImage('p1', 3, fakeResponse() as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists previews in high quality without exposing the private bucket URL', async () => {
    const { service } = makeService({
      imageUrls: [
        'https://solarrisebackupbucket-530142863136.s3.amazonaws.com/mhn/a/000.jpg',
        'https://i.ebayimg.com/images/g/abc/s-l500.jpg',
        'https://img.example/logo.svg',
      ],
    });
    const list = await service.listPartImages('p1');
    expect(list.images.map((i) => [i.previewUrl, i.origin])).toEqual([
      ['/api/storage/serve/mhn/a/000.jpg', 'omni-core-storage'],
      ['https://i.ebayimg.com/images/g/abc/s-l1600.jpg', 'ebay'],
    ]);
  });
});
