import type { ConfigService } from '@nestjs/config';
import {
  PartsBazar360Client,
  PartsBazarApiError,
} from './partsbazar360.client.js';

const KEY = 'super-secret-key';

function client(env: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    PARTSBAZAR360_API_URL: 'https://pb.test/api/',
    PARTSBAZAR360_API_KEY: KEY,
    PARTSBAZAR360_RETRY_BASE_MS: '0',
    ...env,
  };
  const config = {
    get: (name: string, fallback?: string) => values[name] ?? fallback,
  } as unknown as ConfigService;
  return new PartsBazar360Client(config);
}

const json = (body: unknown, init: ResponseInit = { status: 200 }) =>
  new Response(JSON.stringify(body), init);

describe('PartsBazar360Client', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports whether a key is configured', () => {
    expect(client().isConfigured()).toBe(true);
    expect(client({ PARTSBAZAR360_API_KEY: '  ' }).isConfigured()).toBe(false);
  });

  it('refuses to call out without a key, before any network I/O', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      client({ PARTSBAZAR360_API_KEY: undefined }).health(),
    ).rejects.toThrow(/PARTSBAZAR360_API_KEY is not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs items with a bearer token to the normalized base URL', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        json(
          { results: [{ sourceListingId: 'a', status: 'queued' }] },
          { status: 202 },
        ),
      );

    const results = await client().push('store-1', [
      { sourceListingId: 'a', listing: {} as never, hints: {} },
    ]);

    expect(results).toEqual([{ sourceListingId: 'a', status: 'queued' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://pb.test/api/integrations/realtrack/listings');
    expect((init!.headers as Record<string, string>).authorization).toBe(
      `Bearer ${KEY}`,
    );
    expect(JSON.parse(init!.body as string)).toMatchObject({
      storeId: 'store-1',
      listings: [{ sourceListingId: 'a' }],
    });
  });

  it('URL-encodes ids in the status path', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ status: 'imported' }));
    await client().status('store/1', 'a b');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://pb.test/api/integrations/realtrack/listings/store%2F1/a%20b',
    );
  });

  it('retries a 503 and then succeeds', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ message: 'down' }, { status: 503 }))
      .mockResolvedValueOnce(json({ ok: true, seller: null }));
    await expect(client().health()).resolves.toEqual({
      ok: true,
      seller: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a network failure', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json({ ok: true, seller: null }));
    await expect(client().health()).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 401, and surfaces the server message', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        json({ message: 'Invalid RealTrack API key' }, { status: 401 }),
      );

    const error = await client()
      .health()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PartsBazarApiError);
    expect((error as PartsBazarApiError).status).toBe(401);
    expect((error as PartsBazarApiError).retryable).toBe(false);
    expect((error as Error).message).toContain('Invalid RealTrack API key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt budget on a persistent 5xx', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(json({ message: 'busy' }, { status: 503 })),
      );
    await expect(
      client({ PARTSBAZAR360_MAX_ATTEMPTS: '2' }).health(),
    ).rejects.toMatchObject({ status: 503, retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never puts the API key in an error message', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ message: 'nope' }, { status: 403 }));
    const error = (await client()
      .health()
      .catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain(KEY);
  });
});
