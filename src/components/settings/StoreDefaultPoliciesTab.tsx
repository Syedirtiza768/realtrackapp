import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import {
  listEbayAccounts,
  syncEbayPolicies,
  type EbayAccountSummary,
} from '../../lib/ebayIntegrationsApi';
import { useEbayWorkspace } from '../../hooks/useEbayWorkspace';
import { usePermissions } from '../../hooks/usePermissions';
import Can from '../auth/Can';
import { Card, CardContent } from '../ui/card';
import EbayAccountPolicyEditor from './EbayAccountPolicyEditor';
import {
  accountPoliciesComplete,
  marketplacePoliciesComplete,
} from './ebayPolicyEditor.types';

export default function StoreDefaultPoliciesTab() {
  const { signedIn, organizationId, organizationName, ready, loading: workspaceLoading } =
    useEbayWorkspace();
  const { has } = usePermissions();
  const canManage = has('ebay.manage');
  const canSync = has('ebay.sync');

  const [accounts, setAccounts] = useState<EbayAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!ready || !organizationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await listEbayAccounts(organizationId);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, [ready, organizationId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const summary = useMemo(() => {
    const complete = accounts.filter((a) => accountPoliciesComplete(a)).length;
    return { complete, total: accounts.length };
  }, [accounts]);

  const syncPolicies = async (accountId: string) => {
    if (!organizationId || !canSync) return;
    setSyncingId(accountId);
    setMessage(null);
    try {
      const data = await syncEbayPolicies(accountId, organizationId);
      setMessage(data.message ?? `Synced ${data.synced ?? 0} policy rows`);
      await loadAccounts();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Policy sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const syncAllPolicies = async () => {
    if (!organizationId || !canSync || !accounts.length) return;
    setSyncingAll(true);
    setMessage(null);
    try {
      let synced = 0;
      for (const account of accounts) {
        const data = await syncEbayPolicies(account.id, organizationId);
        synced += data.synced ?? 0;
      }
      setMessage(`Synced policies for ${accounts.length} store(s) (${synced} rows).`);
      await loadAccounts();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Bulk policy sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <Can
      permission="ebay.view"
      fallback={
        <Card>
          <CardContent className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            You need <code className="text-xs">ebay.view</code> permission to manage store policies.
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Set default fulfillment, payment, and return policies for each connected eBay store and
              marketplace. Publishing is blocked until all three are configured.
              {organizationName && (
                <>
                  {' '}
                  Workspace: <span className="text-slate-600 dark:text-slate-200">{organizationName}</span>
                </>
              )}
            </p>
            {accounts.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {summary.complete} of {summary.total} store{summary.total !== 1 ? 's' : ''} fully configured
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              to="/settings/integrations/ebay"
              className="inline-flex items-center gap-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Manage connections
              <ExternalLink size={14} />
            </Link>
            {canSync && accounts.length > 0 && (
              <button
                type="button"
                disabled={syncingAll || loading}
                onClick={() => void syncAllPolicies()}
                className="inline-flex items-center gap-1.5 text-sm rounded-md border border-sky-700 text-sky-300 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
                Sync all policies
              </button>
            )}
          </div>
        </div>

        {!signedIn && (
          <Card>
            <CardContent className="py-6 text-sm text-slate-500 dark:text-slate-400">
              <Link to="/login" className="text-sky-400 underline">
                Sign in
              </Link>{' '}
              to configure store policies.
            </CardContent>
          </Card>
        )}

        {signedIn && workspaceLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading workspace…</p>
        )}

        {message && <p className="text-sm text-amber-300">{message}</p>}

        {signedIn && !workspaceLoading && loading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading stores…</p>
        )}

        {signedIn && !workspaceLoading && !loading && accounts.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No eBay stores connected yet.
              </p>
              <Link
                to="/settings/integrations/ebay"
                className="inline-flex text-sm text-sky-400 hover:underline"
              >
                Connect a store
              </Link>
            </CardContent>
          </Card>
        )}

        {signedIn && !workspaceLoading && !loading && accounts.length > 0 && (
          <div className="space-y-3">
            {!canManage && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                View-only — ask an admin for <code className="text-[10px]">ebay.manage</code> to save changes.
              </p>
            )}
            {accounts.map((account) => {
              const complete = accountPoliciesComplete(account);
              const expanded = expandedId === account.id;
              return (
                <Card key={account.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-4 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : account.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {account.accountDisplayName}
                        </span>
                        {complete ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 size={10} />
                            Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-900/40 text-amber-300 border border-amber-800">
                            <AlertCircle size={10} />
                            Incomplete
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                        {(account.marketplaces ?? [])
                          .map((m) => {
                            const ok = marketplacePoliciesComplete(m);
                            return `${m.marketplaceId}${ok ? '' : ' (needs defaults)'}`;
                          })
                          .join(' · ') || 'No marketplaces'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canSync && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="text-xs rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            void syncPolicies(account.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              void syncPolicies(account.id);
                            }
                          }}
                        >
                          {syncingId === account.id ? 'Syncing…' : 'Sync policies'}
                        </span>
                      )}
                      {expanded ? (
                        <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-500 dark:text-slate-400" />
                      )}
                    </div>
                  </button>
                  {expanded && organizationId && (
                    <CardContent className="pt-0 border-t border-slate-200 dark:border-slate-800">
                      <div className="pt-4">
                        <EbayAccountPolicyEditor
                          accountId={account.id}
                          organizationId={organizationId}
                          canEdit={canManage}
                          onSaved={() => void loadAccounts()}
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Can>
  );
}
