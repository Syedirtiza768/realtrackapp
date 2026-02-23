
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ArrowUpDown,
    Check,
    Columns3,
    Download,
    Eye,
    GitCompare,
    Grid3X3,
    Heart,
    List,
    Plus,
    Search,
    ShoppingCart,
    Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    COMPATIBILITY_OPTIONS,
    decodeVin,
    getModelsByMake,
    getTrimsByModel,
    INVENTORY_DATA,
} from '../../data/inventory';
import { applyCatalogFilters, buildFacetCounts, buildSuggestions, runAutomotiveSearch } from '../../lib/catalogSearch';
import { CatalogFilterState, CatalogItem, SearchCompatibilityInput } from '../../types/catalog';

type ViewMode = 'grid' | 'list';
type SortMode = 'relevance' | 'price_asc' | 'price_desc' | 'popularity';

const parseMultiSelect = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const formatLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

const defaultFilters: CatalogFilterState = {
    brands: [],
    conditions: [],
    placements: [],
    availability: [],
    shippingTypes: [],
    sellerRatings: [],
    guaranteedFitOnly: false,
    minPrice: 0,
    maxPrice: 500,
};

export default function CatalogManager() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [query, setQuery] = useState(searchParams.get('q') ?? '');
    const [viewMode, setViewMode] = useState<ViewMode>((searchParams.get('view') as ViewMode) || 'grid');
    const [sortMode, setSortMode] = useState<SortMode>((searchParams.get('sort') as SortMode) || 'relevance');
    const [b2bMode, setB2bMode] = useState(searchParams.get('b2b') === '1');

    const [compatibility, setCompatibility] = useState<SearchCompatibilityInput>({
        year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
        make: searchParams.get('make') ?? undefined,
        model: searchParams.get('model') ?? undefined,
        trim: searchParams.get('trim') ?? undefined,
        vin: searchParams.get('vin') ?? undefined,
        epId: searchParams.get('epid') ?? undefined,
        kType: searchParams.get('ktype') ?? undefined,
    });

    const [filters, setFilters] = useState<CatalogFilterState>({
        brands: parseMultiSelect(searchParams.get('brands')),
        conditions: parseMultiSelect(searchParams.get('conditions')),
        placements: parseMultiSelect(searchParams.get('placements')),
        availability: parseMultiSelect(searchParams.get('availability')),
        shippingTypes: parseMultiSelect(searchParams.get('shipping')),
        sellerRatings: parseMultiSelect(searchParams.get('sellerRatings')),
        guaranteedFitOnly: searchParams.get('fit') === '1',
        minPrice: Number(searchParams.get('minPrice') ?? 0),
        maxPrice: Number(searchParams.get('maxPrice') ?? 500),
    });

    const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [compareItems, setCompareItems] = useState<string[]>([]);
    const [quickViewItem, setQuickViewItem] = useState<CatalogItem | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const availableModels = useMemo(() => getModelsByMake(compatibility.make), [compatibility.make]);
    const availableTrims = useMemo(() => getTrimsByModel(compatibility.make, compatibility.model), [compatibility.make, compatibility.model]);

    const suggestionList = useMemo(() => buildSuggestions(INVENTORY_DATA, query), [query]);

    const processedResults = useMemo(() => {
        const start = performance.now();
        const ranked = runAutomotiveSearch(INVENTORY_DATA, {
            query,
            compatibility,
            attributes: {
                brands: filters.brands,
                placements: filters.placements,
            },
        });

        const filtered = applyCatalogFilters(ranked, filters);

        const sorted = [...filtered].sort((left, right) => {
            if (sortMode === 'price_asc') {
                return left.item.price - right.item.price;
            }
            if (sortMode === 'price_desc') {
                return right.item.price - left.item.price;
            }
            if (sortMode === 'popularity') {
                return right.item.popularityScore - left.item.popularityScore;
            }
            return right.score - left.score;
        });

        const durationMs = Math.round((performance.now() - start) * 100) / 100;

        return {
            sorted,
            facetCounts: buildFacetCounts(filtered),
            durationMs,
        };
    }, [compatibility, filters, query, sortMode]);

    useEffect(() => {
        const nextParams = new URLSearchParams();
        if (query) nextParams.set('q', query);
        if (viewMode !== 'grid') nextParams.set('view', viewMode);
        if (sortMode !== 'relevance') nextParams.set('sort', sortMode);
        if (b2bMode) nextParams.set('b2b', '1');

        if (compatibility.year) nextParams.set('year', String(compatibility.year));
        if (compatibility.make) nextParams.set('make', compatibility.make);
        if (compatibility.model) nextParams.set('model', compatibility.model);
        if (compatibility.trim) nextParams.set('trim', compatibility.trim);
        if (compatibility.vin) nextParams.set('vin', compatibility.vin);
        if (compatibility.epId) nextParams.set('epid', compatibility.epId);
        if (compatibility.kType) nextParams.set('ktype', compatibility.kType);

        if (filters.brands.length) nextParams.set('brands', filters.brands.join(','));
        if (filters.conditions.length) nextParams.set('conditions', filters.conditions.join(','));
        if (filters.placements.length) nextParams.set('placements', filters.placements.join(','));
        if (filters.availability.length) nextParams.set('availability', filters.availability.join(','));
        if (filters.shippingTypes.length) nextParams.set('shipping', filters.shippingTypes.join(','));
        if (filters.sellerRatings.length) nextParams.set('sellerRatings', filters.sellerRatings.join(','));
        if (filters.guaranteedFitOnly) nextParams.set('fit', '1');
        if (filters.minPrice !== defaultFilters.minPrice) nextParams.set('minPrice', String(filters.minPrice));
        if (filters.maxPrice !== defaultFilters.maxPrice) nextParams.set('maxPrice', String(filters.maxPrice));

        if (nextParams.toString() !== searchParams.toString()) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [b2bMode, compatibility, filters, query, searchParams, setSearchParams, sortMode, viewMode]);

    const toggleMultiFilter = (group: keyof Pick<CatalogFilterState, 'brands' | 'conditions' | 'placements' | 'availability' | 'shippingTypes' | 'sellerRatings'>, value: string) => {
        setFilters((previous) => {
            const current = previous[group];
            const exists = current.includes(value);
            return {
                ...previous,
                [group]: exists ? current.filter(item => item !== value) : [...current, value],
            };
        });
    };

    const lookupVin = () => {
        if (!compatibility.vin) {
            return;
        }

        const match = decodeVin(compatibility.vin);
        if (!match) {
            return;
        }

        setCompatibility((previous) => ({
            ...previous,
            year: match.year,
            make: match.make,
            model: match.model,
            trim: match.trim,
        }));
    };

    const toggleBulkSelection = (id: string) => {
        setSelectedForBulk((previous) => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
    };

    const toggleWatchlist = (id: string) => {
        setWatchlist((previous) => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
    };

    const toggleCompare = (id: string) => {
        setCompareItems((previous) => {
            if (previous.includes(id)) {
                return previous.filter(item => item !== id);
            }

            if (previous.length >= 4) {
                return previous;
            }

            return [...previous, id];
        });
    };

    const allVisibleSelected = processedResults.sorted.length > 0 && processedResults.sorted.every(result => selectedForBulk.includes(result.item.id));

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            setSelectedForBulk(previous => previous.filter(id => !processedResults.sorted.some(result => result.item.id === id)));
            return;
        }

        setSelectedForBulk(previous => Array.from(new Set([...previous, ...processedResults.sorted.map(result => result.item.id)])));
    };

    const renderFacet = (
        label: string,
        group: keyof Pick<CatalogFilterState, 'brands' | 'conditions' | 'placements' | 'availability' | 'shippingTypes' | 'sellerRatings'>,
        counts: Map<string, number>
    ) => {
        const selectedValues = filters[group];
        const options = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);

        return (
            <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wide text-slate-500">{label}</h4>
                <div className="space-y-2">
                    {options.map(([value, count]) => (
                        <label key={value} className="flex items-center justify-between text-sm text-slate-300 gap-2 cursor-pointer">
                            <span className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedValues.includes(value)}
                                    onChange={() => toggleMultiFilter(group, value)}
                                    className="rounded border-slate-700 bg-slate-900"
                                />
                                {formatLabel(value)}
                            </span>
                            <span className="text-xs text-slate-500">{count}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Catalog</h2>
                    <p className="text-slate-500">Automotive-grade indexed discovery with compatibility intelligence.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800">
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                        <Plus size={16} /> Add Product
                    </button>
                </div>
            </div>

            <Card>
                <CardHeader className="border-b border-slate-800">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                        <div className="xl:col-span-5 space-y-2 relative">
                            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                                <Search size={16} className="text-slate-500" />
                                <input
                                    type="text"
                                    value={query}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search by keyword, SKU, OEM, attribute, ePID, K-Type..."
                                    className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
                                />
                            </div>
                            {showSuggestions && suggestionList.length > 0 && (
                                <div className="absolute z-20 top-[100%] left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                                    {suggestionList.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onMouseDown={() => setQuery(suggestion)}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-slate-500">Synonyms + fuzzy match enabled (e.g. bumper/fascia, tail light/rear lamp).</p>
                        </div>

                        <div className="xl:col-span-7 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            <select
                                value={compatibility.year ?? ''}
                                onChange={(event) => setCompatibility(previous => ({
                                    ...previous,
                                    year: event.target.value ? Number(event.target.value) : undefined,
                                }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">Year</option>
                                {COMPATIBILITY_OPTIONS.years.map((year) => <option key={year} value={year}>{year}</option>)}
                            </select>
                            <select
                                value={compatibility.make ?? ''}
                                onChange={(event) => setCompatibility(previous => ({
                                    ...previous,
                                    make: event.target.value || undefined,
                                    model: undefined,
                                    trim: undefined,
                                }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">Make</option>
                                {COMPATIBILITY_OPTIONS.makes.map((make) => <option key={make} value={make}>{make}</option>)}
                            </select>
                            <select
                                value={compatibility.model ?? ''}
                                onChange={(event) => setCompatibility(previous => ({
                                    ...previous,
                                    model: event.target.value || undefined,
                                    trim: undefined,
                                }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">Model</option>
                                {availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
                            </select>
                            <select
                                value={compatibility.trim ?? ''}
                                onChange={(event) => setCompatibility(previous => ({ ...previous, trim: event.target.value || undefined }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">Trim</option>
                                {availableTrims.map((trim) => <option key={trim} value={trim}>{trim}</option>)}
                            </select>
                            <input
                                value={compatibility.vin ?? ''}
                                onChange={(event) => setCompatibility(previous => ({ ...previous, vin: event.target.value.toUpperCase() }))}
                                placeholder="VIN"
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                            <input
                                value={compatibility.epId ?? ''}
                                onChange={(event) => setCompatibility(previous => ({ ...previous, epId: event.target.value }))}
                                placeholder="ePID"
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                            <input
                                value={compatibility.kType ?? ''}
                                onChange={(event) => setCompatibility(previous => ({ ...previous, kType: event.target.value }))}
                                placeholder="K-Type"
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                        <button onClick={lookupVin} className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800">Lookup VIN</button>
                        <label className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.guaranteedFitOnly}
                                onChange={(event) => setFilters(previous => ({ ...previous, guaranteedFitOnly: event.target.checked }))}
                                className="rounded border-slate-700 bg-slate-900"
                            />
                            Guaranteed Fit only
                        </label>
                        <label className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={b2bMode}
                                onChange={(event) => setB2bMode(event.target.checked)}
                                className="rounded border-slate-700 bg-slate-900"
                            />
                            B2B bulk mode
                        </label>
                        <button
                            onClick={() => {
                                setFilters(defaultFilters);
                                setCompatibility({});
                                setQuery('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                        >
                            Reset filters
                        </button>
                        <span className="ml-auto text-xs text-slate-500">Response {processedResults.durationMs}ms • {processedResults.sorted.length} results</span>
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <aside className="xl:col-span-3 space-y-5">
                            {renderFacet('Brand', 'brands', processedResults.facetCounts.brands)}
                            {renderFacet('Condition', 'conditions', processedResults.facetCounts.conditions)}
                            {renderFacet('Placement', 'placements', processedResults.facetCounts.placements)}
                            {renderFacet('Availability', 'availability', processedResults.facetCounts.availability)}
                            {renderFacet('Shipping Type', 'shippingTypes', processedResults.facetCounts.shippingTypes)}
                            {renderFacet('Seller Rating', 'sellerRatings', processedResults.facetCounts.sellerRatings)}

                            <div className="space-y-2">
                                <h4 className="text-xs uppercase tracking-wide text-slate-500">Price Range</h4>
                                <div className="text-xs text-slate-500">${filters.minPrice} - ${filters.maxPrice}</div>
                                <input
                                    type="range"
                                    min={0}
                                    max={500}
                                    value={filters.minPrice}
                                    onChange={(event) => {
                                        const next = Number(event.target.value);
                                        setFilters(previous => ({ ...previous, minPrice: Math.min(next, previous.maxPrice - 1) }));
                                    }}
                                    className="w-full"
                                />
                                <input
                                    type="range"
                                    min={0}
                                    max={500}
                                    value={filters.maxPrice}
                                    onChange={(event) => {
                                        const next = Number(event.target.value);
                                        setFilters(previous => ({ ...previous, maxPrice: Math.max(next, previous.minPrice + 1) }));
                                    }}
                                    className="w-full"
                                />
                            </div>
                        </aside>

                        <section className="xl:col-span-9 space-y-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[11px]">Indexed Search</Badge>
                                    <Badge variant="outline" className="text-[11px]">Predictive Suggest</Badge>
                                    <Badge variant="outline" className="text-[11px]">Deep Link Ready</Badge>
                                </div>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={sortMode}
                                        onChange={(event) => setSortMode(event.target.value as SortMode)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"
                                    >
                                        <option value="relevance">Relevance</option>
                                        <option value="popularity">Popularity</option>
                                        <option value="price_asc">Price Low to High</option>
                                        <option value="price_desc">Price High to Low</option>
                                    </select>
                                    <button className="p-1.5 rounded border border-slate-700 text-slate-400">
                                        <ArrowUpDown size={14} />
                                    </button>
                                    <div className="flex border border-slate-700 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`px-2 py-1.5 ${viewMode === 'grid' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400'}`}
                                        >
                                            <Grid3X3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`px-2 py-1.5 ${viewMode === 'list' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400'}`}
                                        >
                                            <List size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {viewMode === 'grid' ? (
                                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {processedResults.sorted.map((result) => {
                                        const item = result.item;
                                        const inWatchlist = watchlist.includes(item.id);
                                        const inCompare = compareItems.includes(item.id);

                                        return (
                                            <article key={item.id} className="border border-slate-700 rounded-xl bg-slate-900/50 overflow-hidden flex flex-col">
                                                <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-36 w-full object-cover" />
                                                <div className="p-3 space-y-3 flex-1 flex flex-col">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <a href={`/catalog/${item.slug}-${item.sku.toLowerCase()}`} className="text-sm font-medium text-slate-100 hover:text-blue-400 line-clamp-2">
                                                            {item.title}
                                                        </a>
                                                        <Badge variant={result.guaranteedFit ? 'success' : 'warning'} className="shrink-0">
                                                            {result.guaranteedFit ? 'Verified Fit' : 'Check Fit'}
                                                        </Badge>
                                                    </div>

                                                    <div className="text-xs text-slate-500">{item.sku} • {item.brand} • {item.placement}</div>
                                                    <div className="text-lg font-semibold text-slate-100">${item.price.toFixed(2)}</div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Badge variant="secondary" className="uppercase">{item.shippingType}</Badge>
                                                        <span>{formatLabel(item.availability)}</span>
                                                    </div>

                                                    <div className="mt-auto flex flex-wrap gap-2">
                                                        <button onClick={() => setQuickViewItem(item)} className="px-2 py-1.5 rounded border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-1">
                                                            <Eye size={12} /> Quick View
                                                        </button>
                                                        <button onClick={() => toggleCompare(item.id)} className={`px-2 py-1.5 rounded border text-xs inline-flex items-center gap-1 ${inCompare ? 'border-blue-500 text-blue-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                                                            <GitCompare size={12} /> {inCompare ? 'Comparing' : 'Compare'}
                                                        </button>
                                                        <button onClick={() => toggleWatchlist(item.id)} className={`px-2 py-1.5 rounded border text-xs inline-flex items-center gap-1 ${inWatchlist ? 'border-rose-500 text-rose-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                                                            <Heart size={12} /> {inWatchlist ? 'Saved' : 'Watchlist'}
                                                        </button>
                                                        {b2bMode && (
                                                            <button onClick={() => toggleBulkSelection(item.id)} className={`px-2 py-1.5 rounded border text-xs inline-flex items-center gap-1 ${selectedForBulk.includes(item.id) ? 'border-emerald-500 text-emerald-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                                                                <Columns3 size={12} /> {selectedForBulk.includes(item.id) ? 'Selected' : 'Bulk Select'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="border border-slate-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-slate-900/50 text-slate-400 font-medium">
                                            <tr>
                                                {b2bMode && (
                                                    <th className="p-3 w-12">
                                                        <input
                                                            type="checkbox"
                                                            checked={allVisibleSelected}
                                                            onChange={toggleSelectAllVisible}
                                                            className="rounded border-slate-700 bg-slate-900"
                                                        />
                                                    </th>
                                                )}
                                                <th className="p-3">Product</th>
                                                <th className="p-3">Compatibility</th>
                                                <th className="p-3">Price</th>
                                                <th className="p-3">Availability</th>
                                                <th className="p-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {processedResults.sorted.map((result) => {
                                                const item = result.item;
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-800/40">
                                                        {b2bMode && (
                                                            <td className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedForBulk.includes(item.id)}
                                                                    onChange={() => toggleBulkSelection(item.id)}
                                                                    className="rounded border-slate-700 bg-slate-900"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="p-3">
                                                            <div className="font-medium text-slate-200">{item.title}</div>
                                                            <div className="text-xs text-slate-500">{item.sku} • {item.brand}</div>
                                                        </td>
                                                        <td className="p-3">
                                                            <Badge variant={result.guaranteedFit ? 'success' : 'warning'}>
                                                                {result.guaranteedFit ? 'Verified Fit' : 'Check Fit'}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-3">${item.price.toFixed(2)}</td>
                                                        <td className="p-3">{formatLabel(item.availability)}</td>
                                                        <td className="p-3">
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setQuickViewItem(item)} className="px-2 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:bg-slate-800">Quick View</button>
                                                                <button onClick={() => toggleCompare(item.id)} className="px-2 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:bg-slate-800">Compare</button>
                                                                <button onClick={() => toggleWatchlist(item.id)} className="px-2 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:bg-slate-800">Watch</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {processedResults.sorted.length === 0 && (
                                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
                                    <Sparkles className="mx-auto text-slate-500 mb-3" size={20} />
                                    <h4 className="font-medium text-slate-200">No results match your current query</h4>
                                    <p className="text-xs text-slate-500 mt-1">Try a broader term or clear selected filters.</p>
                                </div>
                            )}
                        </section>
                    </div>
                </CardContent>
            </Card>

            {compareItems.length > 0 && (
                <div className="fixed bottom-5 right-5 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 z-30">
                    <GitCompare size={16} className="text-blue-400" />
                    <span className="text-sm text-slate-200">Compare {compareItems.length}/4 selected</span>
                    <button onClick={() => setCompareItems([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
                </div>
            )}

            {b2bMode && selectedForBulk.length > 0 && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-full px-5 py-3 shadow-xl z-30 flex items-center gap-3">
                    <span className="text-sm text-slate-200">{selectedForBulk.length} items selected</span>
                    <button className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs inline-flex items-center gap-2">
                        <ShoppingCart size={12} /> Bulk Add to Cart
                    </button>
                    <button onClick={() => setSelectedForBulk([])} className="text-xs text-slate-400 hover:text-slate-200">Clear</button>
                </div>
            )}

            {quickViewItem && (
                <div className="fixed inset-0 z-40 bg-slate-950/80 p-6 flex items-center justify-center">
                    <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-100">Quick View</h3>
                            <button onClick={() => setQuickViewItem(null)} className="text-sm text-slate-400 hover:text-slate-100">Close</button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-0">
                            <img src={quickViewItem.imageUrl} alt={quickViewItem.title} loading="lazy" className="w-full h-full object-cover min-h-56" />
                            <div className="p-4 space-y-3">
                                <h4 className="text-lg font-semibold text-slate-100">{quickViewItem.title}</h4>
                                <p className="text-sm text-slate-400">{quickViewItem.description}</p>
                                <div className="text-sm text-slate-500">SKU: <span className="text-slate-300 font-mono">{quickViewItem.sku}</span></div>
                                <div className="text-sm text-slate-500">OEM: <span className="text-slate-300 font-mono">{quickViewItem.oemPartNumbers.join(', ')}</span></div>
                                <div className="text-sm text-slate-500">Aftermarket: <span className="text-slate-300 font-mono">{quickViewItem.aftermarketPartNumbers.join(', ')}</span></div>
                                <div className="text-xl font-semibold text-slate-100">${quickViewItem.price.toFixed(2)}</div>
                                <div className="flex gap-2">
                                    <button className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm inline-flex items-center gap-2">
                                        <ShoppingCart size={14} /> Add to Cart
                                    </button>
                                    <button className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm inline-flex items-center gap-2">
                                        <Check size={14} /> Verify Fit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
