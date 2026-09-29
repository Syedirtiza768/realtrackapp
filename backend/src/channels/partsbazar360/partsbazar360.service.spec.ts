import { BadRequestException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { UnrecoverableError } from 'bullmq';
import { PartsBazarApiError } from './partsbazar360.client.js';
import {
  PARTSBAZAR360_STATUS_JOB,
  PartsBazar360Service,
} from './partsbazar360.service.js';

const SELLER_STORE = 'pb-seller-store';

const baseListing = {
  id: 'listing-1',
  version: 4,
  title: 'BMW X5 Front Bumper Cover',
  customLabelSku: 'SKU-1',
  categoryName: null,
  startPrice: '149.99',
  startPriceNum: null,
  quantity: '2',
  quantityNum: null,
  itemPhotoUrl: 'https://i.ebayimg.com/images/g/abc/s-l1600.jpg',
  conditionId: '3000',
  conditionLabel: null,
  description: 'Genuine OEM bumper cover.',
  cBrand: 'BMW',
  cType: 'Bumper Cover',
  cManufacturerPartNumber: '51117292',
  cOeOemPartNumber: null,
  cMaterial: null,
  cPlacement: null,
  countryOfOrigin: null,
  manufacturerName: null,
  pUpc: null,
  status: 'published',
  ebayListingId: null,
};

const pbStore = {
  id: 'rt-store-1',
  connectionId: 'conn-1',
  channel: 'partsbazar360',
  externalStoreId: SELLER_STORE,
  storeName: 'PartsBazar360 – Blackline',
  isPrimary: true,
  status: 'active',
  config: { marketplaceId: 'EBAY_MOTORS_US', currency: 'USD' },
};

function remote(over: Record<string, unknown> = {}) {
  return {
    sourceListingId: 'listing-1',
    status: 'imported',
    outcome: 'imported',
    error: null,
    updatedAt: null,
    offer: { id: 'offer-9', status: 'ACTIVE', price: 200, currency: 'USD' },
    part: {
      id: 'part-9',
      slug: 'bmw-x5-bumper',
      url: 'https://partsbazar360.com/parts/bmw-x5-bumper',
    },
    ...over,
  };
}

function build(
  opts: {
    listing?: object | null;
    instance?: object | null;
    s3Keys?: string[];
    mirror?: boolean;
  } = {},
) {
  const listing =
    opts.listing === undefined ? { ...baseListing } : opts.listing;
  let instance: Record<string, unknown> | null =
    opts.instance === undefined
      ? null
      : (opts.instance as Record<string, unknown>);

  const instanceRepo = {
    findOne: jest.fn(() => Promise.resolve(instance)),
    findOneBy: jest.fn(() => Promise.resolve(instance)),
    find: jest.fn(() => Promise.resolve(instance ? [instance] : [])),
    create: jest.fn((data: Record<string, unknown>) => ({
      id: 'inst-1',
      ...data,
    })),
    save: jest.fn((data: Record<string, unknown>) => {
      instance = data;
      return Promise.resolve(data);
    }),
  };
  const storeRepo = {
    findOne: jest.fn(() => Promise.resolve(pbStore)),
    find: jest.fn(() => Promise.resolve([pbStore])),
    create: jest.fn((d: object) => ({ id: 'rt-store-new', ...d })),
    save: jest.fn((d: object) => Promise.resolve(d)),
  };
  const connectionRepo = {
    create: jest.fn((d: object) => ({ id: 'conn-new', ...d })),
    save: jest.fn((d: object) => Promise.resolve(d)),
  };
  const listingRepo = { findOneBy: jest.fn(() => Promise.resolve(listing)) };
  const catalogRepo = { findOne: jest.fn(() => Promise.resolve(null)) };
  const client = {
    isConfigured: jest.fn(() => true),
    baseUrl: 'https://pb.test/api',
    health: jest.fn(),
    push: jest.fn(),
    status: jest.fn(),
    end: jest.fn(),
  };
  const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
  const encryption = { encrypt: jest.fn((v: string) => `enc(${v.length})`) };
  const config = {
    get: (name: string) =>
      ({
        PARTSBAZAR360_CONFIRM_TRIES: '2',
        PARTSBAZAR360_CONFIRM_INTERVAL_MS: '0',
        FRONTEND_BASE_URL: 'https://rt.example.test/',
        PARTSBAZAR360_MIRROR_IMAGES: opts.mirror ? 'true' : 'false',
      })[name],
  };
  // First-party bucket = host containing "bucket"; objects that exist in "S3":
  const existingKeys = new Set<string>(opts.s3Keys ?? []);
  const storage = {
    keyFromUrl: (url: string) => {
      const u = new URL(url);
      return u.hostname.includes('bucket')
        ? u.pathname.replace(/^\//, '')
        : null;
    },
    isTempKey: (key: string) => key.startsWith('mhn/temp/'),
    objectExists: jest.fn((key: string) =>
      Promise.resolve(existingKeys.has(key)),
    ),
    mirroredObjectKey: (_ns: string, source: string, ext: string) =>
      `mhn/catalog-images/partsbazar360/${Buffer.from(source).toString('hex').slice(-16)}${ext}`,
    putObject: jest.fn((key: string) => {
      existingKeys.add(key);
      return Promise.resolve();
    }),
    getObjectBuffer: jest.fn(() => Promise.resolve(Buffer.alloc(0))),
  };

  const service = new PartsBazar360Service(
    client as never,
    config as never,
    encryption as never,
    storage as never,
    listingRepo as never,
    catalogRepo as never,
    connectionRepo as never,
    storeRepo as never,
    instanceRepo as never,
    queue as never,
  );
  return {
    service,
    client,
    queue,
    instanceRepo,
    storeRepo,
    connectionRepo,
    storage,
    current: () => instance as Record<string, any>,
  };
}

describe('PartsBazar360Service.publish', () => {
  it('pushes the mapped listing and marks the instance synced once imported', async () => {
    const t = build();
    t.client.push.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'queued' },
    ]);
    t.client.status.mockResolvedValue(remote());

    await t.service.publish('conn-1', 'listing-1');

    expect(t.client.push).toHaveBeenCalledWith(SELLER_STORE, [
      expect.objectContaining({
        sourceListingId: 'listing-1',
        listing: expect.objectContaining({
          price: '149.99',
          marketplaceId: 'EBAY_MOTORS_US',
        }),
      }),
    ]);
    expect(t.current()).toMatchObject({
      syncStatus: 'synced',
      externalId: 'offer-9',
      externalUrl: 'https://partsbazar360.com/parts/bmw-x5-bumper',
      lastError: null,
      lastPushedVersion: 4,
    });
    expect(t.queue.add).not.toHaveBeenCalled();
  });

  it('stays "publishing" and schedules a re-check when the import has not finished', async () => {
    const t = build();
    t.client.push.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'queued' },
    ]);
    t.client.status.mockResolvedValue(
      remote({ status: 'queued', offer: null, part: null }),
    );

    await t.service.publish('conn-1', 'listing-1');

    expect(t.current().syncStatus).toBe('publishing');
    expect(t.queue.add).toHaveBeenCalledWith(
      PARTSBAZAR360_STATUS_JOB,
      { instanceId: 'inst-1', attempt: 1 },
      expect.objectContaining({ delay: 30_000 }),
    );
  });

  it('turns a receiver-side decline into a readable error on the instance', async () => {
    const t = build();
    t.client.push.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'queued' },
    ]);
    t.client.status.mockResolvedValue(
      remote({
        status: 'rejected',
        outcome: 'skipped_non_english_title',
        offer: null,
        part: null,
      }),
    );

    await t.service.publish('conn-1', 'listing-1');

    expect(t.current()).toMatchObject({
      syncStatus: 'error',
      lastError:
        'PartsBazar360 declined the listing: the title is not in English',
    });
  });

  it('does not call the API for a listing it cannot publish, and does not retry', async () => {
    const t = build({ listing: { ...baseListing, startPrice: null } });

    await expect(
      t.service.publish('conn-1', 'listing-1'),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(t.client.push).not.toHaveBeenCalled();
    expect(t.current()).toMatchObject({
      syncStatus: 'error',
      lastError: expect.stringContaining('no price'),
    });
  });

  it('fails without retry when the receiver rejects the payload up front', async () => {
    const t = build();
    t.client.push.mockResolvedValue([
      {
        sourceListingId: 'listing-1',
        status: 'rejected',
        reason: 'currency must be USD',
      },
    ]);
    await expect(
      t.service.publish('conn-1', 'listing-1'),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(t.current().lastError).toBe('currency must be USD');
  });

  it('treats an auth failure as permanent but a 503 as retryable', async () => {
    const auth = build();
    auth.client.push.mockRejectedValue(
      new PartsBazarApiError('401', 401, false),
    );
    await expect(
      auth.service.publish('conn-1', 'listing-1'),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    const outage = build();
    const error = new PartsBazarApiError('503', 503, true);
    outage.client.push.mockRejectedValue(error);
    await expect(outage.service.publish('conn-1', 'listing-1')).rejects.toBe(
      error,
    );
    expect(outage.current().syncStatus).toBe('error');
  });

  it('raises NotFound for a missing listing', async () => {
    const t = build({ listing: null });
    await expect(t.service.publish('conn-1', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PartsBazar360Service photos', () => {
  const bucket = 'https://my-bucket.s3.amazonaws.com';
  it('publishes first-party photos through the public serve URL, using the .webp object S3 actually holds', async () => {
    const t = build({
      listing: {
        ...baseListing,
        itemPhotoUrl: `${bucket}/mhn/catalog-images/p/000.jpg|${bucket}/mhn/catalog-images/p/001.png|https://i.ebayimg.com/x/s-l1600.jpg`,
      },
      s3Keys: ['mhn/catalog-images/p/000.webp', 'mhn/catalog-images/p/001.png'],
    });
    t.client.push.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'queued' },
    ]);
    t.client.status.mockResolvedValue(remote());

    await t.service.publish('conn-1', 'listing-1');

    const sent = t.client.push.mock.calls[0][1][0].listing.imageUrls;
    expect(sent).toEqual([
      'https://rt.example.test/api/storage/serve/mhn/catalog-images/p/000.webp',
      'https://rt.example.test/api/storage/serve/mhn/catalog-images/p/001.png',
      'https://i.ebayimg.com/x/s-l1600.jpg',
    ]);
  });

  it('drops photos that no longer exist and purged temp uploads, keeping the rest in order', async () => {
    const t = build({
      listing: {
        ...baseListing,
        itemPhotoUrl: `${bucket}/mhn/temp/a.jpg|${bucket}/mhn/catalog-images/p/gone.jpg|${bucket}/mhn/catalog-images/p/ok.webp`,
      },
      s3Keys: ['mhn/catalog-images/p/ok.webp', 'mhn/temp/a.jpg'],
    });
    t.client.push.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'queued' },
    ]);
    t.client.status.mockResolvedValue(remote());
    await t.service.publish('conn-1', 'listing-1');
    expect(t.client.push.mock.calls[0][1][0].listing.imageUrls).toEqual([
      'https://rt.example.test/api/storage/serve/mhn/catalog-images/p/ok.webp',
    ]);
    // temp key exists in the fake bucket but is still skipped
    expect(t.storage.objectExists).not.toHaveBeenCalledWith('mhn/temp/a.jpg');
  });

  it('refuses, with a specific reason, when none of the stored photos exist', async () => {
    const t = build({
      listing: {
        ...baseListing,
        itemPhotoUrl: `${bucket}/mhn/temp/a.jpg|${bucket}/mhn/catalog-images/p/gone.jpg`,
      },
      s3Keys: [],
    });
    await expect(
      t.service.publish('conn-1', 'listing-1'),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(t.client.push).not.toHaveBeenCalled();
    expect(t.current()).toMatchObject({
      syncStatus: 'error',
      lastError: expect.stringContaining('photos could be fetched or found in storage'),
    });
  });
});

describe('PartsBazar360Service photo mirroring (WebP in S3)', () => {
  const png = (side: number) =>
    sharp({
      create: { width: side, height: side, channels: 3, background: '#c33' },
    })
      .png()
      .toBuffer();
  const okImage = async (side = 400) =>
    new Response(new Uint8Array(await png(side)), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  const KEY = 'mhn/catalog-images/partsbazar360/';
  const publishWith = async (
    photos: string[],
    instance?: object,
    s3Keys: string[] = [],
  ) => {
    const t = build({
      listing: { ...baseListing, itemPhotoUrl: photos.join('|') },
      instance,
      mirror: true,
      s3Keys,
    });
    t.client.push.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'queued' },
    ]);
    t.client.status.mockResolvedValue(remote());
    return t;
  };
  afterEach(() => jest.restoreAllMocks());

  it('downloads external photos, converts them to WebP, stores them in S3 and serves the S3 copy', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => okImage());
    const t = await publishWith(['https://i.ebayimg.com/x/s-l140.jpg']);
    await t.service.publish('conn-1', 'listing-1');

    // eBay thumbnail upgraded to the large size before download
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://i.ebayimg.com/x/s-l1600.jpg',
    );
    const [key, body, type] = t.storage.putObject.mock.calls[0] as [
      string,
      Buffer,
      string,
    ];
    expect(key.startsWith(KEY) && key.endsWith('.webp')).toBe(true);
    expect(type).toBe('image/webp');
    expect((await sharp(body).metadata()).format).toBe('webp');
    expect(t.client.push.mock.calls[0][1][0].listing.imageUrls).toEqual([
      `https://rt.example.test/api/storage/serve/${key}`,
    ]);
  });

  it('reads NAPA Canada photos from NAPA Online, whose CDN accepts server fetches', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => okImage());
    const t = await publishWith([
      'https://media.napacanada.com/is/image/GenuinePartsCompany/1/?format=webp',
    ]);
    await t.service.publish('conn-1', 'listing-1');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://media.napaonline.com/is/image/GenuinePartsCompany/1/?format=webp',
    );
  });

  it('reuses an already-mirrored object instead of downloading again', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const url = 'https://media.napaonline.com/is/image/GenuinePartsCompany/2/';
    const t = await publishWith([url]);
    const key = t.storage.mirroredObjectKey('partsbazar360', url, '.webp');
    t.storage.putObject(key); // pretend a previous run stored it
    await t.service.publish('conn-1', 'listing-1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(t.client.push.mock.calls[0][1][0].listing.imageUrls[0]).toContain(
      key,
    );
  });

  it('drops photos that cannot be fetched, are not images, or are tiny placeholders', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/blocked'))
        return Promise.resolve(new Response('no', { status: 403 }));
      if (url.includes('/html'))
        return Promise.resolve(
          new Response('<html/>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
        );
      if (url.includes('/tiny')) return okImage(20);
      return okImage(400);
    });
    const t = await publishWith([
      'https://cdn.example.test/blocked',
      'https://cdn.example.test/html',
      'https://cdn.example.test/tiny',
      'https://cdn.example.test/good',
    ]);
    await t.service.publish('conn-1', 'listing-1');
    expect(t.client.push.mock.calls[0][1][0].listing.imageUrls).toHaveLength(1);
    expect(t.storage.putObject).toHaveBeenCalledTimes(1);
  });

  it('makes a WebP copy of a first-party original that only exists as JPG/PNG', async () => {
    const bucket = 'https://my-bucket.s3.amazonaws.com';
    const t = await publishWith(
      [`${bucket}/mhn/catalog-images/p/000.jpg`],
      undefined,
      ['mhn/catalog-images/p/000.jpg'],
    );
    t.storage.getObjectBuffer.mockResolvedValue(await png(300));
    await t.service.publish('conn-1', 'listing-1');
    expect(t.storage.putObject).toHaveBeenCalledWith(
      'mhn/catalog-images/p/000.webp',
      expect.any(Buffer),
      'image/webp',
    );
    expect(t.client.push.mock.calls[0][1][0].listing.imageUrls).toEqual([
      'https://rt.example.test/api/storage/serve/mhn/catalog-images/p/000.webp',
    ]);
  });

  it('takes an already-live listing off sale when none of its photos can be obtained', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(new Response('no', { status: 404 })),
      );
    const live = {
      id: 'inst-1',
      listingId: 'listing-1',
      connectionId: 'conn-1',
      storeId: 'rt-store-1',
      syncStatus: 'synced',
      externalId: 'offer-9',
      channelSpecificData: {},
    };
    const t = await publishWith(['https://cdn.example.test/gone'], live);
    t.client.end.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'ended' },
    ]);

    await expect(
      t.service.publish('conn-1', 'listing-1'),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(t.client.push).not.toHaveBeenCalled();
    expect(t.client.end).toHaveBeenCalledWith(SELLER_STORE, ['listing-1']);
    expect(t.current()).toMatchObject({
      syncStatus: 'error',
      lastError: expect.stringContaining('taken off sale on PartsBazar360'),
    });
  });

  it('does not call end for a listing that was never live', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(new Response('no', { status: 404 })),
      );
    const t = await publishWith(['https://cdn.example.test/gone']);
    await expect(
      t.service.publish('conn-1', 'listing-1'),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(t.client.end).not.toHaveBeenCalled();
  });
});

describe('PartsBazar360Service.reconcile', () => {
  const publishing = {
    id: 'inst-1',
    listingId: 'listing-1',
    connectionId: 'conn-1',
    storeId: 'rt-store-1',
    syncStatus: 'publishing',
    channelSpecificData: {},
  };

  it('completes an in-flight publish once the receiver has imported it', async () => {
    const t = build({ instance: { ...publishing } });
    t.client.status.mockResolvedValue(remote());
    await t.service.reconcile('inst-1', 2);
    expect(t.current().syncStatus).toBe('synced');
  });

  it('re-queues while still pending, then gives up with an actionable error', async () => {
    const pending = remote({ status: 'queued', offer: null, part: null });

    const early = build({ instance: { ...publishing } });
    early.client.status.mockResolvedValue(pending);
    await early.service.reconcile('inst-1', 2);
    expect(early.queue.add).toHaveBeenCalledWith(
      PARTSBAZAR360_STATUS_JOB,
      { instanceId: 'inst-1', attempt: 3 },
      expect.any(Object),
    );

    const last = build({ instance: { ...publishing } });
    last.client.status.mockResolvedValue(pending);
    await last.service.reconcile('inst-1', 6);
    expect(last.queue.add).not.toHaveBeenCalled();
    expect(last.current()).toMatchObject({
      syncStatus: 'error',
      lastError: expect.stringContaining('did not confirm'),
    });
  });

  it('leaves an instance that is no longer publishing alone', async () => {
    const t = build({ instance: { ...publishing, syncStatus: 'ended' } });
    await t.service.reconcile('inst-1');
    expect(t.client.status).not.toHaveBeenCalled();
  });
});

describe('PartsBazar360Service.connect', () => {
  it('verifies the seller with the live API before saving anything', async () => {
    const t = build();
    t.storeRepo.findOne.mockResolvedValueOnce(null as never);
    t.client.health.mockRejectedValue(
      new PartsBazarApiError('No seller mapped', 404, false),
    );

    await expect(
      t.service.connect('user-1', { storeName: 'PB', sellerStoreId: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(t.connectionRepo.save).not.toHaveBeenCalled();
    expect(t.storeRepo.save).not.toHaveBeenCalled();
  });

  it('creates a connection and primary store, storing no per-user secret', async () => {
    const t = build();
    t.storeRepo.findOne.mockResolvedValueOnce(null as never);
    t.client.health.mockResolvedValue({
      ok: true,
      seller: { id: 's1', name: 'Blackline Auto Parts' },
    });

    const result = await t.service.connect('user-1', {
      storeName: 'PB Blackline',
      sellerStoreId: ` ${SELLER_STORE} `,
    });

    expect(t.client.health).toHaveBeenCalledWith(SELLER_STORE);
    expect(result).toMatchObject({
      connectionId: 'conn-new',
      storeId: 'rt-store-new',
    });
    expect(t.connectionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'partsbazar360',
        externalAccountId: SELLER_STORE,
        accountName: 'Blackline Auto Parts',
      }),
    );
    // The placeholder token must not contain the shared API key.
    expect(
      JSON.stringify(t.connectionRepo.create.mock.calls[0][0]),
    ).not.toMatch(/api[_-]?key/i);
  });

  it('is idempotent per seller', async () => {
    const t = build();
    t.client.health.mockResolvedValue({ ok: true, seller: null });
    const result = await t.service.connect('user-1', {
      storeName: 'PB',
      sellerStoreId: SELLER_STORE,
    });
    expect(result.storeId).toBe('rt-store-1');
    expect(t.connectionRepo.save).not.toHaveBeenCalled();
  });

  it('refuses when the server has no API key configured', async () => {
    const t = build();
    t.client.isConfigured.mockReturnValue(false);
    await expect(
      t.service.connect('user-1', {
        storeName: 'PB',
        sellerStoreId: SELLER_STORE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(t.client.health).not.toHaveBeenCalled();
  });
});

describe('PartsBazar360Service.end', () => {
  it('takes the listing off PartsBazar360 and marks the instance ended', async () => {
    const t = build({
      instance: {
        id: 'inst-1',
        listingId: 'listing-1',
        connectionId: 'conn-1',
        syncStatus: 'synced',
        channelSpecificData: {},
      },
    });
    t.client.end.mockResolvedValue([
      { sourceListingId: 'listing-1', status: 'ended' },
    ]);
    await expect(t.service.end('listing-1')).resolves.toEqual({
      success: true,
    });
    expect(t.client.end).toHaveBeenCalledWith(SELLER_STORE, ['listing-1']);
    expect(t.current().syncStatus).toBe('ended');
  });

  it('raises NotFound when the listing was never published there', async () => {
    const t = build();
    await expect(t.service.end('listing-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
