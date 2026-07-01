import type { EditorMarketplaceVersion } from '../../lib/inventoryApi';

interface MarketplaceVersionEditorProps {
  version: EditorMarketplaceVersion;
  onChange: (updated: EditorMarketplaceVersion) => void;
}

export default function MarketplaceVersionEditor({
  version,
  onChange,
}: MarketplaceVersionEditorProps) {
  const update = (patch: Partial<EditorMarketplaceVersion>) => {
    onChange({ ...version, ...patch });
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Listing Title
        </label>
        <input
          type="text"
          value={version.title}
          onChange={(e) => update({ title: e.target.value })}
          maxLength={80}
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
        />
        <span className="text-[10px] text-slate-400 mt-0.5 block text-right">
          {version.title.length}/80 characters
        </span>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Description
        </label>
        <textarea
          value={version.description}
          onChange={(e) => update({ description: e.target.value })}
          rows={10}
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono resize-y"
        />
      </div>

      {/* Price & Quantity row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Price ($)
          </label>
          <input
            type="number"
            value={version.price ?? ''}
            onChange={(e) => update({ price: e.target.value ? parseFloat(e.target.value) : null })}
            min={0}
            step={0.01}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={version.quantity ?? ''}
            onChange={(e) => update({ quantity: e.target.value ? parseInt(e.target.value, 10) : null })}
            min={0}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Condition */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Condition
        </label>
        <select
          value={version.conditionId}
          onChange={(e) => update({ conditionId: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="New">New</option>
          <option value="New other">New other</option>
          <option value="New with tags">New with tags</option>
          <option value="Used">Used</option>
          <option value="For parts or not working">For parts or not working</option>
          <option value="Refurbished">Refurbished</option>
        </select>
      </div>

      {/* SEO scores */}
      {version.seoScore != null && (
        <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
          <span>
            SEO Score:{' '}
            <span className={version.seoScore >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}>
              {(version.seoScore * 100).toFixed(0)}%
            </span>
          </span>
          {version.readinessScore != null && (
            <span>
              Readiness:{' '}
              <span className={version.readinessScore >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}>
                {(version.readinessScore * 100).toFixed(0)}%
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
