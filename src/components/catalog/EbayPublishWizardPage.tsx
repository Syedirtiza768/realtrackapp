import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ORG_LS = 'rt_ebay_integration_org_id';

type AccountRow = {
  id: string;
  accountDisplayName: string;
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
  const { user } = useAuth();
  const userId = user?.id;
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_LS) ?? '');
  const [productTitle, setProductTitle] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidateEntry[] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [skippedTargets, setSkippedTargets] = useState<
    { ebayAccountId: string; marketplaceId: string; errors: string[] }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) h['x-user-id'] = userId;
    return h;
  }, [userId]);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    const res = await fetch(`/api/catalog-products/${productId}`);
    const data = await res.json();
    if (res.ok && data?.title) setProductTitle(data.title as string);
  }, [productId]);

  const loadAccounts = useCallback(async () => {
    if (!orgId.trim() || !userId) return;
    const res = await fetch(
      `/api/integrations/ebay/accounts?organizationId=${encodeURIComponent(orgId.trim())}`,
      { headers },
    );
    const data = await res.json();
    if (res.ok && Array.isArray(data)) setAccounts(data);
  }, [orgId, userId, headers]);

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
    if (!productId || !orgId.trim() || !userId) {
      setMessage('Organization ID and sign-in are required');
      return;
    }
    localStorage.setItem(ORG_LS, orgId.trim());
    setMessage(null);
    const res = await fetch('/api/ebay/listings/validate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizationId: orgId.trim(),
        catalogProductId: productId,
        targets,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message ?? data.error ?? 'Validation request failed');
      return;
    }
    setValidation((data.results ?? []) as ValidateEntry[]);
  };

  const runPublish = async () => {
    if (!productId || !orgId.trim() || !userId) {
      setMessage('Organization ID and sign-in are required');
      return;
    }
    if (!targets.length) {
      setMessage('Select at least one store');
      return;
    }
    setMessage(null);
    setSkippedTargets([]);
    const res = await fetch('/api/ebay/listings/publish', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizationId: orgId.trim(),
        catalogProductId: productId,
        targets,
        requestedByUserId: userId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      /** Nest `BadRequestException({ message, failures })` returns that object as JSON (no wrapper). */
      const msg = data.message as { failures?: unknown[] } | string | undefined;
      const fails =
        data.failures ??
        (typeof msg === 'object' && msg && Array.isArray(msg.failures) ? msg.failures : null);
      if (Array.isArray(fails) && fails.length) {
        setSkippedTargets(
          fails as { ebayAccountId: string; marketplaceId: string; errors: string[] }[],
        );
        setMessage(
          typeof msg === 'string'
            ? msg
            : 'No eligible targets — fix errors below or deselect blocked stores.',
        );
      } else {
        setMessage(typeof msg === 'string' ? msg : JSON.stringify(data));
      }
      return;
    }
    setJobId(data.jobId as string);
    setJobStatus(data.status as string);
    const skipped = data.skippedTargets as
      | { ebayAccountId: string; marketplaceId: string; errors: string[] }[]
      | undefined;
    if (Array.isArray(skipped) && skipped.length) setSkippedTargets(skipped);
  };

  useEffect(() => {
    if (!jobId || !orgId.trim() || !userId) return;
    const t = setInterval(async () => {
      const res = await fetch(
        `/api/ebay/listing-jobs/${jobId}?organizationId=${encodeURIComponent(orgId.trim())}`,
        { headers },
      );
      const data = await res.json();
      if (res.ok && data?.status) {
        setJobStatus(data.status as string);
        if (['completed', 'failed', 'completed_with_errors'].includes(data.status)) {
          clearInterval(t);
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [jobId, orgId, userId, headers]);

  const readyCount =
    validation?.filter((v) => v.status === 'ready' || v.status === 'warnings').length ?? 0;
  const blockedCount = validation?.filter((v) => v.status === 'blocked').length ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-100">
      <Link to="/catalog" className="text-sm text-sky-400 hover:underline">
        ← Catalog
      </Link>
      <h1 className="text-2xl font-semibold">Publish to eBay</h1>
      <p className="text-slate-400 text-sm">
        Product: <span className="text-slate-200">{productTitle || productId}</span>
      </p>

      <label className="block text-sm max-w-md">
        <span className="text-slate-400">Organization ID</span>
        <input
          className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        />
      </label>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
        <h2 className="text-lg font-medium">Target stores</h2>
        {!userId && <p className="text-amber-300 text-sm">Sign in to call the API.</p>}
        {accounts.map((a) => (
          <div key={a.id} className="border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="font-medium">{a.accountDisplayName}</div>
            <div className="text-xs text-slate-500">{a.connectionStatus}</div>
            <div className="flex flex-wrap gap-2">
              {(a.marketplaces ?? []).map((m) => {
                const key = `${a.id}:${m.marketplaceId}`;
                return (
                  <label
                    key={key}
                    className="inline-flex items-center gap-2 text-sm border border-slate-700 rounded px-2 py-1 cursor-pointer"
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
          className="rounded-md border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
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
        <p className="text-sm text-slate-300">
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
                v.status === 'blocked' ? 'border-red-800 bg-red-950/30' : 'border-slate-700'
              }`}
            >
              <div className="font-mono text-xs text-slate-400">{v.key}</div>
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
              <li key={`${s.ebayAccountId}:${s.marketplaceId}`} className="font-mono text-xs text-slate-300">
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
        <p className="text-sm text-slate-400">
          Job {jobId} — status: <strong className="text-slate-200">{jobStatus ?? '…'}</strong> (polls every 2s)
        </p>
      )}

      {message && <p className="text-sm text-amber-300">{message}</p>}
    </div>
  );
}
