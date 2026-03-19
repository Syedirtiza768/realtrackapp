import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Loader2,
  Copy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { sanitizeHtml } from '../../lib/sanitize';

import {
  useMotorsProduct,
  useRunPipeline,
  usePublishMotorsProduct,
} from '../../lib/motorsApi';
import type { FitmentRow } from '../../types/motors';

/* ── Confidence indicator ─────────────────────────────────── */

function ConfidenceMeter({ value, label, size = 'md' }: { value: number; label: string; size?: 'sm' | 'md' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';

  const radius = size === 'md' ? 36 : 24;
  const stroke = size === 'md' ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: (radius + stroke) * 2, height: (radius + stroke) * 2 }}>
        <svg className="transform -rotate-90" style={{ width: (radius + stroke) * 2, height: (radius + stroke) * 2 }}>
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-bold ${size === 'md' ? 'text-lg' : 'text-xs'} ${color}`}>
          {pct}%
        </span>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
    </div>
  );
}

/* ── Item specifics table ─────────────────────────────────── */

function ItemSpecificsTable({ specifics }: { specifics: Record<string, string> }) {
  const entries = Object.entries(specifics || {});
  if (!entries.length) return <p className="text-sm text-gray-400 italic">No item specifics generated</p>;

  return (
    <div className="divide-y dark:divide-gray-700">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-start py-2 text-sm">
          <span className="w-48 shrink-0 font-medium text-gray-600 dark:text-gray-400">{key}</span>
          <span className="text-gray-800 dark:text-gray-200">{val}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Fitment table ────────────────────────────────────────── */

function FitmentTable({ rows }: { rows: FitmentRow[] }) {
  if (!rows?.length) return <p className="text-sm text-gray-400 italic">No fitment data</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2">Make</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Submodel</th>
            <th className="px-3 py-2">Engine</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b dark:border-gray-700/50">
              <td className="px-3 py-1.5">{r.year}</td>
              <td className="px-3 py-1.5">{r.make}</td>
              <td className="px-3 py-1.5">{r.model}</td>
              <td className="px-3 py-1.5 text-gray-500">{r.submodel || '—'}</td>
              <td className="px-3 py-1.5 text-gray-500">{r.engine || '—'}</td>
              <td className="px-3 py-1.5 text-gray-500">{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2 px-3">{rows.length} fitment row{rows.length !== 1 ? 's' : ''}</p>
    </div>
  );
}

/* ── Main detail page ─────────────────────────────────────── */

export default function MotorsProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useMotorsProduct(id || null);
  const runPipeline = useRunPipeline();
  const publishProduct = usePublishMotorsProduct();
  const [activeTab, setActiveTab] = useState<'overview' | 'listing' | 'fitment' | 'specifics' | 'compliance'>('overview');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-20">
        <XCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
        <p className="text-sm text-gray-500">Product not found</p>
        <Link to="/motors" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
          Back to Motors Dashboard
        </Link>
      </div>
    );
  }

  const isProcessing = ['extracting', 'identifying', 'resolving_fitment', 'generating_listing', 'validating', 'publishing'].includes(product.status);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'listing', label: 'Listing Preview' },
    { key: 'fitment', label: `Fitment (${product.fitmentRows?.length || 0})` },
    { key: 'specifics', label: 'Item Specifics' },
    { key: 'compliance', label: 'Compliance' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/motors')}
            className="mt-1 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {product.generatedTitle || product.mpn || 'Motors Product'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {[product.brand, product.mpn, product.productType].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isProcessing && product.status !== 'published' && (
            <button
              onClick={() => runPipeline.mutate(product.id)}
              disabled={runPipeline.isPending}
              className="px-3 py-2 rounded-lg text-sm font-medium border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${runPipeline.isPending ? 'animate-spin' : ''}`} />
              Re-run Pipeline
            </button>
          )}
          {product.status === 'approved' && (
            <button
              onClick={() => {
                const connectionId = prompt('Enter eBay connection ID:');
                if (connectionId) {
                  publishProduct.mutate({ id: product.id, connectionId });
                }
              }}
              disabled={publishProduct.isPending}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Publish to eBay
            </button>
          )}
        </div>
      </div>

      {/* Confidence scores */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-8 md:gap-12">
            <ConfidenceMeter value={product.identityConfidence || 0} label="Identity" />
            <ConfidenceMeter value={product.fitmentConfidence || 0} label="Fitment" />
            <ConfidenceMeter value={product.complianceScore || 0} label="Compliance" />
            <ConfidenceMeter value={product.contentQualityScore || 0} label="Content" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Brand</span><span className="font-medium">{product.brand || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">MPN</span><span className="font-mono">{product.mpn || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">OEM Part #</span><span className="font-mono">{product.oemPartNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">UPC</span><span className="font-mono">{product.upc || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ePID</span><span className="font-mono">{product.epid || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Product Type</span><span>{product.productType || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Placement</span><span>{product.placement || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Condition</span><span>{product.condition || '—'}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publishing Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium capitalize">{product.status.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Source</span><span>{product.sourceType.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">eBay Category</span><span>{product.ebayCategoryName || product.ebayCategoryId || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">eBay Item ID</span><span className="font-mono">{product.ebayItemId || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Published</span><span>{product.publishedAt ? new Date(product.publishedAt).toLocaleString() : '—'}</span></div>
              {product.publishError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 text-xs">
                  {product.publishError}
                </div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Price</span><span>{product.price ? `$${product.price.toFixed(2)}` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Quantity</span><span>{product.quantity ?? '—'}</span></div>
            </CardContent>
          </Card>

          {/* Images */}
          {product.imageUrls?.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Images ({product.imageUrls.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {product.imageUrls.map((url: string, i: number) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Product image ${i + 1}`}
                      className="w-32 h-32 rounded-lg object-cover bg-gray-100 dark:bg-gray-700 shrink-0"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'listing' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Listing Preview
              {product.generatedTitle && (
                <button
                  onClick={() => navigator.clipboard.writeText(product.generatedTitle || '')}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy title
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Title</label>
              <p className="text-sm font-medium mt-1">
                {product.generatedTitle || <span className="italic text-gray-400">Not generated</span>}
              </p>
              {product.generatedTitle && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {product.generatedTitle.length}/80 characters
                </p>
              )}
            </div>

            {product.generatedBulletFeatures?.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Features</label>
                <ul className="mt-1 space-y-1">
                  {product.generatedBulletFeatures.map((f: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.generatedHtmlDescription && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</label>
                <div
                  className="mt-2 p-4 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg text-sm prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.generatedHtmlDescription) }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'fitment' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Vehicle Fitment ({product.fitmentRows?.length || 0} rows)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FitmentTable rows={product.fitmentRows || []} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'specifics' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Item Specifics</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemSpecificsTable specifics={product.generatedItemSpecifics || {}} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'compliance' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance & Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold">{Math.round((product.complianceScore || 0) * 100)}%</p>
                <p className="text-xs text-gray-500">Compliance</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold">{Math.round((product.contentQualityScore || 0) * 100)}%</p>
                <p className="text-xs text-gray-500">Content Quality</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold">{product.fitmentRows?.length || 0}</p>
                <p className="text-xs text-gray-500">Fitment Rows</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold">{Object.keys(product.generatedItemSpecifics || {}).length}</p>
                <p className="text-xs text-gray-500">Item Specifics</p>
              </div>
            </div>

            {product.processingNotes?.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Processing Notes</label>
                <div className="mt-2 space-y-1">
                  {product.processingNotes.map((note: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
