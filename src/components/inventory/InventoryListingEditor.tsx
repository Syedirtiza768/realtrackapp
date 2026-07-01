import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  Package,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  useListingEditor,
  useSaveListingEditor,
  type EditorMarketplaceVersion,
} from '../../lib/inventoryApi';
import MarketplaceVersionEditor from './MarketplaceVersionEditor';
import StorePolicySelector from './StorePolicySelector';
import PublishActionBar from './PublishActionBar';

const MARKETPLACE_NAMES: Record<string, string> = {
  US: '🇺🇸 United States',
  AU: '🇦🇺 Australia',
  DE: '🇩🇪 Germany',
};

export default function InventoryListingEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const saveMutation = useSaveListingEditor();

  const { data, isLoading, error } = useListingEditor(id ?? null);

  const [activeTab, setActiveTab] = useState<'US' | 'AU' | 'DE'>('US');
  const [versions, setVersions] = useState<EditorMarketplaceVersion[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Selected publish settings
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string | null>(null);
  const [selectedPaymentPolicyId, setSelectedPaymentPolicyId] = useState<string | null>(null);
  const [selectedReturnPolicyId, setSelectedReturnPolicyId] = useState<string | null>(null);
  const [selectedFulfillmentPolicyId, setSelectedFulfillmentPolicyId] = useState<string | null>(null);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);

  // Initialize versions from data
  useEffect(() => {
    if (data?.marketplaceVersions) {
      setVersions(data.marketplaceVersions);
    }
  }, [data?.marketplaceVersions]);

  const listing = data?.listing;
  const stores = data?.stores ?? [];
  const activeVersion = versions.find((v) => v.marketplace === activeTab);

  const handleVersionChange = (updated: EditorMarketplaceVersion) => {
    setVersions((prev) =>
      prev.map((v) => (v.marketplace === updated.marketplace ? updated : v)),
    );
  };

  const handleSave = async () => {
    if (!id) return;
    setSaveStatus('saving');
    try {
      await saveMutation.mutateAsync({
        listingId: id,
        marketplaceVersions: versions.map((v) => ({
          marketplace: v.marketplace,
          title: v.title,
          description: v.description,
          price: v.price,
          quantity: v.quantity,
          conditionId: v.conditionId,
          conditionDescription: v.conditionDescription,
          itemSpecifics: v.itemSpecifics,
        })),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-slate-500">
          {error instanceof Error ? error.message : 'Failed to load listing'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="text-sm text-blue-400 hover:underline"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-400" />
              {listing.sku || 'Listing Editor'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {listing.brand && `${listing.brand} — `}
              {listing.partType && `${listing.partType} — `}
              {listing.mpn && `MPN: ${listing.mpn}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-3 w-3" /> Save failed
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Marketplace versions */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Marketplace Versions
                </CardTitle>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                  {(['US', 'AU', 'DE'] as const).map((mkt) => {
                    const ver = versions.find((v) => v.marketplace === mkt);
                    const hasContent = ver && (ver.title || ver.description);
                    return (
                      <button
                        key={mkt}
                        type="button"
                        onClick={() => setActiveTab(mkt)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          activeTab === mkt
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        {hasContent ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {mkt}
                          </span>
                        ) : (
                          mkt
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeVersion ? (
                <MarketplaceVersionEditor
                  key={activeVersion.marketplace}
                  version={activeVersion}
                  onChange={handleVersionChange}
                />
              ) : (
                <p className="text-sm text-slate-400 italic">No data for this marketplace</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Listing info + Store/Policy selector */}
        <div className="space-y-4">
          {/* Listing summary card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Part Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">SKU</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">{listing.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Brand</span>
                <span>{listing.brand ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category</span>
                <span className="text-right truncate max-w-[180px]">
                  {listing.categoryName ?? listing.categoryId ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Images</span>
                <span>{listing.imageUrls.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fitments</span>
                <span>{listing.fitmentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge variant="secondary">{listing.status}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Store & Policy selector */}
          <StorePolicySelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            selectedMarketplaceId={selectedMarketplaceId}
            selectedPaymentPolicyId={selectedPaymentPolicyId}
            selectedReturnPolicyId={selectedReturnPolicyId}
            selectedFulfillmentPolicyId={selectedFulfillmentPolicyId}
            selectedLocationKey={selectedLocationKey}
            onStoreChange={setSelectedStoreId}
            onMarketplaceChange={setSelectedMarketplaceId}
            onPaymentPolicyChange={setSelectedPaymentPolicyId}
            onReturnPolicyChange={setSelectedReturnPolicyId}
            onFulfillmentPolicyChange={setSelectedFulfillmentPolicyId}
            onLocationKeyChange={setSelectedLocationKey}
          />
        </div>
      </div>

      <PublishActionBar
        listingId={id!}
        stores={stores}
        selectedStoreId={selectedStoreId}
        selectedMarketplaceId={selectedMarketplaceId}
        selectedPaymentPolicyId={selectedPaymentPolicyId}
        selectedReturnPolicyId={selectedReturnPolicyId}
        selectedFulfillmentPolicyId={selectedFulfillmentPolicyId}
        selectedLocationKey={selectedLocationKey}
      />
    </div>
  );
}
