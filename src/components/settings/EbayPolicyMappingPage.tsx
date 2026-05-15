import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type PolicyRow = {
  id: string;
  marketplaceId: string;
  policyType: string;
  ebayPolicyId: string;
  name: string;
  isDefault: boolean;
};

type MpRow = {
  marketplaceId: string;
  defaultPaymentPolicyId: string | null;
  defaultReturnPolicyId: string | null;
  defaultFulfillmentPolicyId: string | null;
  defaultInventoryLocationKey: string | null;
};

type AccountBundle = {
  id: string;
  accountDisplayName: string;
  marketplaces: MpRow[];
};

export default function EbayPolicyMappingPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get('organizationId') ?? '';
  const { user } = useAuth();
  const userId = user?.id;

  const [account, setAccount] = useState<AccountBundle | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [draft, setDraft] = useState<
    Record<
      string,
      {
        payment: string;
        ret: string;
        fulfillment: string;
        location: string;
      }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) h['x-user-id'] = userId;
    return h;
  }, [userId]);

  const load = useCallback(async () => {
    if (!accountId || !organizationId || !userId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/integrations/ebay/accounts/${accountId}/policies?organizationId=${encodeURIComponent(organizationId)}`,
        { headers },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Failed to load');
      setAccount(data.account as AccountBundle);
      setPolicies(data.policies as PolicyRow[]);
      const next: typeof draft = {};
      for (const m of (data.account as AccountBundle).marketplaces ?? []) {
        next[m.marketplaceId] = {
          payment: m.defaultPaymentPolicyId ?? '',
          ret: m.defaultReturnPolicyId ?? '',
          fulfillment: m.defaultFulfillmentPolicyId ?? '',
          location: m.defaultInventoryLocationKey ?? '',
        };
      }
      setDraft(next);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [accountId, organizationId, userId, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const optionsFor = (marketplaceId: string, type: string) =>
    policies.filter((p) => p.marketplaceId === marketplaceId && p.policyType === type);

  const saveMarketplace = async (marketplaceId: string) => {
    const d = draft[marketplaceId];
    if (!d || !accountId || !organizationId || !userId) return;
    setMessage(null);
    const res = await fetch(
      `/api/integrations/ebay/accounts/${accountId}/default-policies?organizationId=${encodeURIComponent(organizationId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          marketplaceId,
          defaultPaymentPolicyId: d.payment || null,
          defaultReturnPolicyId: d.ret || null,
          defaultFulfillmentPolicyId: d.fulfillment || null,
          defaultInventoryLocationKey: d.location || null,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? data.message ?? 'Save failed');
    setMessage(`Saved defaults for ${marketplaceId}`);
    setAccount(data as AccountBundle);
  };

  if (!organizationId) {
    return (
      <div className="p-6 text-slate-200">
        <p>Missing organizationId query param. Open this page from eBay stores with an org selected.</p>
        <Link to="/settings/integrations/ebay" className="text-sky-400 underline">
          Back to eBay stores
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-100">
      <div className="flex items-center gap-4">
        <Link to="/settings/integrations/ebay" className="text-sm text-sky-400 hover:underline">
          ← eBay stores
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Policy mapping</h1>
      <p className="text-slate-400 text-sm">
        Run <strong>Sync policies</strong> on the stores list first, then pick default business policies per
        marketplace. Publishing is blocked until these are set.
      </p>
      {loading && <p className="text-slate-500">Loading…</p>}
      {message && <p className="text-sm text-amber-300">{message}</p>}

      {!loading &&
        account?.marketplaces?.map((m) => (
          <section
            key={m.marketplaceId}
            className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3"
          >
            <h2 className="text-lg font-medium">{m.marketplaceId}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-400">Fulfillment policy</span>
                <select
                  className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
                  value={draft[m.marketplaceId]?.fulfillment ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [m.marketplaceId]: {
                        ...prev[m.marketplaceId]!,
                        fulfillment: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">—</option>
                  {optionsFor(m.marketplaceId, 'fulfillment').map((p) => (
                    <option key={p.id} value={p.ebayPolicyId}>
                      {p.name} ({p.ebayPolicyId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Payment policy</span>
                <select
                  className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
                  value={draft[m.marketplaceId]?.payment ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [m.marketplaceId]: {
                        ...prev[m.marketplaceId]!,
                        payment: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">—</option>
                  {optionsFor(m.marketplaceId, 'payment').map((p) => (
                    <option key={p.id} value={p.ebayPolicyId}>
                      {p.name} ({p.ebayPolicyId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Return policy</span>
                <select
                  className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
                  value={draft[m.marketplaceId]?.ret ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [m.marketplaceId]: {
                        ...prev[m.marketplaceId]!,
                        ret: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">—</option>
                  {optionsFor(m.marketplaceId, 'return').map((p) => (
                    <option key={p.id} value={p.ebayPolicyId}>
                      {p.name} ({p.ebayPolicyId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Merchant location key</span>
                <input
                  className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
                  value={draft[m.marketplaceId]?.location ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [m.marketplaceId]: {
                        ...prev[m.marketplaceId]!,
                        location: e.target.value,
                      },
                    }))
                  }
                  placeholder="From inventory sync (e.g. default)"
                />
              </label>
            </div>
            <button
              type="button"
              className="rounded-md bg-sky-700 hover:bg-sky-600 px-3 py-2 text-sm"
              onClick={() => void saveMarketplace(m.marketplaceId).catch((e) => setMessage(String(e)))}
            >
              Save defaults for {m.marketplaceId}
            </button>
          </section>
        ))}
    </div>
  );
}
