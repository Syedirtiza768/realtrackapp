import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getEbayAccount,
  listEbaySyncLogs,
  syncEbayListings,
  syncEbayOrders,
  syncEbayPolicies,
} from '../../lib/ebayIntegrationsApi';
import { useEbayWorkspace } from '../../hooks/useEbayWorkspace';

type AccountDetail = {
  id: string;
  accountDisplayName: string;
  ebayUserId: string;
  ebayUsername: string | null;
  connectionSource?: 'native_oauth' | 'sellerpundit';
  sellerpunditAccountName?: string | null;
  sellerpunditLastPolicySyncAt?: string | null;
  environment: string;
  connectionStatus: string;
  lastSuccessfulSyncAt: string | null;
  lastTokenRefreshAt: string | null;
  lastErrorMessage: string | null;
  lastListingsFetchedCount: number;
  lastPoliciesFetchedCount: number;
  marketplaces: {
    marketplaceId: string;
    enabled: boolean;
    defaultPaymentPolicyId: string | null;
    defaultReturnPolicyId: string | null;
    defaultFulfillmentPolicyId: string | null;
    defaultInventoryLocationKey: string | null;
  }[];
};

type SyncLog = {
  id: string;
  syncType: string;
  status: string;
  itemsProcessed: number;
  itemsUpdated: number;
  itemsFailed: number;
  startedAt: string;
  finishedAt: string | null;
};

export default function EbayStoreDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { signedIn, ready } = useEbayWorkspace();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId || !ready) return;
    setLoading(true);
    setMessage(null);
    try {
      const [acct, logs] = await Promise.all([
        getEbayAccount(accountId) as Promise<AccountDetail>,
        listEbaySyncLogs(accountId) as Promise<SyncLog[]>,
      ]);
      setAccount(acct);
      setSyncLogs(Array.isArray(logs) ? logs : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [accountId, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSync = async (kind: 'policies' | 'listings' | 'orders') => {
    if (!accountId) return;
    setMessage(null);
    try {
      if (kind === 'policies') {
        const data = await syncEbayPolicies(accountId);
        setMessage(data.message ?? `Synced ${data.synced ?? 0} policies`);
      } else if (kind === 'listings') {
        const data = await syncEbayListings(accountId);
        setMessage(`Listing sync queued (job ${data.jobId ?? '—'})`);
      } else {
        const data = await syncEbayOrders(accountId);
        setMessage(`Order sync queued (job ${data.jobId ?? '—'})`);
      }
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Sync failed');
    }
  };

  if (!signedIn) {
    return (
      <div className="p-8 text-slate-400 dark:text-slate-400">
        <Link to="/login" className="text-sky-400 underline">
          Sign in
        </Link>{' '}
        to view store details.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          to="/settings/integrations/ebay"
          className="text-sm text-sky-400 hover:underline"
        >
          ← eBay stores
        </Link>
      </div>

      {loading && <p className="text-slate-400 dark:text-slate-400">Loading…</p>}
      {message && (
        <p className="rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-600 dark:text-slate-200">
          {message}
        </p>
      )}

      {account && (
        <>
          <header>
            <h1 className="text-2xl font-semibold text-white">
              {account.accountDisplayName}
            </h1>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
              {account.connectionSource === 'sellerpundit' && (
                <span className="mr-2 rounded bg-violet-900/60 px-2 py-0.5 text-xs text-violet-200">
                  SellerPundit
                </span>
              )}
              {account.ebayUsername ? `@${account.ebayUsername}` : null}
              {account.ebayUsername ? ' · ' : ''}
              eBay user ID {account.ebayUserId} ·{' '}
              <span className="capitalize">{account.environment}</span> ·{' '}
              <span
                className={
                  account.connectionStatus === 'active'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              >
                {account.connectionStatus}
              </span>
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-300">Sync stats</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-400 dark:text-slate-400">
                <li>
                  Last sync:{' '}
                  {account.lastSuccessfulSyncAt
                    ? new Date(account.lastSuccessfulSyncAt).toLocaleString()
                    : '—'}
                </li>
                <li>Listings fetched: {account.lastListingsFetchedCount}</li>
                <li>Policies cached: {account.lastPoliciesFetchedCount}</li>
                <li>
                  {account.connectionSource === 'sellerpundit'
                    ? 'Token sync (SellerPundit): '
                    : 'Token refresh: '}
                  {account.connectionSource === 'sellerpundit'
                    ? account.lastTokenRefreshAt
                      ? new Date(account.lastTokenRefreshAt).toLocaleString()
                      : '—'
                    : account.lastTokenRefreshAt
                      ? new Date(account.lastTokenRefreshAt).toLocaleString()
                      : '—'}
                </li>
                {account.connectionSource === 'sellerpundit' &&
                  account.sellerpunditLastPolicySyncAt && (
                    <li>
                      Policies synced:{' '}
                      {new Date(account.sellerpunditLastPolicySyncAt).toLocaleString()}
                    </li>
                  )}
                {account.lastErrorMessage && (
                  <li className="text-amber-400">{account.lastErrorMessage}</li>
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-300">Actions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runSync('policies')}
                  className="rounded bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Sync policies
                </button>
                {account.connectionSource !== 'sellerpundit' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void runSync('listings')}
                      className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-600"
                    >
                      Sync listings
                    </button>
                    <button
                      type="button"
                      onClick={() => void runSync('orders')}
                      className="rounded bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-600"
                    >
                      Sync orders
                    </button>
                  </>
                )}
                <Link
                  to={`/settings/integrations/ebay/${accountId}/policies`}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:bg-slate-800"
                >
                  Policy mapping
                </Link>
              </div>
            </div>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-300">Marketplaces</h2>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
              {account.marketplaces.map((m) => (
                <li key={m.marketplaceId} className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">
                  <span className="font-medium">{m.marketplaceId}</span>
                  {m.enabled ? '' : ' (disabled)'}
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Fulfillment: {m.defaultFulfillmentPolicyId ?? '—'} · Payment:{' '}
                    {m.defaultPaymentPolicyId ?? '—'} · Return:{' '}
                    {m.defaultReturnPolicyId ?? '—'} · Location:{' '}
                    {m.defaultInventoryLocationKey ?? '—'}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-300">Recent sync logs</h2>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No sync runs yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                {syncLogs.map((log) => (
                  <li key={log.id} className="px-4 py-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-200">{log.syncType}</span>{' '}
                    <span
                      className={
                        log.status === 'success'
                          ? 'text-emerald-400'
                          : log.status === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-400'
                      }
                    >
                      {log.status}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {' '}
                      · {log.itemsProcessed} processed, {log.itemsUpdated} updated
                      {log.itemsFailed > 0 ? `, ${log.itemsFailed} failed` : ''}
                    </span>
                    <div className="text-xs text-slate-500 dark:text-slate-600">
                      {new Date(log.startedAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
