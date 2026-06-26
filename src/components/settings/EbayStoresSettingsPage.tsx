import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  disconnectEbayAccount,
  listEbayAccounts,
  startEbayOAuth,
  syncEbayListings,
  syncEbayPolicies,
  type EbayAccountSummary,
} from '../../lib/ebayIntegrationsApi';
import {
  getSellerpunditConfig,
  syncSellerpunditAll,
  syncSellerpunditStores,
  testSellerpunditConnection,
  type SellerpunditConfigView,
} from '../../lib/sellerpunditIntegrationsApi';
import { useEbayWorkspace } from '../../hooks/useEbayWorkspace';

const MARKETPLACES = [
  { id: 'EBAY_US', label: 'eBay US' },
  { id: 'EBAY_MOTORS_US', label: 'eBay Motors US' },
  { id: 'EBAY_GB', label: 'eBay UK' },
  { id: 'EBAY_DE', label: 'eBay Germany' },
  { id: 'EBAY_AU', label: 'eBay Australia' },
];

export default function EbayStoresSettingsPage() {
  const {
    signedIn,
    organizationId,
    organizationName,
    organizations,
    loading: workspaceLoading,
    error: workspaceError,
    ready,
    selectWorkspace,
  } = useEbayWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [displayName, setDisplayName] = useState('');
  const [marketplaceId, setMarketplaceId] = useState('EBAY_MOTORS_US');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [accounts, setAccounts] = useState<EbayAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [spLoading, setSpLoading] = useState(false);
  const [spConfig, setSpConfig] = useState<SellerpunditConfigView | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const oauthBanner = useMemo(() => {
    const success = searchParams.get('success');
    const err = searchParams.get('error');
    const acct = searchParams.get('accountId');
    if (success && acct) {
      return {
        type: 'ok' as const,
        text: `eBay seller connected. We identified your account from eBay after Sign in — no separate seller ID to paste.`,
      };
    }
    if (err) return { type: 'err' as const, text: `OAuth error: ${err}` };
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (oauthBanner) {
      const t = setTimeout(() => {
        searchParams.delete('success');
        searchParams.delete('error');
        searchParams.delete('accountId');
        setSearchParams(searchParams, { replace: true });
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [oauthBanner, searchParams, setSearchParams]);

  const loadAccounts = useCallback(async () => {
    if (!ready || !organizationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await listEbayAccounts(organizationId);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [ready, organizationId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const loadSellerpunditConfig = useCallback(async () => {
    if (!ready || !organizationId) return;
    try {
      const cfg = await getSellerpunditConfig(organizationId);
      setSpConfig(cfg);
    } catch {
      setSpConfig(null);
    }
  }, [ready, organizationId]);

  useEffect(() => {
    void loadSellerpunditConfig();
  }, [loadSellerpunditConfig]);

  const syncListings = async (accountId: string) => {
    if (!organizationId) return;
    setMessage(null);
    try {
      const data = await syncEbayListings(accountId, organizationId);
      setMessage(`Listing sync queued (job ${data.jobId ?? '—'})`);
      await loadAccounts();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Listing sync failed');
    }
  };

  const syncPolicies = async (accountId: string) => {
    if (!organizationId) return;
    setMessage(null);
    try {
      const data = await syncEbayPolicies(accountId, organizationId);
      setMessage(data.message ?? `Synced ${data.synced ?? 0} policy rows`);
      await loadAccounts();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Policy sync failed');
    }
  };

  const disconnect = async (accountId: string, name: string) => {
    if (!organizationId) return;
    if (!window.confirm(`Disconnect "${name}"? The account will be disabled but data is preserved.`)) return;
    setMessage(null);
    try {
      await disconnectEbayAccount(accountId, organizationId);
      setMessage(`Disconnected ${name}.`);
      await loadAccounts();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Disconnect failed');
    }
  };

  const importSellerpundit = async () => {
    if (!organizationId) return;
    setSpLoading(true);
    setMessage(null);
    try {
      const data = await syncSellerpunditStores(organizationId);
      setMessage(
        `SellerPundit: imported ${data.imported}, updated ${data.updated}, skipped ${data.skipped}.`,
      );
      await loadAccounts();
      await loadSellerpunditConfig();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'SellerPundit import failed');
    } finally {
      setSpLoading(false);
    }
  };

  const testSellerpundit = async () => {
    if (!organizationId) return;
    setSpLoading(true);
    setMessage(null);
    try {
      const data = await testSellerpunditConnection(organizationId);
      setMessage(`SellerPundit connection OK — ${data.storeCount} store(s) visible.`);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'SellerPundit test failed');
    } finally {
      setSpLoading(false);
    }
  };

  const syncAllSellerpundit = async () => {
    if (!organizationId) return;
    setSpLoading(true);
    setMessage(null);
    try {
      await syncSellerpunditAll(organizationId);
      setMessage('SellerPundit stores and policies synced.');
      await loadAccounts();
      await loadSellerpunditConfig();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'SellerPundit sync failed');
    } finally {
      setSpLoading(false);
    }
  };

  const connect = async () => {
    if (!signedIn) {
      setMessage('Sign in, then use Sign in with eBay to connect your seller account.');
      return;
    }
    if (!organizationId) {
      setMessage('Loading workspace…');
      return;
    }
    setMessage(null);
    try {
      const data = await startEbayOAuth({
        organizationId,
        marketplaceId,
        environment,
        accountDisplayName: displayName.trim() || undefined,
      });
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setMessage('No authUrl returned');
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'OAuth start failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 text-slate-900 dark:text-slate-100">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">eBay stores</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
          Connect a seller with <strong className="text-slate-500 dark:text-slate-300">Sign in with eBay</strong>.
          eBay does not give you an organization ID to look up — after consent we call{' '}
          <code className="text-xs text-slate-500 dark:text-slate-400">commerce/identity/v1/user</code> with the
          seller&apos;s user access token and store their eBay user ID, username, and tokens
          securely on our server.
        </p>
      </div>

      {oauthBanner && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            oauthBanner.type === 'ok'
              ? 'bg-emerald-900/40 border border-emerald-700/50'
              : 'bg-red-900/40 border border-red-700/50'
          }`}
        >
          {oauthBanner.text}
        </div>
      )}

      {workspaceError && (
        <p className="text-sm text-red-300">{workspaceError}</p>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-lg font-medium">Connect seller account</h2>
        {!signedIn && (
          <p className="text-amber-300 text-sm">
            <Link to="/login" className="underline">
              Sign in
            </Link>{' '}
            to RealTrack first, then connect eBay.
          </p>
        )}
        {signedIn && workspaceLoading && (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Preparing your workspace…</p>
        )}
        {signedIn && !workspaceLoading && organizationName && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Workspace: <span className="text-slate-600 dark:text-slate-200">{organizationName}</span>
            <span className="text-slate-500 dark:text-slate-600 text-xs ml-2">(internal tenant — not from eBay)</span>
          </p>
        )}
        {organizations.length > 1 && organizationId && (
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Workspace</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={organizationId}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {organizations.map((o) => (
                <option key={o.organizationId} value={o.organizationId}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">Label in RealTrack (optional)</span>
          <input
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Defaults to your eBay username after connect"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Marketplace</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={marketplaceId}
              onChange={(e) => setMarketplaceId(e.target.value)}
            >
              {MARKETPLACES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Environment</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={!signedIn || workspaceLoading}
          className="inline-flex items-center rounded-md bg-[#E53238] hover:bg-[#c42a2f] disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in with eBay
        </button>
        {message && <p className="text-sm text-amber-300">{message}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-lg font-medium">Import from SellerPundit</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Pull eBay stores already connected in SellerPundit into this workspace. Tokens and
          business policies are stored here; listings publish through SellerPundit&apos;s bulk API.
          Configure <code className="text-xs">SELLERPUNDIT_EMAIL</code> /{' '}
          <code className="text-xs">SELLERPUNDIT_PASSWORD</code> in the backend environment, or
          save org credentials via API.
        </p>
        {spConfig && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Status: {spConfig.configured ? 'configured' : 'not configured'}
            {spConfig.lastSyncAt
              ? ` · last import ${new Date(spConfig.lastSyncAt).toLocaleString()}`
              : ''}
            {spConfig.lastError ? ` · error: ${spConfig.lastError}` : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!signedIn || spLoading || !ready}
            onClick={() => void testSellerpundit()}
            className="text-sm rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Test connection
          </button>
          <button
            type="button"
            disabled={!signedIn || spLoading || !ready}
            onClick={() => void importSellerpundit()}
            className="text-sm rounded-md border border-sky-700 text-sky-300 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Import stores
          </button>
          <button
            type="button"
            disabled={!signedIn || spLoading || !ready}
            onClick={() => void syncAllSellerpundit()}
            className="text-sm rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Sync stores + policies
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Connected sellers</h2>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="text-sm text-sky-400 hover:underline disabled:opacity-50"
            disabled={loading || !ready}
          >
            Refresh
          </button>
        </div>
        {loading && <p className="text-slate-500 dark:text-slate-400 text-sm">Loading…</p>}
        {!loading && accounts.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No eBay sellers connected yet. Use Sign in with eBay above.
          </p>
        )}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {accounts.map((a) => (
            <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {a.accountDisplayName}
                  {a.connectionSource === 'sellerpundit' ? (
                    <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-sky-900/50 text-sky-300 border border-sky-800">
                      SellerPundit
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      Direct OAuth
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  eBay user: {a.ebayUserId} · {a.environment} ·{' '}
                  <span
                    className={
                      a.connectionStatus === 'active' ? 'text-emerald-400' : 'text-amber-300'
                    }
                  >
                    {a.connectionStatus}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Marketplaces:{' '}
                  {(a.marketplaces ?? []).map((m) => m.marketplaceId).join(', ') || '—'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  to={`/settings/integrations/ebay/${a.id}`}
                  className="text-xs rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 hover:bg-slate-100 dark:bg-slate-800"
                >
                  Details
                </Link>
                <button
                  type="button"
                  className="text-xs rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 hover:bg-slate-100 dark:bg-slate-800"
                  onClick={() => void syncPolicies(a.id)}
                >
                  Sync policies
                </button>
                <button
                  type="button"
                  className="text-xs rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 hover:bg-slate-100 dark:bg-slate-800"
                  onClick={() => void syncListings(a.id)}
                >
                  Sync listings
                </button>
                <Link
                  to={`/settings/integrations/ebay/${a.id}/policies`}
                  className="text-xs rounded-md border border-sky-700 text-sky-300 px-2 py-1.5 hover:bg-slate-100 dark:bg-slate-800"
                >
                  Map defaults
                </Link>
                {a.connectionStatus !== 'disabled' && (
                  <button
                    type="button"
                    className="text-xs rounded-md border border-red-700 text-red-400 px-2 py-1.5 hover:bg-red-900/20"
                    onClick={() => void disconnect(a.id, a.accountDisplayName)}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
