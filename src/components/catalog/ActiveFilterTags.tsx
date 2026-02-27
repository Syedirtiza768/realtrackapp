/* ─── ActiveFilterTags ─────────────────────────────────────
 *  Shows active filter chips with quick removal.
 * ────────────────────────────────────────────────────────── */

import { X } from 'lucide-react';
import type { ActiveFilters } from '../../types/search';
import { conditionLabel, countActiveFilters, EMPTY_FILTERS } from '../../types/search';

interface Props {
  filters: ActiveFilters;
  searchQuery: string;
  onChange: (filters: ActiveFilters) => void;
  onClearSearch: () => void;
}

interface Tag {
  key: string;
  label: string;
  onRemove: () => void;
}

export default function ActiveFilterTags({ filters, searchQuery, onChange, onClearSearch }: Props) {
  const tags: Tag[] = [];

  // Search query tag
  if (searchQuery.trim()) {
    tags.push({
      key: 'search',
      label: `Search: "${searchQuery}"`,
      onRemove: onClearSearch,
    });
  }

  // Brand tags
  for (const brand of filters.brands) {
    tags.push({
      key: `brand:${brand}`,
      label: `Brand: ${brand}`,
      onRemove: () => onChange({ ...filters, brands: filters.brands.filter((b) => b !== brand) }),
    });
  }

  // Make tags
  for (let i = 0; i < filters.makes.length; i++) {
    const makeId = filters.makes[i];
    const makeName = filters.makeNames[i] ?? makeId;
    tags.push({
      key: `make:${makeId}`,
      label: `Make: ${makeName}`,
      onRemove: () => {
        const idx = filters.makes.indexOf(makeId);
        onChange({
          ...filters,
          makes: filters.makes.filter((_, j) => j !== idx),
          makeNames: filters.makeNames.filter((_, j) => j !== idx),
        });
      },
    });
  }

  // Model tags
  for (let i = 0; i < filters.models.length; i++) {
    const modelId = filters.models[i];
    const modelName = filters.modelNames[i] ?? modelId;
    tags.push({
      key: `model:${modelId}`,
      label: `Model: ${modelName}`,
      onRemove: () => {
        const idx = filters.models.indexOf(modelId);
        onChange({
          ...filters,
          models: filters.models.filter((_, j) => j !== idx),
          modelNames: filters.modelNames.filter((_, j) => j !== idx),
        });
      },
    });
  }

  // Category tags
  for (let i = 0; i < filters.categories.length; i++) {
    const catId = filters.categories[i];
    const catName = filters.categoryNames[i] ?? catId;
    // Show last path segment
    const parts = catName.split('/').filter(Boolean);
    const shortName = parts.length > 0 ? parts[parts.length - 1] : catName;
    tags.push({
      key: `cat:${catId}`,
      label: `Category: ${shortName}`,
      onRemove: () => {
        const idx = filters.categories.indexOf(catId);
        onChange({
          ...filters,
          categories: filters.categories.filter((_, j) => j !== idx),
          categoryNames: filters.categoryNames.filter((_, j) => j !== idx),
        });
      },
    });
  }

  // Condition tags
  for (const cond of filters.conditions) {
    tags.push({
      key: `cond:${cond}`,
      label: `Condition: ${conditionLabel(cond)}`,
      onRemove: () => onChange({ ...filters, conditions: filters.conditions.filter((c) => c !== cond) }),
    });
  }

  // Type tags
  for (const type of filters.types) {
    tags.push({
      key: `type:${type}`,
      label: `Type: ${type}`,
      onRemove: () => onChange({ ...filters, types: filters.types.filter((t) => t !== type) }),
    });
  }

  // Format tags
  for (const fmt of filters.formats) {
    tags.push({
      key: `fmt:${fmt}`,
      label: `Format: ${fmt}`,
      onRemove: () => onChange({ ...filters, formats: filters.formats.filter((f) => f !== fmt) }),
    });
  }

  // Location tags
  for (const loc of filters.locations) {
    tags.push({
      key: `loc:${loc}`,
      label: `Location: ${loc}`,
      onRemove: () => onChange({ ...filters, locations: filters.locations.filter((l) => l !== loc) }),
    });
  }

  // MPN tags
  for (const mpn of filters.mpns) {
    tags.push({
      key: `mpn:${mpn}`,
      label: `MPN: ${mpn}`,
      onRemove: () => onChange({ ...filters, mpns: filters.mpns.filter((m) => m !== mpn) }),
    });
  }

  // Source file tags
  for (const sf of filters.sourceFiles) {
    tags.push({
      key: `src:${sf}`,
      label: sf.replace('.xlsx', ''),
      onRemove: () => onChange({ ...filters, sourceFiles: filters.sourceFiles.filter((s) => s !== sf) }),
    });
  }

  // Price tags
  if (filters.minPrice != null || filters.maxPrice != null) {
    const label = `Price: ${filters.minPrice != null ? `$${filters.minPrice}` : '$0'} — ${filters.maxPrice != null ? `$${filters.maxPrice}` : 'Any'}`;
    tags.push({
      key: 'price',
      label,
      onRemove: () => onChange({ ...filters, minPrice: null, maxPrice: null }),
    });
  }

  // Boolean tags
  if (filters.hasImage) {
    tags.push({
      key: 'hasImage',
      label: 'Has Image',
      onRemove: () => onChange({ ...filters, hasImage: false }),
    });
  }
  if (filters.hasPrice) {
    tags.push({
      key: 'hasPrice',
      label: 'Has Price',
      onRemove: () => onChange({ ...filters, hasPrice: false }),
    });
  }

  if (tags.length === 0) return null;

  const total = countActiveFilters(filters) + (searchQuery.trim() ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1 bg-blue-600/10 border border-blue-600/20 text-blue-300 rounded-md px-2 py-0.5 text-xs"
        >
          {tag.label}
          <button
            onClick={tag.onRemove}
            className="hover:text-white ml-0.5 transition-colors"
          >
            <X size={11} />
          </button>
        </span>
      ))}

      {total > 1 && (
        <button
          onClick={() => {
            onChange(EMPTY_FILTERS);
            onClearSearch();
          }}
          className="text-[11px] text-slate-500 hover:text-slate-300 ml-1"
        >
          Clear all ({total})
        </button>
      )}
    </div>
  );
}
