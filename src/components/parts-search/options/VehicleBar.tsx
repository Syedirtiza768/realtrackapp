/* ─── Vehicle bar ──────────────────────────────────────────
 *  Shows the vehicle verdicts are judged against and lets
 *  staff set it: Make → Model → Year → (Engine), or a VIN.
 *  The vehicle can also come from the query text
 *  ("left headlight 2018 Audi Q5").
 * ────────────────────────────────────────────────────────── */

import { Car, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  decodeVin,
  readLastVehicle,
  vehicleApi,
  type OptionsResponse,
  type VehicleOption,
  type VehicleSelection,
} from '../../../lib/partsSearchOptionsApi';

type Props = {
  resolved: OptionsResponse['vehicle'];
  selection?: VehicleSelection;
  onChange: (vehicle: VehicleSelection | undefined) => void;
  /** Vehicle parsed from the query: removing it drops the year from interpretation. */
  onClearQueryVehicle: () => void;
};

const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function yearsOf(generations: VehicleOption[]): number[] {
  const now = new Date().getFullYear() + 1;
  const years = new Set<number>();
  for (const g of generations) {
    const start = g.startYear ?? null;
    const end = g.endYear ?? now;
    if (!start) continue;
    for (let y = start; y <= Math.min(end, now); y++) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

function configLabel(c: VehicleOption): string {
  return [c.engine, c.trim, c.market && c.market !== 'GLOBAL' ? c.market : null].filter(Boolean).join(' · ') || 'Unspecified engine';
}

export default function VehicleBar({ resolved, selection, onChange, onClearQueryVehicle }: Props) {
  const [open, setOpen] = useState(false);
  const [makes, setMakes] = useState<VehicleOption[]>([]);
  const [models, setModels] = useState<VehicleOption[]>([]);
  const [generations, setGenerations] = useState<VehicleOption[]>([]);
  const [configs, setConfigs] = useState<VehicleOption[]>([]);
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [year, setYear] = useState('');
  const [configId, setConfigId] = useState('');
  const [vin, setVin] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useMemo(() => readLastVehicle(), [open]);

  useEffect(() => {
    if (!open || makes.length) return;
    setBusy('makes');
    vehicleApi
      .makes()
      .then((list) => setMakes([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  }, [open, makes.length]);

  useEffect(() => {
    setModels([]);
    setModelId('');
    if (!makeId) return;
    setBusy('models');
    vehicleApi
      .models(makeId)
      .then((list) => setModels([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  }, [makeId]);

  useEffect(() => {
    setGenerations([]);
    setYear('');
    if (!modelId) return;
    setBusy('years');
    vehicleApi
      .generations(modelId)
      .then(setGenerations)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  }, [modelId]);

  useEffect(() => {
    setConfigs([]);
    setConfigId('');
    const y = Number(year);
    if (!y) return;
    const covering = generations.filter((g) => (g.startYear ?? 0) <= y && (g.endYear ?? 9999) >= y);
    if (!covering.length) return;
    setBusy('engines');
    Promise.all(covering.map((g) => vehicleApi.configurations(g.id).catch(() => [] as VehicleOption[])))
      .then((lists) => {
        const seen = new Set<string>();
        setConfigs(
          lists.flat().filter((c) => {
            const key = configLabel(c);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
      })
      .finally(() => setBusy(null));
  }, [year, generations]);

  const apply = () => {
    const make = makes.find((m) => m.id === makeId);
    const model = models.find((m) => m.id === modelId);
    const config = configs.find((c) => c.id === configId);
    if (!make || !model || !year) return;
    onChange({
      makeId,
      modelId,
      year: Number(year),
      vehicleConfigId: config?.id,
      label: `${year} ${make.name} ${model.name}${config ? ` · ${configLabel(config)}` : ''}`,
    });
    setOpen(false);
  };

  const applyVin = async () => {
    setError(null);
    setBusy('vin');
    try {
      const decoded = await decodeVin(vin);
      if (!decoded.decoded || !decoded.year || !decoded.make || !decoded.model) {
        setError(decoded.message || 'This VIN could not be decoded to a year, make and model.');
        return;
      }
      onChange({
        make: decoded.make,
        model: decoded.model,
        year: decoded.year,
        engineLitres: decoded.engineLitres ?? undefined,
        vin: decoded.vin,
        label: `${decoded.year} ${decoded.make} ${decoded.model}${decoded.engineLitres ? ` ${decoded.engineLitres.toFixed(1)} L` : ''} (VIN …${decoded.vin.slice(-6)})`,
      });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const label = resolved?.label ?? selection?.label ?? null;
  const fromQuery = resolved?.source === 'query';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Car size={16} className="text-slate-400" aria-hidden="true" />
        {label ? (
          <>
            <span className="font-medium text-slate-800 dark:text-slate-100">{label}</span>
            {resolved?.engineLitres && !label.includes('L') && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{resolved.engineLitres.toFixed(1)} L</span>
            )}
            {fromQuery && <span className="text-xs text-slate-500 dark:text-slate-400">(from your search)</span>}
            {resolved && !resolved.configCount && (
              <span className="text-xs text-amber-700 dark:text-amber-400">not in our vehicle list — verdicts use compatibility lists only</span>
            )}
            {resolved && !resolved.engineLitres && !resolved.exactConfigId && resolved.engines.length > 1 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">engine not selected ({resolved.engines.map((e) => e.toFixed(1)).join(' / ')} L)</span>
            )}
            <button
              type="button"
              onClick={() => (fromQuery ? onClearQueryVehicle() : onChange(undefined))}
              className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Clear vehicle"
              title="Clear vehicle"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">No vehicle — fitment is not checked</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {label ? 'Change vehicle' : 'Choose vehicle / VIN'}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Make
              <select className={selectClass} value={makeId} onChange={(e) => setMakeId(e.target.value)} disabled={!makes.length}>
                <option value="">{busy === 'makes' ? 'Loading…' : 'Select make'}</option>
                {makes.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Model
              <select className={selectClass} value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!models.length}>
                <option value="">{busy === 'models' ? 'Loading…' : 'Select model'}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Year
              <select className={selectClass} value={year} onChange={(e) => setYear(e.target.value)} disabled={!generations.length}>
                <option value="">{busy === 'years' ? 'Loading…' : 'Select year'}</option>
                {yearsOf(generations).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Engine (optional)
              <select className={selectClass} value={configId} onChange={(e) => setConfigId(e.target.value)} disabled={!configs.length}>
                <option value="">{busy === 'engines' ? 'Loading…' : 'Any engine'}</option>
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>{configLabel(c)}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 sm:col-span-4">
              <button
                type="button"
                onClick={apply}
                disabled={!makeId || !modelId || !year}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
              >
                Use this vehicle
              </button>
              {last && (
                <button type="button" onClick={() => { onChange(last); setOpen(false); }} className="text-xs font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
                  Use last: {last.label}
                </button>
              )}
            </div>
          </div>
          <div className="border-slate-100 dark:border-slate-800 lg:border-l lg:pl-3">
            <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="parts-search-vin">VIN</label>
            <div className="flex gap-2">
              <input
                id="parts-search-vin"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength={17}
                placeholder="17 characters"
                className="w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void applyVin()}
                disabled={vin.trim().length !== 17 || busy === 'vin'}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              >
                {busy === 'vin' && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                Decode
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400 lg:col-span-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
