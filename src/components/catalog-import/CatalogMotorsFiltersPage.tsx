import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { fetchCatalogProducts } from '../../lib/catalogProductsApi';
import type { CatalogMotorsListQuery, CatalogProductRowDto } from '../../types/catalogMotorsFilters';

const PAGE_SIZE = 40;

type Readiness = '' | 'ready' | 'needs_review' | 'all';

interface FormState {
  search: string;
  importId: string;
  sku: string;
  readinessStatus: Readiness;
  missingImages: boolean;
  missingOem: boolean;
  missingFitment: boolean;
  hasFitment: boolean;
  missingDescription: boolean;
  singleQty: boolean;
  multiQty: boolean;
  inStock: boolean;
  priceMin: string;
  priceMax: string;
  priceBand: string;
  fitmentMake: string;
  fitmentModel: string;
  yearMin: string;
  yearMax: string;
  fitmentCountMin: string;
  fitmentCountMax: string;
  multiMake: boolean;
  singleMake: boolean;
  brands: string;
  partTypes: string;
  categoryIds: string;
  conditionIds: string;
  shippingProfile: string;
  returnProfile: string;
  paymentProfile: string;
  location: string;
  fixedPrice: boolean;
  gtcDuration: boolean;
  duplicateFitment: boolean;
  titleLenMin: string;
  titleLenMax: string;
  imageCountMin: string;
  missingPlacementWhenRequired: boolean;
}

const emptyForm = (): FormState => ({
  search: '',
  importId: '',
  sku: '',
  readinessStatus: '',
  missingImages: false,
  missingOem: false,
  missingFitment: false,
  hasFitment: false,
  missingDescription: false,
  singleQty: false,
  multiQty: false,
  inStock: false,
  priceMin: '',
  priceMax: '',
  priceBand: '',
  fitmentMake: '',
  fitmentModel: '',
  yearMin: '',
  yearMax: '',
  fitmentCountMin: '',
  fitmentCountMax: '',
  multiMake: false,
  singleMake: false,
  brands: '',
  partTypes: '',
  categoryIds: '',
  conditionIds: '',
  shippingProfile: '',
  returnProfile: '',
  paymentProfile: '',
  location: '',
  fixedPrice: false,
  gtcDuration: false,
  duplicateFitment: false,
  titleLenMin: '',
  titleLenMax: '',
  imageCountMin: '',
  missingPlacementWhenRequired: false,
});

function formToQuery(form: FormState, page: number): CatalogMotorsListQuery {
  const q: CatalogMotorsListQuery = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    includeDerived: true,
  };
  if (form.search.trim()) q.search = form.search.trim();
  if (form.importId.trim()) q.importId = form.importId.trim();
  if (form.sku.trim()) q.sku = form.sku.trim();
  if (form.readinessStatus && form.readinessStatus !== 'all') {
    q.readinessStatus = form.readinessStatus;
  }
  if (form.missingImages) q.missingImages = true;
  if (form.missingOem) q.missingOem = true;
  if (form.missingFitment) q.missingFitment = true;
  if (form.hasFitment) q.hasFitment = true;
  if (form.missingDescription) q.missingDescription = true;
  if (form.singleQty) q.singleQty = true;
  if (form.multiQty) q.multiQty = true;
  if (form.inStock) q.inStock = true;
  if (form.priceMin) q.priceMin = parseFloat(form.priceMin);
  if (form.priceMax) q.priceMax = parseFloat(form.priceMax);
  if (form.priceBand) q.priceBands = form.priceBand;
  if (form.fitmentMake.trim()) q.fitmentMake = form.fitmentMake.trim();
  if (form.fitmentModel.trim()) q.fitmentModel = form.fitmentModel.trim();
  if (form.yearMin) q.yearMin = parseInt(form.yearMin, 10);
  if (form.yearMax) q.yearMax = parseInt(form.yearMax, 10);
  if (form.fitmentCountMin) q.fitmentCountMin = parseInt(form.fitmentCountMin, 10);
  if (form.fitmentCountMax) q.fitmentCountMax = parseInt(form.fitmentCountMax, 10);
  if (form.multiMake) q.multiMake = true;
  if (form.singleMake) q.singleMake = true;
  if (form.brands.trim()) q.brands = form.brands.trim();
  if (form.partTypes.trim()) q.partTypes = form.partTypes.trim();
  if (form.categoryIds.trim()) q.categoryIds = form.categoryIds.trim();
  if (form.conditionIds.trim()) q.conditionIds = form.conditionIds.trim();
  if (form.shippingProfile.trim()) q.shippingProfile = form.shippingProfile.trim();
  if (form.returnProfile.trim()) q.returnProfile = form.returnProfile.trim();
  if (form.paymentProfile.trim()) q.paymentProfile = form.paymentProfile.trim();
  if (form.location.trim()) q.location = form.location.trim();
  if (form.fixedPrice) q.fixedPrice = true;
  if (form.gtcDuration) q.gtcDuration = true;
  if (form.duplicateFitment) q.duplicateFitment = true;
  if (form.titleLenMin) q.titleLenMin = parseInt(form.titleLenMin, 10);
  if (form.titleLenMax) q.titleLenMax = parseInt(form.titleLenMax, 10);
  if (form.imageCountMin) q.imageCountMin = parseInt(form.imageCountMin, 10);
  if (form.missingPlacementWhenRequired) q.missingPlacementWhenRequired = true;
  return q;
}

function ReadinessBadge({ row }: { row: CatalogProductRowDto }) {
  const d = row.derived;
  if (!d) return null;
  if (d.readiness_status === 'ready') {
    return <Badge variant="success">Ready</Badge>;
  }
  return <Badge variant="warning">Review</Badge>;
}

function FilterDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-white/40 dark:bg-slate-900/40">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-100/60 dark:bg-slate-800/60 rounded-lg">
        {title}
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-800">{children}</div>
    </details>
  );
}

function LabeledCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300 cursor-pointer">
      <input
        type="checkbox"
        className="rounded border-slate-300 dark:border-slate-600 bg-slate-900"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export default function CatalogMotorsFiltersPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [appliedForm, setAppliedForm] = useState<FormState | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CatalogProductRowDto[]>([]);
  const [total, setTotal] = useState(0);

  const query = useMemo(
    () => (appliedForm ? formToQuery(appliedForm, page) : null),
    [appliedForm, page],
  );

  const load = useCallback(async (q: CatalogMotorsListQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCatalogProducts(q);
      setRows(res.products);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query) return;
    void load(query);
  }, [query, load]);

  const apply = useCallback(() => {
    setAppliedForm({ ...form });
    setPage(0);
  }, [form]);

  const reset = useCallback(() => {
    setForm(emptyForm());
    setAppliedForm(null);
    setPage(0);
    setRows([]);
    setTotal(0);
    setError(null);
  }, []);

  const refresh = useCallback(() => {
    if (!appliedForm) return;
    void load(formToQuery(appliedForm, page));
  }, [appliedForm, page, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 lg:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-400 mb-1">
              <Link to="/catalog/import" className="hover:text-blue-400">
                CSV Import
              </Link>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-200">Motors ops filters</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="w-7 h-7 text-blue-500" />
              eBay Motors — catalog listing filters
            </h1>
            <p className="text-slate-400 dark:text-slate-400 text-sm mt-1 max-w-3xl">
              Internal filters for imported CSV catalog data only (no margin or sales metrics).
              Readiness and routing fields are derived from your template columns and fitment JSON.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={!appliedForm || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-sm border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={apply}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              <Filter className="w-4 h-4" />
              Apply filters
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-sm border border-slate-300 dark:border-slate-600"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-3">
            <Card className="border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Search & scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <input
                  className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  placeholder="Search title / SKU / brand / MPN / OEM"
                  value={form.search}
                  onChange={(e) => setForm((f) => ({ ...f, search: e.target.value }))}
                />
                <input
                  className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
                  placeholder="Import ID (UUID)"
                  value={form.importId}
                  onChange={(e) => setForm((f) => ({ ...f, importId: e.target.value }))}
                />
                <input
                  className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  placeholder="SKU contains"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </CardContent>
            </Card>

            <FilterDetails title="1. Listing readiness">
              <label className="block text-xs text-slate-400 dark:text-slate-400 mb-1">Readiness</label>
              <select
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                value={form.readinessStatus}
                onChange={(e) =>
                  setForm((f) => ({ ...f, readinessStatus: e.target.value as Readiness }))
                }
              >
                <option value="">Any</option>
                <option value="ready">Ready to publish</option>
                <option value="needs_review">Needs review</option>
                <option value="all">All (explicit)</option>
              </select>
              <LabeledCheck
                label="Missing images"
                checked={form.missingImages}
                onChange={(v) => setForm((f) => ({ ...f, missingImages: v }))}
              />
              <LabeledCheck
                label="Missing OEM number"
                checked={form.missingOem}
                onChange={(v) => setForm((f) => ({ ...f, missingOem: v }))}
              />
              <LabeledCheck
                label="Missing fitment"
                checked={form.missingFitment}
                onChange={(v) => setForm((f) => ({ ...f, missingFitment: v }))}
              />
              <LabeledCheck
                label="Has fitment"
                checked={form.hasFitment}
                onChange={(v) => setForm((f) => ({ ...f, hasFitment: v }))}
              />
              <LabeledCheck
                label="Missing description"
                checked={form.missingDescription}
                onChange={(v) => setForm((f) => ({ ...f, missingDescription: v }))}
              />
              <LabeledCheck
                label="Placement missing (heuristic part types)"
                checked={form.missingPlacementWhenRequired}
                onChange={(v) => setForm((f) => ({ ...f, missingPlacementWhenRequired: v }))}
              />
            </FilterDetails>

            <FilterDetails title="2. Inventory">
              <LabeledCheck
                label="Single quantity (qty = 1)"
                checked={form.singleQty}
                onChange={(v) => setForm((f) => ({ ...f, singleQty: v }))}
              />
              <LabeledCheck
                label="Multi quantity"
                checked={form.multiQty}
                onChange={(v) => setForm((f) => ({ ...f, multiQty: v }))}
              />
              <LabeledCheck
                label="In stock (qty ≥ 1)"
                checked={form.inStock}
                onChange={(v) => setForm((f) => ({ ...f, inStock: v }))}
              />
            </FilterDetails>

            <FilterDetails title="3. Category & brand">
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Category IDs (comma-separated)"
                value={form.categoryIds}
                onChange={(e) => setForm((f) => ({ ...f, categoryIds: e.target.value }))}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Super-categories use server config when category IDs are filled in.
              </p>
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Brands (comma, partial match)"
                value={form.brands}
                onChange={(e) => setForm((f) => ({ ...f, brands: e.target.value }))}
              />
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Part types (comma, partial)"
                value={form.partTypes}
                onChange={(e) => setForm((f) => ({ ...f, partTypes: e.target.value }))}
              />
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Condition IDs (comma)"
                value={form.conditionIds}
                onChange={(e) => setForm((f) => ({ ...f, conditionIds: e.target.value }))}
              />
            </FilterDetails>

            <FilterDetails title="4. Vehicle compatibility">
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Make contains"
                value={form.fitmentMake}
                onChange={(e) => setForm((f) => ({ ...f, fitmentMake: e.target.value }))}
              />
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Model contains"
                value={form.fitmentModel}
                onChange={(e) => setForm((f) => ({ ...f, fitmentModel: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Year min"
                  value={form.yearMin}
                  onChange={(e) => setForm((f) => ({ ...f, yearMin: e.target.value }))}
                />
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Year max"
                  value={form.yearMax}
                  onChange={(e) => setForm((f) => ({ ...f, yearMax: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Fitment count min"
                  value={form.fitmentCountMin}
                  onChange={(e) => setForm((f) => ({ ...f, fitmentCountMin: e.target.value }))}
                />
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Fitment count max"
                  value={form.fitmentCountMax}
                  onChange={(e) => setForm((f) => ({ ...f, fitmentCountMax: e.target.value }))}
                />
              </div>
              <LabeledCheck
                label="Multi-make compatible"
                checked={form.multiMake}
                onChange={(v) => setForm((f) => ({ ...f, multiMake: v }))}
              />
              <LabeledCheck
                label="Single-make only"
                checked={form.singleMake}
                onChange={(v) => setForm((f) => ({ ...f, singleMake: v }))}
              />
              <LabeledCheck
                label="Duplicate fitment rows (same Y/M/M)"
                checked={form.duplicateFitment}
                onChange={(v) => setForm((f) => ({ ...f, duplicateFitment: v }))}
              />
            </FilterDetails>

            <FilterDetails title="5. Price & images">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Price min"
                  value={form.priceMin}
                  onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))}
                />
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Price max"
                  value={form.priceMax}
                  onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
                />
              </div>
              <label className="block text-xs text-slate-400 dark:text-slate-400 mb-1">Price band</label>
              <select
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                value={form.priceBand}
                onChange={(e) => setForm((f) => ({ ...f, priceBand: e.target.value }))}
              >
                <option value="">Any</option>
                <option value="under_100">Under $100</option>
                <option value="100_199">$100–$199</option>
                <option value="200_499">$200–$499</option>
                <option value="500_999">$500–$999</option>
                <option value="1000_plus">$1000+</option>
              </select>
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Min image count"
                value={form.imageCountMin}
                onChange={(e) => setForm((f) => ({ ...f, imageCountMin: e.target.value }))}
              />
            </FilterDetails>

            <FilterDetails title="6. Policies & format">
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Shipping profile contains"
                value={form.shippingProfile}
                onChange={(e) => setForm((f) => ({ ...f, shippingProfile: e.target.value }))}
              />
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Return profile contains"
                value={form.returnProfile}
                onChange={(e) => setForm((f) => ({ ...f, returnProfile: e.target.value }))}
              />
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Payment profile contains"
                value={form.paymentProfile}
                onChange={(e) => setForm((f) => ({ ...f, paymentProfile: e.target.value }))}
              />
              <input
                className="w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                placeholder="Location contains"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
              <LabeledCheck
                label="Fixed price format"
                checked={form.fixedPrice}
                onChange={(v) => setForm((f) => ({ ...f, fixedPrice: v }))}
              />
              <LabeledCheck
                label="GTC duration"
                checked={form.gtcDuration}
                onChange={(v) => setForm((f) => ({ ...f, gtcDuration: v }))}
              />
            </FilterDetails>

            <FilterDetails title="7. Title QC">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Title len min"
                  value={form.titleLenMin}
                  onChange={(e) => setForm((f) => ({ ...f, titleLenMin: e.target.value }))}
                />
                <input
                  className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Title len max"
                  value={form.titleLenMax}
                  onChange={(e) => setForm((f) => ({ ...f, titleLenMax: e.target.value }))}
                />
              </div>
            </FilterDetails>
          </div>

          <div className="xl:col-span-8 space-y-3">
            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
            <Card className="border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  Results <span className="text-slate-400 dark:text-slate-400 font-normal">({total})</span>
                </CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    disabled={page <= 0 || loading || !appliedForm}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="p-2 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-slate-400 dark:text-slate-400">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages - 1 || loading || !appliedForm}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-400 dark:text-slate-400">
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Readiness</th>
                      <th className="px-3 py-2 font-medium">Score</th>
                      <th className="px-3 py-2 font-medium">Band</th>
                      <th className="px-3 py-2 font-medium">Fitment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!appliedForm && !loading && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                          Click Apply filters or Refresh (after first apply) to load catalog rows.
                        </td>
                      </tr>
                    )}
                    {appliedForm && rows.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                          No rows match.
                        </td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400 dark:text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100/30 dark:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono text-xs text-blue-300 whitespace-nowrap">
                          {row.sku ?? '—'}
                        </td>
                        <td className="px-3 py-2 max-w-[280px] truncate text-slate-600 dark:text-slate-200" title={row.title}>
                          {row.title}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.price != null ? `$${Number(row.price).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2">{row.quantity ?? '—'}</td>
                        <td className="px-3 py-2">
                          <ReadinessBadge row={row} />
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-300">
                          {row.derived?.data_completeness_score ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-400">{row.derived?.price_band ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-400">
                          {row.derived?.fitment_count ?? 0} / {row.derived?.unique_make_count ?? 0}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {rows[0]?.derived && (
              <Card className="border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">First row — routing & review (sample)</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500 dark:text-slate-300 space-y-2 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Store routing: </span>
                    {rows[0].derived.store_routing_recommendation}
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Manual review: </span>
                    {rows[0].derived.manual_review_reasons.join(', ') || '—'}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {rows[0].derived.marketplace_us_ready && (
                      <Badge variant="success">US ready</Badge>
                    )}
                    {rows[0].derived.marketplace_de_review && (
                      <Badge variant="warning">DE localization review</Badge>
                    )}
                    {rows[0].derived.marketplace_au_review && (
                      <Badge variant="warning">AU localization review</Badge>
                    )}
                    {rows[0].derived.marketplace_multi_candidate && (
                      <Badge variant="default">Multi-marketplace candidate</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
