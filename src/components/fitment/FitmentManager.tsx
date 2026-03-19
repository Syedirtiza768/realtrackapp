import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Check,
    X,
    Filter,
    Download,
    Plus,
    Search,
    MoreHorizontal,
    Loader2,
    Barcode,
    AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import SearchableSelect, { type SelectOption } from '../ui/SearchableSelect';
import {
    getListingFitments,
    deleteFitment,
    verifyFitment,
    getEbayMakes,
    getEbayModels,
    getPropertyValues,
    buildCompatibility,
    decodeVin,
    vinToEbayFilter,
    addListingFitment,
    type PartFitmentRow,
    type FitmentSelection,
} from '../../lib/fitmentApi';

/* ── Constants ── */
const CATEGORY_ID = '6000'; // eBay Motors Parts & Accessories
const PAGE_SIZE = 50;

export interface FitmentManagerProps {
  listingId?: string;
}

export default function FitmentManager({ listingId = '' }: FitmentManagerProps) {
    const queryClient = useQueryClient();

    /* ── State ── */
    const [selected, setSelected] = useState<string[]>([]);
    const [filterText, setFilterText] = useState('');
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [vinInput, setVinInput] = useState('');
    const [vinError, setVinError] = useState('');

    // Cascading selections
    const [makeSelection, setMakeSelection] = useState<SelectOption | null>(null);
    const [modelSelection, setModelSelection] = useState<SelectOption | null>(null);
    const [yearSelection, setYearSelection] = useState<SelectOption | null>(null);
    const [trimSelection, setTrimSelection] = useState<SelectOption | null>(null);
    const [engineSelection, setEngineSelection] = useState<SelectOption | null>(null);

    /* ── Queries ── */

    const { data: fitments = [], isLoading, error: listError } = useQuery({
        queryKey: ['fitments', listingId],
        queryFn: () => getListingFitments(listingId),
        enabled: !!listingId,
    });

    /* ── Mutations ── */

    const deleteMut = useMutation({
        mutationFn: deleteFitment,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fitments', listingId] }),
    });

    const verifyMut = useMutation({
        mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
            verifyFitment(id, verified),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fitments', listingId] }),
    });

    const addMut = useMutation({
        mutationFn: (data: Parameters<typeof addListingFitment>[1]) =>
            addListingFitment(listingId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fitments', listingId] });
            resetAddForm();
        },
    });

    /* ── Filtered data ── */

    const filteredFitments = useMemo(() => {
        if (!filterText.trim()) return fitments;
        const lower = filterText.toLowerCase();
        return fitments.filter((row) => {
            const text = [
                row.make?.name,
                row.model?.name,
                row.submodel?.name,
                row.engine?.name,
                String(row.yearStart),
                String(row.yearEnd),
            ].join(' ').toLowerCase();
            return text.includes(lower);
        });
    }, [fitments, filterText]);

    /* ── Selection helpers ── */

    const toggleSelect = (id: string) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
        );
    };

    const toggleAll = () => {
        if (selected.length === filteredFitments.length) {
            setSelected([]);
        } else {
            setSelected(filteredFitments.map((d) => d.id));
        }
    };

    /* ── SearchableSelect fetch callbacks ── */

    const fetchMakes = useCallback(
        async (query: string, page: number) => {
            const res = await getEbayMakes(query || undefined, PAGE_SIZE, page * PAGE_SIZE, CATEGORY_ID);
            return res;
        },
        [],
    );

    const fetchModels = useCallback(
        async (query: string, page: number) => {
            if (!makeSelection) return { options: [], hasMore: false };
            const res = await getEbayModels(
                makeSelection.value,
                query || undefined,
                PAGE_SIZE,
                page * PAGE_SIZE,
                CATEGORY_ID,
            );
            return res;
        },
        [makeSelection],
    );

    const fetchYears = useCallback(
        async (query: string, page: number) => {
            if (!makeSelection || !modelSelection) return { options: [], hasMore: false };
            const res = await getPropertyValues(
                CATEGORY_ID,
                'Year',
                { Make: makeSelection.value, Model: modelSelection.value },
                query || undefined,
                PAGE_SIZE,
                page * PAGE_SIZE,
            );
            return res;
        },
        [makeSelection, modelSelection],
    );

    const fetchTrims = useCallback(
        async (query: string, page: number) => {
            if (!makeSelection || !modelSelection || !yearSelection) return { options: [], hasMore: false };
            const res = await getPropertyValues(
                CATEGORY_ID,
                'Trim',
                { Make: makeSelection.value, Model: modelSelection.value, Year: yearSelection.value },
                query || undefined,
                PAGE_SIZE,
                page * PAGE_SIZE,
            );
            return res;
        },
        [makeSelection, modelSelection, yearSelection],
    );

    const fetchEngines = useCallback(
        async (query: string, page: number) => {
            if (!makeSelection || !modelSelection || !yearSelection) return { options: [], hasMore: false };
            const filters: Record<string, string> = {
                Make: makeSelection.value,
                Model: modelSelection.value,
                Year: yearSelection.value,
            };
            if (trimSelection) filters['Trim'] = trimSelection.value;
            const res = await getPropertyValues(
                CATEGORY_ID,
                'Engine',
                filters,
                query || undefined,
                PAGE_SIZE,
                page * PAGE_SIZE,
            );
            return res;
        },
        [makeSelection, modelSelection, yearSelection, trimSelection],
    );

    /* ── Add fitment from selections ── */

    const handleAddFromSelections = async () => {
        if (!makeSelection || !modelSelection || !yearSelection) return;

        const selection: FitmentSelection = {
            make: makeSelection.value,
            model: modelSelection.value,
            year: yearSelection.value,
            trim: trimSelection?.value,
            engine: engineSelection?.value,
        };

        // Build eBay compatibility (for future use) and also add to local fitments
        try {
            await buildCompatibility([selection]);
        } catch {
            // Non-blocking — compatibility build is optional
        }

        // We add through the existing CRUD endpoint using numeric IDs.
        // For now, we pass the year as both start and end.
        const yearNum = parseInt(yearSelection.value, 10);
        addMut.mutate({
            makeId: parseInt(makeSelection.value, 10) || 0,
            modelId: parseInt(modelSelection.value, 10) || 0,
            yearStart: yearNum || new Date().getFullYear(),
            yearEnd: yearNum || new Date().getFullYear(),
            source: 'manual',
            confidence: 100,
        });
    };

    /* ── VIN decode → auto-fill ── */

    const handleVinLookup = async () => {
        const vin = vinInput.trim().toUpperCase();
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
            setVinError('Enter a valid 17-character VIN');
            return;
        }
        setVinError('');

        try {
            const [decoded, filter] = await Promise.all([
                decodeVin(vin),
                vinToEbayFilter(vin),
            ]);

            if (filter.Make) setMakeSelection({ label: filter.Make, value: filter.Make });
            if (filter.Model) setModelSelection({ label: filter.Model, value: filter.Model });
            if (filter.Year) setYearSelection({ label: filter.Year, value: filter.Year });
            if (decoded.trim) setTrimSelection({ label: decoded.trim, value: decoded.trim });
        } catch {
            setVinError('VIN lookup failed. Please try again.');
        }
    };

    /* ── Reset add form ── */

    const resetAddForm = () => {
        setMakeSelection(null);
        setModelSelection(null);
        setYearSelection(null);
        setTrimSelection(null);
        setEngineSelection(null);
        setVinInput('');
        setVinError('');
        setShowAddPanel(false);
    };

    /* ── Bulk actions ── */

    const handleBulkVerify = () => {
        selected.forEach((id) => verifyMut.mutate({ id, verified: true }));
        setSelected([]);
    };

    const handleBulkDelete = () => {
        selected.forEach((id) => deleteMut.mutate(id));
        setSelected([]);
    };

    /* ── Row helpers ── */

    const formatVehicle = (row: PartFitmentRow) => {
        const yearRange = row.yearStart === row.yearEnd
            ? String(row.yearStart)
            : `${row.yearStart}–${row.yearEnd}`;
        return `${yearRange} ${row.make?.name ?? '?'} ${row.model?.name ?? '?'}`;
    };

    const confidenceColor = (c: number | null) => {
        if (!c) return 'text-slate-500';
        if (c > 90) return 'text-emerald-500';
        if (c > 50) return 'text-amber-500';
        return 'text-red-500';
    };

    const confidenceBg = (c: number | null) => {
        if (!c) return 'bg-slate-700';
        if (c > 90) return 'bg-emerald-500';
        if (c > 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Fitment Manager</h2>
                    <p className="text-slate-500 text-sm">
                        {fitments.length} fitment{fitments.length !== 1 ? 's' : ''} assigned
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                        <Download size={16} /> Import/Export
                    </button>
                    <button
                        onClick={() => setShowAddPanel(!showAddPanel)}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
                    >
                        <Plus size={16} /> Add Fitment
                    </button>
                </div>
            </div>

            {/* ── Add Fitment Panel ── */}
            {showAddPanel && (
                <Card>
                    <CardHeader className="border-b border-slate-800 pb-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-200">Add Vehicle Fitment</h3>
                            <button onClick={resetAddForm} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        {/* VIN Lookup */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                                    Quick Fill via VIN
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={vinInput}
                                        onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                                        placeholder="Enter 17-character VIN..."
                                        maxLength={17}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none font-mono tracking-wider"
                                    />
                                    <button
                                        onClick={handleVinLookup}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300"
                                    >
                                        <Barcode size={16} /> Decode
                                    </button>
                                </div>
                                {vinError && (
                                    <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                                        <AlertCircle size={12} /> {vinError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Cascading Selects */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <SearchableSelect
                                label="Make"
                                fetchOptions={fetchMakes}
                                value={makeSelection}
                                onChange={setMakeSelection}
                                placeholder="Search makes..."
                            />
                            <SearchableSelect
                                label="Model"
                                fetchOptions={fetchModels}
                                value={modelSelection}
                                onChange={setModelSelection}
                                placeholder="Search models..."
                                dependsOn={makeSelection?.value}
                                disabled={!makeSelection}
                            />
                            <SearchableSelect
                                label="Year"
                                fetchOptions={fetchYears}
                                value={yearSelection}
                                onChange={setYearSelection}
                                placeholder="Select year..."
                                dependsOn={modelSelection?.value}
                                disabled={!modelSelection}
                            />
                            <SearchableSelect
                                label="Trim"
                                fetchOptions={fetchTrims}
                                value={trimSelection}
                                onChange={setTrimSelection}
                                placeholder="Optional trim..."
                                dependsOn={yearSelection?.value}
                                disabled={!yearSelection}
                            />
                            <SearchableSelect
                                label="Engine"
                                fetchOptions={fetchEngines}
                                value={engineSelection}
                                onChange={setEngineSelection}
                                placeholder="Optional engine..."
                                dependsOn={yearSelection?.value}
                                disabled={!yearSelection}
                            />
                        </div>

                        {/* Add Button */}
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={resetAddForm}
                                className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddFromSelections}
                                disabled={!makeSelection || !modelSelection || !yearSelection || addMut.isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm"
                            >
                                {addMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Add Fitment
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Fitment Table ── */}
            <Card>
                <CardHeader className="border-b border-slate-800 pb-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 w-full sm:max-w-sm lg:max-w-md">
                            <Search size={16} className="text-slate-500 shrink-0" />
                            <input
                                type="text"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                placeholder="Filter by Make, Model, or Year..."
                                className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 border border-slate-700 rounded-lg hover:bg-slate-800 text-slate-400">
                                <Filter size={16} />
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                            <Loader2 size={20} className="animate-spin" /> Loading fitments...
                        </div>
                    )}

                    {listError && (
                        <div className="flex items-center justify-center py-12 gap-2 text-red-400">
                            <AlertCircle size={20} /> Failed to load fitments
                        </div>
                    )}

                    {!isLoading && !listError && filteredFitments.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <Search size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">{fitments.length === 0 ? 'No fitments yet. Click "Add Fitment" to begin.' : 'No fitments match your filter.'}</p>
                        </div>
                    )}

                    {!isLoading && filteredFitments.length > 0 && (
                        <>
                            {/* Desktop table view (md+) */}
                            <div className="hidden md:block relative w-full overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-slate-900/50 text-slate-400 font-medium">
                                        <tr>
                                            <th className="p-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-700 bg-slate-800"
                                                    checked={selected.length === filteredFitments.length && filteredFitments.length > 0}
                                                    onChange={toggleAll}
                                                />
                                            </th>
                                            <th className="p-4">Vehicle</th>
                                            <th className="p-4">Submodel / Engine</th>
                                            <th className="p-4">Source</th>
                                            <th className="p-4">Confidence</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {filteredFitments.map((row) => (
                                            <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-700 bg-slate-800"
                                                        checked={selected.includes(row.id)}
                                                        onChange={() => toggleSelect(row.id)}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-slate-200">{formatVehicle(row)}</div>
                                                    <div className="text-xs text-slate-500">ID: {row.id.slice(0, 8)}…</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-slate-300">{row.submodel?.name ?? '—'}</div>
                                                    <div className="text-xs text-slate-500">{row.engine?.name ?? '—'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 capitalize">
                                                        {row.source.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${confidenceBg(row.confidence)}`}
                                                                style={{ width: `${row.confidence ?? 0}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs font-medium ${confidenceColor(row.confidence)}`}>
                                                            {row.confidence ?? '—'}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        row.verified
                                                            ? 'bg-emerald-500/10 text-emerald-400'
                                                            : 'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                        {row.verified ? 'Verified' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            title={row.verified ? 'Unverify' : 'Verify'}
                                                            onClick={() => verifyMut.mutate({ id: row.id, verified: !row.verified })}
                                                            className="p-1.5 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            title="Delete"
                                                            onClick={() => deleteMut.mutate(row.id)}
                                                            className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                        <button className="p-1.5 hover:bg-slate-800 text-slate-400 rounded">
                                                            <MoreHorizontal size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile card view (<md) */}
                            <div className="md:hidden divide-y divide-slate-800">
                                {filteredFitments.map((row) => (
                                    <div key={row.id} className="p-3 sm:p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-700 bg-slate-800 mt-1"
                                                    checked={selected.includes(row.id)}
                                                    onChange={() => toggleSelect(row.id)}
                                                />
                                                <div>
                                                    <div className="font-medium text-slate-200 text-sm">{formatVehicle(row)}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {row.submodel?.name ?? '—'} · {row.engine?.name ?? '—'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => verifyMut.mutate({ id: row.id, verified: !row.verified })}
                                                    className="p-1.5 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteMut.mutate(row.id)}
                                                    className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded"
                                                >
                                                    <X size={14} />
                                                </button>
                                                <button className="p-1.5 hover:bg-slate-800 text-slate-400 rounded">
                                                    <MoreHorizontal size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-6">
                                            <div className="h-2 flex-1 max-w-32 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${confidenceBg(row.confidence)}`}
                                                    style={{ width: `${row.confidence ?? 0}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-medium ${confidenceColor(row.confidence)}`}>
                                                {row.confidence ?? '—'}%
                                            </span>
                                            <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                row.verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                            }`}>
                                                {row.verified ? 'Verified' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Bulk Actions Bar ── */}
            {selected.length > 0 && (
                <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 shadow-xl rounded-full px-4 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4 animate-in slide-in-from-bottom-4 z-40 max-w-[90vw]">
                    <span className="text-xs sm:text-sm font-medium text-slate-200 whitespace-nowrap">{selected.length} selected</span>
                    <div className="h-4 w-px bg-slate-700" />
                    <button
                        onClick={handleBulkVerify}
                        className="text-xs sm:text-sm text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap"
                    >
                        Verify Selected
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        className="text-xs sm:text-sm text-red-400 hover:text-red-300 font-medium whitespace-nowrap"
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>
    );
}
