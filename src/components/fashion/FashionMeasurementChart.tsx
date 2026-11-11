import { useEffect, useState } from 'react';
import { Loader2, Ruler } from 'lucide-react';
import {
  createFashionSizeChart,
  fashionDiagramDataUrl,
  fashionError,
  getFashionMeasurementTemplates,
  type FashionMeasurementTemplate,
  type FashionMeasurementUnit,
} from '../../lib/fashionListingsApi';
import type { FashionFamily } from '../../lib/fashionFields';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800';

let cachedTemplates: FashionMeasurementTemplate[] | null = null;

/** Measurement templates are static per release; fetched once per page load. */
export function useFashionMeasurementTemplates(organizationId?: string | null) {
  const [templates, setTemplates] = useState<FashionMeasurementTemplate[]>(cachedTemplates ?? []);
  const [error, setError] = useState('');
  useEffect(() => {
    if (cachedTemplates) return;
    const controller = new AbortController();
    getFashionMeasurementTemplates(controller.signal, organizationId)
      .then((items) => { cachedTemplates = items; setTemplates(items); })
      .catch((err) => { if (!controller.signal.aborted) setError(fashionError(err)); });
    return () => controller.abort();
  }, [organizationId]);
  return { templates, error };
}

/** Accepts hand-measured values such as 19, 19.5 or 19,5. */
export function isFashionMeasurementValue(value: string | undefined) {
  const text = (value ?? '').trim().replace(',', '.');
  return /^\d{1,4}(\.\d{1,2})?$/.test(text) && Number(text) > 0;
}

export type FashionMeasurementState = {
  templateId: string;
  unit: FashionMeasurementUnit;
  values: Record<string, string>;
};

type Props = {
  templates: FashionMeasurementTemplate[];
  family: FashionFamily;
  state: FashionMeasurementState;
  onChange: (state: FashionMeasurementState) => void;
  editable: boolean;
  organizationId?: string | null;
  /** Shown in the size-chart header, usually the eBay store name. */
  brandName?: string;
  sku?: string;
  /** Called with the stored size-chart image URL after it is created. */
  onChartImage?: (url: string) => void;
  hasChartImage?: boolean;
  /** Mark missing values as required (quick capture). */
  requireAll?: boolean;
};

/**
 * Garment-specific measurement chart (A, B, C…) with its schematic diagram, a cm/in
 * toggle and an optional branded size-chart image. Values are entered by hand; they are
 * never estimated from photos. Switching units does not convert entered numbers.
 */
export default function FashionMeasurementChart({ templates, family, state, onChange, editable, organizationId, brandName, sku, onChartImage, hasChartImage, requireAll }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const available = templates.filter((template) => template.family === family);
  const template = templates.find((item) => item.id === state.templateId);
  const filled = template ? template.points.filter((point) => isFashionMeasurementValue(state.values[point.key])) : [];

  async function createChart() {
    if (!template || !onChartImage) return;
    setBusy(true); setError('');
    try {
      const values: Record<string, string> = {};
      for (const point of template.points) {
        const value = state.values[point.key]?.trim();
        if (value) values[point.key] = value.replace(',', '.');
      }
      const result = await createFashionSizeChart({ template: template.id, unit: state.unit, values, brandName: brandName?.trim() || undefined, sku: sku?.trim() || undefined }, organizationId);
      onChartImage(result.url);
    } catch (err) {
      setError(fashionError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm">Measurement chart
          <select className={`mt-1 ${input}`} disabled={!editable} value={state.templateId} onChange={(event) => onChange({ ...state, templateId: event.target.value })}>
            <option value="">Choose a chart</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Measurement unit" className="inline-flex w-fit overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
          {(['cm', 'in'] as const).map((unit) => (
            <button key={unit} type="button" disabled={!editable} aria-pressed={state.unit === unit} onClick={() => onChange({ ...state, unit })} className={`min-h-10 min-w-14 px-4 text-sm font-semibold ${state.unit === unit ? 'bg-pink-600 text-white' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{unit.toUpperCase()}</button>
          ))}
        </div>
      </div>
      {!available.length && templates.length > 0 && <p className="text-sm text-slate-500">No measurement charts for this category family.</p>}
      {template && (
        <div className="grid gap-4 md:grid-cols-2">
          <img src={fashionDiagramDataUrl(template.diagramSvg)} alt={`${template.label} measurement guide with points ${template.points.map((point) => point.letter).join(', ')}`} className="mx-auto w-full max-w-sm rounded-lg bg-white p-2 ring-1 ring-slate-200 dark:ring-slate-700" />
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="pb-2 font-medium">Measurement</th><th className="pb-2 font-medium">Value ({state.unit === 'in' ? 'inch' : 'cm'})</th></tr></thead>
            <tbody>
              {template.points.map((point) => {
                const value = state.values[point.key] ?? '';
                const invalid = value.trim() !== '' && !isFashionMeasurementValue(value);
                const missing = requireAll && !value.trim();
                return (
                  <tr key={point.key} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3"><label htmlFor={`fm-${point.key}`}><span className="font-bold text-orange-700 dark:text-orange-400">{point.letter}</span> {point.label}{requireAll ? <span className="text-pink-600"> *</span> : null}</label></td>
                    <td className="py-2">
                      <input id={`fm-${point.key}`} className={`${input} ${invalid || missing ? 'border-red-400' : ''}`} inputMode="decimal" autoComplete="off" disabled={!editable} value={value} aria-invalid={invalid || undefined} onChange={(event) => onChange({ ...state, values: { ...state.values, [point.key]: event.target.value } })} />
                      {invalid && <span className="text-xs text-red-600">Enter a number, for example 19.5</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {template && onChartImage && editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || !filled.length} onClick={() => void createChart()} className="inline-flex items-center gap-2 rounded-lg border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 disabled:opacity-40 dark:border-pink-800 dark:text-pink-300">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Ruler size={16} />} {hasChartImage ? 'Recreate size-chart image' : 'Create size-chart image'}
          </button>
          <span className="text-xs text-slate-500">Adds a branded chart{brandName ? ` for ${brandName}` : ''} to the Size chart photo slot.</span>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
