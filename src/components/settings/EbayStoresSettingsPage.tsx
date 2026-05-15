import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ORG_LS = 'rt_ebay_integration_org_id';

const MARKETPLACES = [
  { id: 'EBAY_US', label: 'eBay US' },
  { id: 'EBAY_MOTORS_US', label: 'eBay Motors US' },
  { id: 'EBAY_GB', label: 'eBay UK' },
  { id: 'EBAY_DE', label: 'eBay Germany' },
  { id: 'EBAY_AU', label: 'eBay Australia' },
];

type AccountRow = {
  id: string;
  accountDisplayName: string;
  ebayUserId: string;
  environment: string;
  connectionStatus: string;
  marketplaces: { marketplaceId: string; enabled: boolean }[];
};

export default function EbayStoresSettingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_LS) ?? '');
  const [displayName, setDisplayName] = useState('Primary eBay store');
  const [marketplaceId, setMarketplaceId] = useState('EBAY_MOTORS_US');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const userId = user?.id;

  const oauthBanner = useMemo(() => {
    const success = searchParams.get('success');
    const err = searchParams.get('error');
    const acct = searchParams.get('accountId');
    if (success && acct) return { type: 'ok' as const, text: `Connected account ${acct}` };
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
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [oauthBanner, searchParams, setSearchParams]);

  const headers = useCallback(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) h['x-user-id'] = userId;
    return h;
  }, [userId]);

  const loadAccounts = useCallback(async () => {
    if (!orgId.trim() || !userId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/integrations/ebay/accounts?organizationId=${encodeURIComponent(orgId.trim())}`,
        { headers: headers() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to load');
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [orgId, userId, headers]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const syncPolicies = async (accountId: string) => {
    if (!orgId.trim() || !userId) return;
    setMessage(null);
    try {
      const res = await fetch(
        `/api/integrations/ebay/accounts/${accountId}/sync-policies?organizationId=${encodeURIComponent(orgId.trim())}`,
        { method: 'POST', headers: headers() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Sync failed');
      setMessage(data.message ?? `Synced ${data.synced ?? 0} policy rows`);
      await loadAccounts();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Policy sync failed');
    }
  };

  const connect = async () => {
    if (!orgId.trim()) {
      setMessage('Organization ID is required');
      return;
    }
    if (!userId) {
      setMessage('Sign in first so your user id can be sent to the API');
      return;
    }
    localStorage.setItem(ORG_LS, orgId.trim());
    setMessage(null);
    const res = await fetch('/api/integrations/ebay/oauth/start', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        organizationId: orgId.trim(),
        marketplaceId,
        environment,
        accountDisplayName: displayName.trim() || 'eBay store',
        userId,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setMessage(data.error ?? data.message ?? 'OAuth start failed');
      return;
    }
    if (data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      setMessage('No authUrl returned');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 text-slate-100">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">eBay stores</h1>
        <p className="text-slate-400 mt-2 text-sm">
          Connect one or more seller accounts with the official eBay OAuth flow. Tokens stay on the
          server — never paste passwords or developer keys here.
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

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-lg font-medium">Connect new account</h2>
        {!userId && (
          <p className="text-amber-300 text-sm">You are not signed in — login so the API can attribute the connection.</p>
        )}
        <label className="block text-sm">
          <span className="text-slate-400">Organization ID</span>
          <input
            className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="UUID from organizations table"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Store display name</span>
          <input
            className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-400">Marketplace</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
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
            <span className="text-slate-400">Environment</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
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
          className="inline-flex items-center rounded-md bg-[#E53238] hover:bg-[#c42a2f] px-4 py-2 text-sm font-medium text-white"
        >
          Connect with eBay
        </button>
        {message && <p className="text-sm text-amber-300">{message}</p>}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Connected accounts</h2>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="text-sm text-sky-400 hover:underline disabled:opacity-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading && <p className="text-slate-500 text-sm">Loading…</p>}
        {!loading && accounts.length === 0 && (
          <p className="text-slate-500 text-sm">No accounts yet for this organization.</p>
        )}
        <ul className="divide-y divide-slate-800">
          {accounts.map((a) => (
            <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium">{a.accountDisplayName}</div>
                <div className="text-xs text-slate-500">
                  {a.ebayUserId} · {a.environment} ·{' '}
                  <span
                    className={
                      a.connectionStatus === 'active' ? 'text-emerald-400' : 'text-amber-300'
                    }
                  >
                    {a.connectionStatus}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Marketplaces:{' '}
                  {(a.marketplaces ?? []).map((m) => m.marketplaceId).join(', ') || '—'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  className="text-xs rounded-md border border-slate-600 px-2 py-1.5 hover:bg-slate-800"
                  onClick={() => void syncPolicies(a.id)}
                >
                  Sync policies
                </button>
                <Link
                  to={`/settings/integrations/ebay/${a.id}/policies?organizationId=${encodeURIComponent(orgId.trim())}`}
                  className="text-xs rounded-md border border-sky-700 text-sky-300 px-2 py-1.5 hover:bg-slate-800"
                >
                  Map defaults
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
