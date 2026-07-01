import type { EditorStore, EditorStoreMarketplace } from '../../lib/inventoryApi';

interface StorePolicySelectorProps {
  stores: EditorStore[];
  selectedStoreId: string | null;
  selectedMarketplaceId: string | null;
  selectedPaymentPolicyId: string | null;
  selectedReturnPolicyId: string | null;
  selectedFulfillmentPolicyId: string | null;
  selectedLocationKey: string | null;
  onStoreChange: (storeId: string) => void;
  onMarketplaceChange: (marketplaceId: string) => void;
  onPaymentPolicyChange: (policyId: string) => void;
  onReturnPolicyChange: (policyId: string) => void;
  onFulfillmentPolicyChange: (policyId: string) => void;
  onLocationKeyChange: (locationKey: string) => void;
}

export default function StorePolicySelector({
  stores,
  selectedStoreId,
  selectedMarketplaceId,
  selectedPaymentPolicyId,
  selectedReturnPolicyId,
  selectedFulfillmentPolicyId,
  selectedLocationKey,
  onStoreChange,
  onMarketplaceChange,
  onPaymentPolicyChange,
  onReturnPolicyChange,
  onFulfillmentPolicyChange,
  onLocationKeyChange,
}: StorePolicySelectorProps) {
  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const selectedMarketplace = selectedStore?.marketplaces.find(
    (m) => m.marketplaceId === selectedMarketplaceId,
  );

  // Collect all unique marketplace IDs from all stores
  const allMarketplaceIds = [...new Set(stores.flatMap((s) => s.marketplaces.map((m) => m.marketplaceId)))];

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Publish Settings</h3>

      {/* Store selector */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          eBay Store
        </label>
        <select
          value={selectedStoreId ?? ''}
          onChange={(e) => {
            onStoreChange(e.target.value);
            onMarketplaceChange('');
          }}
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">Select a store...</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name} ({store.ebayUserId})
            </option>
          ))}
        </select>
      </div>

      {/* Marketplace selector (shown when store is selected) */}
      {selectedStore && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Marketplace
          </label>
          <select
            value={selectedMarketplaceId ?? ''}
            onChange={(e) => onMarketplaceChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select marketplace...</option>
            {selectedStore.marketplaces.map((mp) => (
              <option key={mp.marketplaceId} value={mp.marketplaceId}>
                {mp.label} ({mp.marketplaceId})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Policy selectors (shown when marketplace is selected) */}
      {selectedMarketplace && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PolicyDropdown
              label="Payment Policy"
              policies={selectedMarketplace.policies.payment}
              selectedId={selectedPaymentPolicyId ?? selectedMarketplace.defaultPaymentPolicyId}
              onChange={onPaymentPolicyChange}
              defaultValue={selectedMarketplace.defaultPaymentPolicyId}
            />
            <PolicyDropdown
              label="Return Policy"
              policies={selectedMarketplace.policies.return}
              selectedId={selectedReturnPolicyId ?? selectedMarketplace.defaultReturnPolicyId}
              onChange={onReturnPolicyChange}
              defaultValue={selectedMarketplace.defaultReturnPolicyId}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PolicyDropdown
              label="Fulfillment Policy"
              policies={selectedMarketplace.policies.fulfillment}
              selectedId={selectedFulfillmentPolicyId ?? selectedMarketplace.defaultFulfillmentPolicyId}
              onChange={onFulfillmentPolicyChange}
              defaultValue={selectedMarketplace.defaultFulfillmentPolicyId}
            />
            {selectedMarketplace.defaultInventoryLocationKey && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Inventory Location
                </label>
                <select
                  value={selectedLocationKey ?? selectedMarketplace.defaultInventoryLocationKey ?? ''}
                  onChange={(e) => onLocationKeyChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value={selectedMarketplace.defaultInventoryLocationKey ?? ''}>
                    {selectedMarketplace.defaultInventoryLocationKey ?? 'Default location'}
                  </option>
                </select>
              </div>
            )}
          </div>
        </>
      )}

      {/* Summary when no store selected but stores exist */}
      {stores.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          No eBay stores available. Connect an eBay account in Settings to publish.
        </p>
      )}
    </div>
  );
}

function PolicyDropdown({
  label,
  policies,
  selectedId,
  onChange,
  defaultValue,
}: {
  label: string;
  policies: Array<{ id: string; ebayPolicyId: string; name: string }>;
  selectedId: string | null;
  onChange: (id: string) => void;
  defaultValue: string | null;
}) {
  const currentId = selectedId ?? defaultValue ?? '';

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </label>
      <select
        value={currentId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
      >
        {policies.length === 0 ? (
          <option value="">No policies synced</option>
        ) : (
          policies.map((p) => (
            <option key={p.id} value={p.ebayPolicyId}>
              {p.name}
              {p.ebayPolicyId === defaultValue ? ' (Default)' : ''}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
