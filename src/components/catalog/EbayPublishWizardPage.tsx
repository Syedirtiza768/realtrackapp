import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getEbayListingJob,
  getEbayListingJobTargets,
  listEbayAccounts,
  publishEbayListing,
  validateEbayListing,
  type EbayListingJobTargetRow,
} from '../../lib/ebayIntegrationsApi';
import { useEbayWorkspace } from '../../hooks/useEbayWorkspace';
import { fetchWithAuth } from '../../lib/authApi';

type AccountRow = {
  id: string;
  accountDisplayName: string;
  ebayUserId: string;
  connectionStatus: string;
  marketplaces: { marketplaceId: string; enabled: boolean }[];
};

type ValidateEntry = {
  key: string;
  status: string;
  errors: string[];
  warnings: string[];
};

export default function EbayPublishWizardPage() {
  const { productId } = useParams<{ productId: string }>();
  const { signedIn, organizationId, ready } = useEbayWorkspace();
  const [productTitle, setProductTitle] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidateEntry[] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobTargets, setJobTargets] = useState<EbayListingJobTargetRow[] | null>(null);
  const [skippedTargets, setSkippedTargets] = useState<
    { ebayAccountId: string; marketplaceId: string; errors: string[] }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    try {
      const data = await fetchWithAuth<{ title?: string }>(`/api/catalog-products/${productId}`);
      if (data?.title) setProductTitle(data.title);
      return;
    } catch {
      /* catalog product id may be a listing record id from catalog browse */
    }
    try {
      const listing = await fetchWithAuth<{ title?: string }>(`/api/v2/listings/${productId}`);
      if (listing?.title) setProductTitle(listing.title);
    } catch {
      // title is optional in wizard header
    }
  }, [productId]);

  const loadAccounts = useCallback(async () => {
    if (!ready) return;
    try {
      const data = await listEbayAccounts(organizationId ?? undefined);
      if (Array.isArray(data)) setAccounts(data as AccountRow[]);
    } catch {
      /* ignore until connected */
    }
  }, [ready, organizationId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const toggle = (accountId: string, marketplaceId: string) => {
    const key = `${accountId}:${marketplaceId}`;
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const targets = useMemo(() => {
    const out: { ebayAccountId: string; marketplaceId: string }[] = [];
    for (const a of accounts) {
      for (const m of a.marketplaces ?? []) {
        if (!m.enabled) continue;
        const key = `${a.id}:${m.marketplaceId}`;
        if (selected[key]) out.push({ ebayAccountId: a.id, marketplaceId: m.marketplaceId });
      }
    }
    return out;
  }, [accounts, selected]);

  const runValidate = async () => {
    if (!productId || !signedIn) {
      setMessage('Sign in to validate listings');
      return;
    }
    setMessage(null);
    try {
      const data = (await validateEbayListing({
        organizationId: organizationId ?? undefined,
        catalogProductId: productId,
        targets,
      })) as { results?: ValidateEntry[] };
      setValidation((data.results ?? []) as ValidateEntry[]);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Validation request failed');
    }
  };

  const runPublish = async () => {
    if (!productId || !signedIn) {
      setMessage('Sign in to publish');
      return;
    }
    if (!targets.length) {
      setMessage('Select at least one store');
      return;
    }
    setMessage(null);
    setSkippedTargets([]);
    try {
      const data = (await publishEbayListing({
        organizationId: organizationId ?? undefined,
        catalogProductId: productId,
        targets,
      })) as {
        jobId?: string;
        status?: string;
        skippedTargets?: { ebayAccountId: string; marketplaceId: string; errors: string[] }[];
      };
      setJobId(data.jobId ?? null);
      setJobStatus(data.status ?? null);
      const skipped = data.skippedTargets;
      if (Array.isArray(skipped) && skipped.length) setSkippedTargets(skipped);
    } catch (e: unknown) {
      const err = e as Error & { responseBody?: Record<string, unknown> };
      const failures = err?.responseBody?.failures as { ebayAccountId: string; marketplaceId: string; errors: string[] }[] | undefined;
      if (failures?.length) {
        setSkippedTargets(failures);
      }
      setMessage(err?.message ?? 'Publish failed');
    }
  };

  const loadJobTargets = useCallback(async () => {
    if (!jobId || !signedIn) return;
    try {
      const rows = await getEbayListingJobTargets(jobId, organizationId ?? undefined);
      setJobTargets(Array.isArray(rows) ? rows : []);
    } catch {
      setJobTargets(null);
    }
  }, [jobId, organizationId, signedIn]);

  useEffect(() => {
    if (!jobId || !signedIn) return;
    const poll = async () => {
      try {
        const data = (await getEbayListingJob(
          jobId,
          organizationId ?? undefined,
        )) as { status?: string };
        if (data?.status) {
          setJobStatus(data.status);
          if (['completed', 'failed', 'completed_with_errors'].includes(data.status)) {
            await loadJobTargets();
            return true;
          }
        }
      } catch {
        /* keep polling */
      }
      return false;
    };
    void poll();
    const t = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [jobId, organizationId, signedIn, loadJobTargets]);

  const readyCount =
    validation?.filter((v) => v.status === 'ready' || v.status === 'warnings').length ?? 0;
  const blockedCount = validation?.filter((v) => v.status === 'blocked').length ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-900 dark:text-slate-100">
      <Link to="/catalog" className="text-sm text-sky-400 hover:underline">
        ← Catalog
      </Link>
      <h1 className="text-2xl font-semibold">Publish to eBay</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Product: <span className="text-slate-600 dark:text-slate-200">{productTitle || productId}</span>
      </p>
      {!signedIn && (
        <p className="text-amber-300 text-sm">
          <Link to="/login" className="underline">
            Sign in
          </Link>{' '}
          and connect sellers under{' '}
          <Link to="/settings/integrations/ebay" className="underline">
            eBay stores
          </Link>
          .
        </p>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-5 space-y-3">
        <h2 className="text-lg font-medium">Target sellers</h2>
        {accounts.length === 0 && signedIn && (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No connected sellers.{' '}
            <Link to="/settings/integrations/ebay" className="text-sky-400 underline">
              Sign in with eBay
            </Link>{' '}
            first.
          </p>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <div className="font-medium">{a.accountDisplayName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              eBay user {a.ebayUserId} · {a.connectionStatus}
            </div>
            <div className="flex flex-wrap gap-2">
              {(a.marketplaces ?? []).map((m) => {
                const key = `${a.id}:${m.marketplaceId}`;
                return (
                  <label
                    key={key}
                    className="inline-flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[key]}
                      onChange={() => toggle(a.id, m.marketplaceId)}
                    />
                    {m.marketplaceId}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-100 dark:bg-slate-800"
          onClick={() => void runValidate()}
        >
          Validate selection
        </button>
        <button
          type="button"
          className="rounded-md bg-[#E53238] hover:bg-[#c42a2f] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          disabled={!targets.length}
          onClick={() => void runPublish()}
        >
          Publish (queue)
        </button>
      </div>

      {validation && (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          {readyCount} ready / warnings · {blockedCount} blocked. Blocked stores are skipped on publish
          (eligible stores still queue); if every selection is blocked, publish returns an error.
        </p>
      )}

      {validation && (
        <ul className="text-sm space-y-2">
          {validation.map((v) => (
            <li
              key={v.key}
              className={`rounded border px-3 py-2 ${
                v.status === 'blocked' ? 'border-red-800 bg-red-950/30' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{v.key}</div>
              <div>Status: {v.status}</div>
              {v.errors?.length ? (
                <ul className="text-red-300 list-disc pl-4">
                  {v.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              {v.warnings?.length ? (
                <ul className="text-amber-200 list-disc pl-4">
                  {v.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {skippedTargets.length > 0 && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm space-y-2">
          <div className="font-medium text-amber-200">Skipped (not queued)</div>
          <ul className="space-y-2">
            {skippedTargets.map((s) => (
              <li key={`${s.ebayAccountId}:${s.marketplaceId}`} className="font-mono text-xs text-slate-500 dark:text-slate-300">
                {s.ebayAccountId} / {s.marketplaceId}
                {s.errors?.length ? (
                  <ul className="text-amber-100 list-disc pl-4 mt-1 font-sans">
                    {s.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {jobId && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Job {jobId} — status: <strong className="text-slate-600 dark:text-slate-200">{jobStatus ?? '…'}</strong> (polls every 2s)
        </p>
      )}

      {jobTargets && jobTargets.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-medium">Publish results</h3>
          <ul className="text-sm space-y-2">
            {jobTargets.map((t) => (
              <li
                key={t.id}
                className={`rounded border px-3 py-2 ${
                  t.status === 'failed'
                    ? 'border-red-800 bg-red-950/30'
                    : t.status === 'success'
                      ? 'border-emerald-800 bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-mono text-xs text-slate-400">
                  {t.ebayAccountId} / {t.marketplaceId} — {t.status}
                  {t.errorPayload?.stage ? ` (${t.errorPayload.stage})` : ''}
                  {t.errorPayload?.source ? ` · ${t.errorPayload.source}` : ''}
                </div>
                {t.status === 'success' && t.resultPayload?.listingId && (
                  <div className="text-emerald-300 text-xs mt-1">
                    Listing {t.resultPayload.listingId}
                    {t.resultPayload.offerId ? ` · offer ${t.resultPayload.offerId}` : ''}
                  </div>
                )}
                {t.errorPayload?.message && (
                  <div className="text-red-300 text-xs mt-1">{t.errorPayload.message}</div>
                )}
                {t.errorPayload?.errors?.length ? (
                  <ul className="text-red-300 list-disc pl-4 mt-1">
                    {t.errorPayload.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && <p className="text-sm text-amber-300">{message}</p>}
    </div>
  );
}
