import { useCallback, useEffect, useState } from 'react';
import {
  getEbayAccountPolicies,
  patchEbayDefaultPolicies,
} from '../../lib/ebayIntegrationsApi';
import {
  type AccountPolicyBundle,
  type PolicyDraft,
  type PolicyRow,
  draftFromMarketplace,
} from './ebayPolicyEditor.types';

type Props = {
  accountId: string;
  organizationId?: string;
  canEdit?: boolean;
  onSaved?: () => void;
};

export default function EbayAccountPolicyEditor({
  accountId,
  organizationId,
  canEdit = true,
  onSaved,
}: Props) {
  const [account, setAccount] = useState<AccountPolicyBundle | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [draft, setDraft] = useState<Record<string, PolicyDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingMarketplace, setSavingMarketplace] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getEbayAccountPolicies(accountId, organizationId);
      const bundle = data.account as AccountPolicyBundle;
      setAccount(bundle);
      setPolicies(data.policies as PolicyRow[]);
      const next: Record<string, PolicyDraft> = {};
      for (const m of bundle.marketplaces ?? []) {
        next[m.marketplaceId] = draftFromMarketplace(m);
      }
      setDraft(next);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [accountId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const optionsFor = (marketplaceId: string, type: string) =>
    policies.filter((p) => p.marketplaceId === marketplaceId && p.policyType === type);

  const saveMarketplace = async (marketplaceId: string) => {
    const d = draft[marketplaceId];
    if (!d || !canEdit) return;
    setSavingMarketplace(marketplaceId);
    setMessage(null);
    try {
      const updated = await patchEbayDefaultPolicies(accountId, organizationId, {
        marketplaceId,
        defaultPaymentPolicyId: d.payment || null,
        defaultReturnPolicyId: d.ret || null,
        defaultFulfillmentPolicyId: d.fulfillment || null,
        defaultInventoryLocationKey: d.location || null,
      });
      setMessage(`Saved defaults for ${marketplaceId}`);
      setAccount(updated as AccountPolicyBundle);
      onSaved?.();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingMarketplace(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading policies…</p>;
  }

  if (!account?.marketplaces?.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No marketplaces enabled for this store. Sync policies from eBay first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-sm text-amber-300">{message}</p>}
      {account.marketplaces.map((m) => (
        <section
          key={m.marketplaceId}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.marketplaceId}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <PolicySelect
              label="Fulfillment policy"
              value={draft[m.marketplaceId]?.fulfillment ?? ''}
              disabled={!canEdit}
              options={optionsFor(m.marketplaceId, 'fulfillment')}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  [m.marketplaceId]: { ...prev[m.marketplaceId]!, fulfillment: value },
                }))
              }
            />
            <PolicySelect
              label="Payment policy"
              value={draft[m.marketplaceId]?.payment ?? ''}
              disabled={!canEdit}
              options={optionsFor(m.marketplaceId, 'payment')}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  [m.marketplaceId]: { ...prev[m.marketplaceId]!, payment: value },
                }))
              }
            />
            <PolicySelect
              label="Return policy"
              value={draft[m.marketplaceId]?.ret ?? ''}
              disabled={!canEdit}
              options={optionsFor(m.marketplaceId, 'return')}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  [m.marketplaceId]: { ...prev[m.marketplaceId]!, ret: value },
                }))
              }
            />
            <label className="block text-sm">
              <span className="text-slate-500 dark:text-slate-400">Merchant location key</span>
              <input
                className="mt-1 w-full rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-2 py-2 text-sm disabled:opacity-60"
                value={draft[m.marketplaceId]?.location ?? ''}
                disabled={!canEdit}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [m.marketplaceId]: { ...prev[m.marketplaceId]!, location: e.target.value },
                  }))
                }
                placeholder="From inventory sync (e.g. default)"
              />
            </label>
          </div>
          {canEdit && (
            <button
              type="button"
              className="rounded-md bg-sky-700 hover:bg-sky-600 disabled:opacity-50 px-3 py-2 text-sm text-white"
              disabled={savingMarketplace === m.marketplaceId}
              onClick={() => void saveMarketplace(m.marketplaceId)}
            >
              {savingMarketplace === m.marketplaceId
                ? 'Saving…'
                : `Save defaults for ${m.marketplaceId}`}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

function PolicySelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: PolicyRow[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <select
        className="mt-1 w-full rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-2 py-2 text-sm disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((p) => (
          <option key={p.id} value={p.ebayPolicyId}>
            {p.name} ({p.ebayPolicyId})
          </option>
        ))}
      </select>
    </label>
  );
}
