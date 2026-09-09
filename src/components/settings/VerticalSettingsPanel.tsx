import { useCallback, useEffect, useState } from 'react';
import {
  listVerticalStores,
  updateVerticalStoreConfig,
  type ProductVertical,
  type VerticalConfig,
  type VerticalStore,
} from '../../lib/verticalsApi';

const PILOT_VERTICALS: Array<{ id: ProductVertical; label: string; description: string }> = [
  {
    id: 'business_industrial',
    label: 'Business & Industrial',
    description: 'Manufacturer/model, specifications, condition and accessories.',
  },
  {
    id: 'fashion',
    label: 'Fashion',
    description: 'Brand, department, size, color, material and measurements.',
  },
];

export default function VerticalSettingsPanel({ organizationId }: { organizationId: string | null }) {
  const [stores, setStores] = useState<VerticalStore[]>([]);
  const [storeId, setStoreId] = useState('');
  const [config, setConfig] = useState<VerticalConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await listVerticalStores(organizationId);
      setStores(result);
      const selected = result.find((store) => store.id === storeId) ?? result[0];
      setStoreId(selected?.id ?? '');
      setConfig(selected?.verticalConfig ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load vertical settings');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectStore = (id: string) => {
    setStoreId(id);
    setConfig(stores.find((store) => store.id === id)?.verticalConfig ?? null);
    setMessage(null);
  };

  const toggle = (vertical: ProductVertical) => {
    if (!config) return;
    const enabled = config.enabledVerticals.includes(vertical);
    const enabledVerticals = enabled
      ? config.enabledVerticals.filter((value) => value !== vertical)
      : [...config.enabledVerticals, vertical];
    setConfig({
      ...config,
      enabledVerticals,
      defaultVertical: enabled && config.defaultVertical === vertical ? 'automotive' : config.defaultVertical,
    });
  };

  const save = async () => {
    if (!organizationId || !storeId || !config) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateVerticalStoreConfig(storeId, organizationId, config);
      setConfig(saved);
      setStores((current) => current.map((store) => (store.id === storeId ? { ...store, verticalConfig: saved } : store)));
      setMessage('Vertical settings saved. New uploads use the selected vertical explicitly.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save vertical settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-medium">Product vertical pilots</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Automotive remains the legacy default. Enable a pilot vertical per store before importing or publishing it.
        </p>
      </div>
      {!organizationId && <p className="text-sm text-amber-300">Select a workspace to configure verticals.</p>}
      {organizationId && loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading store settings…</p>}
      {organizationId && !loading && stores.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Connect an eBay store before enabling a pilot vertical.</p>
      )}
      {config && stores.length > 0 && (
        <>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Store</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2"
              value={storeId}
              onChange={(event) => selectStore(event.target.value)}
            >
              {stores.map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}
            </select>
          </label>
          <div className="space-y-3">
            {PILOT_VERTICALS.map((vertical) => (
              <label key={vertical.id} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={config.enabledVerticals.includes(vertical.id)}
                  onChange={() => toggle(vertical.id)}
                />
                <span>
                  <span className="block text-sm font-medium">{vertical.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{vertical.description}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Default new-workflow vertical</span>
            <select
              className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2"
              value={config.defaultVertical}
              onChange={(event) => setConfig({ ...config, defaultVertical: event.target.value as ProductVertical })}
            >
              {(['automotive', ...PILOT_VERTICALS.map((vertical) => vertical.id)] as ProductVertical[])
                .filter((vertical) => config.enabledVerticals.includes(vertical))
                .map((vertical) => <option key={vertical} value={vertical}>{vertical.replace('_', ' ')}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save vertical settings'}
            </button>
            {message && <span className="text-sm text-slate-500 dark:text-slate-300">{message}</span>}
          </div>
        </>
      )}
      {message && !config && <p className="text-sm text-amber-300">{message}</p>}
    </section>
  );
}
