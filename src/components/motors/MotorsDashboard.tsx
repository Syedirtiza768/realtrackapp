import { useState } from 'react';
import {
  Cpu,
  Eye,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Upload,
  ChevronRight,
  Search,
  Filter,
  BarChart3,
  Sparkles,
  Camera,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import {
  useMotorsProducts,
  useMotorsStats,
  useCreateMotorsProduct,
  useRunPipeline,
} from '../../lib/motorsApi';
import type { MotorsProductStatus, MotorsProduct, MotorsProductQuery } from '../../types/motors';
import { Link } from 'react-router-dom';

/* ── Status config ────────────────────────────────────────── */

type StatusInfo = { label: string; color: string; icon: typeof Cpu };

const STATUS_CONFIG: Record<MotorsProductStatus, StatusInfo> = {
  pending:            { label: 'Pending',          color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',  icon: Clock },
  extracting:         { label: 'Extracting',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',  icon: Eye },
  identifying:        { label: 'Identifying',      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', icon: Search },
  resolving_fitment:  { label: 'Fitment',          color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: Cpu },
  generating_listing: { label: 'Generating',       color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', icon: Sparkles },
  validating:         { label: 'Validating',       color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: CheckCircle },
  review_required:    { label: 'Review Required',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: AlertTriangle },
  approved:           { label: 'Approved',         color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  publishing:         { label: 'Publishing',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Loader2 },
  published:          { label: 'Published',        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  failed:             { label: 'Failed',           color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
  rejected:           { label: 'Rejected',         color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

function StatusBadge({ status }: { status: MotorsProductStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-gray-600 dark:text-gray-300">{pct}%</span>
    </div>
  );
}

/* ── Stats cards ──────────────────────────────────────────── */

function StatsCards() {
  const { data: stats, isLoading } = useMotorsStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Products', value: stats.total, icon: BarChart3, color: 'text-blue-600' },
    { label: 'Published Today', value: stats.publishedToday, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Pending Review', value: stats.reviewPending, icon: AlertTriangle, color: 'text-orange-600' },
    {
      label: 'Avg Identity',
      value: `${Math.round((stats.avgConfidence?.identity ?? 0) * 100)}%`,
      icon: Cpu,
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{c.label}</p>
              </div>
              <c.icon className={`w-8 h-8 ${c.color} opacity-60`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Product row ──────────────────────────────────────────── */

function ProductRow({ product }: { product: MotorsProduct }) {
  const runPipeline = useRunPipeline();
  const isProcessing = ['extracting', 'identifying', 'resolving_fitment', 'generating_listing', 'validating', 'publishing'].includes(product.status);

  return (
    <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-4 py-3">
        <Link to={`/motors/${product.id}`} className="flex items-center gap-3 group">
          {product.imageUrls?.[0] ? (
            <img
              src={product.imageUrls[0]}
              alt=""
              className="w-10 h-10 rounded object-cover bg-gray-100"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Upload className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
              {product.generatedTitle || product.mpn || product.brand || 'Untitled Product'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {[product.brand, product.mpn, product.productType].filter(Boolean).join(' · ') || product.sourceType}
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={product.status} />
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="space-y-1 w-32">
          <ConfidenceBar value={product.identityConfidence || 0} label="Identity" />
          <ConfidenceBar value={product.fitmentConfidence || 0} label="Fitment" />
          <ConfidenceBar value={product.complianceScore || 0} label="Comply" />
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-gray-400">
        {product.fitmentRows?.length || 0} rows
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-2 justify-end">
          {!isProcessing && product.status !== 'published' && (
            <button
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
              onClick={() => runPipeline.mutate(product.id)}
              disabled={runPipeline.isPending}
              title="Re-run pipeline"
            >
              <RefreshCw className={`w-4 h-4 ${runPipeline.isPending ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link
            to={`/motors/${product.id}`}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

/* ── Create product dialog ────────────────────────────────── */

function CreateProductForm({ onClose }: { onClose: () => void }) {
  const createProduct = useCreateMotorsProduct();
  const [form, setForm] = useState({
    sourceType: 'manual_entry' as const,
    brand: '',
    mpn: '',
    productType: '',
    condition: 'New',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct.mutateAsync(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Motors Product</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Source Type</label>
            <select
              className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value as any })}
            >
              <option value="manual_entry">Manual Entry</option>
              <option value="image_upload">Image Upload</option>
              <option value="catalog_import">Catalog Import</option>
              <option value="supplier_feed">Supplier Feed</option>
              <option value="barcode_scan">Barcode Scan</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <input
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g. Dorman"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">MPN</label>
              <input
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                value={form.mpn}
                onChange={(e) => setForm({ ...form, mpn: e.target.value })}
                placeholder="e.g. 521-001"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Product Type</label>
              <input
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                value={form.productType}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
                placeholder="e.g. Wheel Hub"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Condition</label>
              <select
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              >
                <option value="New">New</option>
                <option value="Remanufactured">Remanufactured</option>
                <option value="Used">Used</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProduct.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createProduct.isPending ? 'Creating…' : 'Create & Run Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function MotorsDashboard() {
  const [query, setQuery] = useState<MotorsProductQuery>({ page: 1, limit: 25 });
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch } = useMotorsProducts(query);

  const statusFilters: (MotorsProductStatus | '')[] = [
    '', 'pending', 'extracting', 'identifying', 'resolving_fitment',
    'generating_listing', 'validating', 'review_required', 'approved',
    'publishing', 'published', 'failed', 'rejected',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Motors Intelligence</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI-powered eBay Motors listing pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/motors/upload"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center gap-2 shadow-sm"
          >
            <Camera className="w-4 h-4" />
            AI Upload
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                value={query.status || ''}
                onChange={(e) => setQuery({ ...query, status: e.target.value as any || undefined, page: 1 })}
              >
                {statusFilters.map((s) => (
                  <option key={s} value={s}>
                    {s ? STATUS_CONFIG[s].label : 'All Statuses'}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-1.5 text-sm"
                placeholder="Search brand, MPN, title…"
                value={query.search || ''}
                onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Confidence</th>
                <th className="px-4 py-3 hidden lg:table-cell">Fitment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Loading products…</p>
                  </td>
                </tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Cpu className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No Motors products yet</p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Add your first product
                    </button>
                  </td>
                </tr>
              ) : (
                data.items.map((p) => <ProductRow key={p.id} product={p} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > (query.limit || 25) && (
          <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700">
            <p className="text-xs text-gray-500">
              Showing {((query.page || 1) - 1) * (query.limit || 25) + 1}–
              {Math.min((query.page || 1) * (query.limit || 25), data.total)} of {data.total}
            </p>
            <div className="flex gap-1">
              <button
                disabled={(query.page || 1) <= 1}
                onClick={() => setQuery({ ...query, page: (query.page || 1) - 1 })}
                className="px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={(query.page || 1) * (query.limit || 25) >= data.total}
                onClick={() => setQuery({ ...query, page: (query.page || 1) + 1 })}
                className="px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Create dialog */}
      {showCreate && <CreateProductForm onClose={() => setShowCreate(false)} />}
    </div>
  );
}
