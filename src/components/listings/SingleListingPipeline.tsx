import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  FileText,
  Loader2,
  PackagePlus,
  ScanLine,
  Users,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  useAddIntakePart,
  usePartLookup,
  useSingleListingBrands,
  type PartLookupResult,
} from '../../lib/pipelineApi';
import { listTeams } from '../../lib/teamsApi';
import {
  loadJson,
  saveJson,
  STORAGE_KEYS,
  type ListingFormPrefs,
} from '../../lib/persistence';

type PartType = 'OEM' | 'Aftermarket' | 'Salvage';
type ConditionId = '1000' | '3000';

const PART_TYPES: { value: PartType; label: string }[] = [
  { value: 'OEM', label: 'OEM' },
  { value: 'Aftermarket', label: 'Aftermarket' },
  { value: 'Salvage', label: 'Salvage' },
];

const CONDITIONS: { value: ConditionId; label: string }[] = [
  { value: '1000', label: 'New' },
  { value: '3000', label: 'Used' },
];

function partNumberHint(partType: PartType): string {
  if (partType === 'Aftermarket') {
    return 'Manufacturer part number — not casting / stamped marks.';
  }
  if (partType === 'Salvage') {
    return 'OEM or stamped number from the donor part.';
  }
  return 'OE or manufacturer number — not casting / stamped marks.';
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'ready'; title: string; category?: string; note?: string; confidence?: string }
  | { status: 'lookup'; partial?: PartLookupResult }
  | { status: 'saved'; sku: string };

export default function SingleListingPipeline() {
  const addPartMutation = useAddIntakePart();
  const partLookupMutation = usePartLookup();
  const { data: brandsData } = useSingleListingBrands();
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: ({ signal }) => listTeams(signal),
  });

  const [partType, setPartType] = useState<PartType>(() => {
    const prefs = loadJson<ListingFormPrefs>(STORAGE_KEYS.listingFormPrefs, {});
    return prefs.partType ?? 'OEM';
  });
  const [conditionId, setConditionId] = useState<ConditionId>(() => {
    const prefs = loadJson<ListingFormPrefs>(STORAGE_KEYS.listingFormPrefs, {});
    return prefs.conditionId ?? '3000';
  });
  const [partNumber, setPartNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [price, setPrice] = useState('100');
  const [quantity, setQuantity] = useState('1');
  const [teamId, setTeamId] = useState<string>(() => {
    const prefs = loadJson<ListingFormPrefs>(STORAGE_KEYS.listingFormPrefs, {});
    return prefs.teamId ?? '';
  });
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lookupWarning, setLookupWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });

  const brands = brandsData?.brands ?? [];

  useEffect(() => {
    if (partType === 'Salvage') {
      setConditionId('3000');
    }
  }, [partType]);

  useEffect(() => {
    saveJson<ListingFormPrefs>(STORAGE_KEYS.listingFormPrefs, { partType, conditionId, teamId });
  }, [partType, conditionId, teamId]);

  const isAftermarket = partType === 'Aftermarket';

  const mandatoryFilled = useMemo(() => {
    const pn = partNumber.trim();
    const pr = parseFloat(price);
    const identifier = isAftermarket ? brand.trim() : vehicleMake.trim();
    return Boolean(pn && identifier && Number.isFinite(pr) && pr > 0);
  }, [partNumber, brand, vehicleMake, price, isAftermarket]);

  const resetForm = useCallback(() => {
    setPartNumber('');
    setBrand('');
    setVehicleMake('');
    setPrice('100');
    setQuantity('1');
    setNotes('');
    setLocation('');
    const prefs = loadJson<ListingFormPrefs>(STORAGE_KEYS.listingFormPrefs, {});
    setPartType(prefs.partType ?? 'OEM');
    setConditionId(prefs.conditionId ?? '3000');
    setError(null);
    setLookupWarning(null);
    setPreview({ status: 'idle' });
  }, []);

  const handleProcessSku = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError(null);
      setLookupWarning(null);

      const pn = partNumber.trim();
      const br = brand.trim();
      const vm = vehicleMake.trim();
      const pr = parseFloat(price);
      const qty = parseInt(quantity, 10);

      if (!pn) {
        setError('Part number is required');
        return;
      }
      if (isAftermarket) {
        if (!br) {
          setError('Brand is required');
          return;
        }
      } else {
        if (!vm) {
          setError('Vehicle make is required');
          return;
        }
      }
      if (!Number.isFinite(pr) || pr <= 0) {
        setError('Enter a valid price greater than zero');
        return;
      }
      if (!Number.isFinite(qty) || qty < 1) {
        setError('Quantity must be at least 1');
        return;
      }

      // For OEM/Salvage, use vehicleMake as brand when brand is empty
      const effectiveBrand = isAftermarket ? br : (br || vm);

      let lookup: PartLookupResult | undefined;
      try {
        setPreview({ status: 'lookup' });
        lookup = await partLookupMutation.mutateAsync({
          partNumber: pn,
          brand: effectiveBrand,
        });
        setPreview({
          status: 'ready',
          title: lookup.partName?.trim() || `${br} ${pn}`.slice(0, 80),
          category: lookup.category,
          note: lookup.note,
          confidence: lookup.confidence,
        });
      } catch {
        setLookupWarning(
          'AI lookup unavailable — part will be saved with a placeholder title. Add photos on Inventory, then Fetch details.',
        );
        setPreview({
          status: 'ready',
          title: `${effectiveBrand} ${pn}`.slice(0, 80),
        });
      }

      try {
        const userNotes = notes.trim();
        const aiNote = lookup?.note?.trim();
        const combinedDescription = [userNotes, aiNote].filter(Boolean).join('\n\n') || undefined;

        const result = await addPartMutation.mutateAsync({
          partNumber: pn,
          brand: effectiveBrand,
          partType,
          conditionId,
          vehicleMake: vm || undefined,
          price: pr,
          quantity: qty,
          title: lookup?.partName?.trim(),
          categoryName: lookup?.category?.trim(),
          description: combinedDescription,
          teamId: teamId || undefined,
          location: location.trim() || undefined,
        });

        const savedSku = result.listing.customLabelSku ?? '';
        setPartNumber('');
        setBrand('');
        setVehicleMake('');
        setPrice('100');
        setQuantity('1');
        setNotes('');
        setLocation('');
        const savedPrefs = loadJson<ListingFormPrefs>(STORAGE_KEYS.listingFormPrefs, {});
        setPartType(savedPrefs.partType ?? 'OEM');
        setConditionId(savedPrefs.conditionId ?? '3000');
        setLookupWarning(null);
        setError(null);
        setPreview({ status: 'saved', sku: savedSku });
      } catch (err) {
        setPreview({ status: 'idle' });
        setError(err instanceof Error ? err.message : 'Failed to save part');
      }
    },
    [
      partNumber,
      brand,
      price,
      quantity,
      partType,
      conditionId,
      vehicleMake,
      teamId,
      notes,
      location,
      isAftermarket,
      partLookupMutation,
      addPartMutation,
    ],
  );

  const inputClassName =
    'w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm';

  const toggleBtn = (active: boolean) =>
    `flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`;

  const isBusy = addPartMutation.isPending || partLookupMutation.isPending;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <PackagePlus className="h-7 w-7 text-blue-400" />
          Add Part
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          GridConnect-style intake — photos optional here; add them on{' '}
          <Link to="/inventory" className="text-blue-400 hover:underline">
            Inventory
          </Link>{' '}
          before Fetch details
        </p>
      </div>

      <form onSubmit={handleProcessSku} className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Part details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                SKU
              </label>
              <input
                type="text"
                value="Auto-assigned on save"
                readOnly
                className={`${inputClassName} bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 font-mono cursor-not-allowed`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Part type <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-1.5">
                {PART_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPartType(opt.value)}
                    className={toggleBtn(partType === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Part number <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. 8V0615601A"
                  className={`${inputClassName} pl-9`}
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                {partNumberHint(partType)}
              </p>
            </div>

            {isAftermarket ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Brand <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    list="add-part-brand-options"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Select brand…"
                    className={inputClassName}
                    required
                  />
                  <datalist id="add-part-brand-options">
                    {brands.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Vehicle make
                  </label>
                  <input
                    type="text"
                    list="add-part-make-options"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. Toyota"
                    className={inputClassName}
                  />
                  <datalist id="add-part-make-options">
                    {brands.map((b) => (
                      <option key={`make-${b}`} value={b} />
                    ))}
                  </datalist>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Vehicle make <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  list="add-part-make-options"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  placeholder="Select vehicle make…"
                  className={inputClassName}
                  required
                />
                <datalist id="add-part-make-options">
                  {brands.map((b) => (
                    <option key={`make-${b}`} value={b} />
                  ))}
                </datalist>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Condition <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-1.5 max-w-xs">
                {CONDITIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConditionId(opt.value)}
                    className={toggleBtn(conditionId === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {partType === 'Salvage' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Salvage defaults to Used
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Team
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={teamsLoading || teams.length === 0}
                  className={`${inputClassName} pl-9 disabled:opacity-50`}
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {teams.length === 0 && !teamsLoading && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                  Create teams in{' '}
                  <Link to="/settings/teams" className="text-blue-400 hover:underline">
                    Settings → Teams
                  </Link>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes — condition details, cross-references, fitment notes…"
                rows={3}
                className={`${inputClassName} resize-none`}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                These notes will be included in the listing description and can be edited later on Inventory.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Storage location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Aisle 3, Bin B12, Shelf 2C"
                  className={`${inputClassName} pl-9`}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                Optional — helps locate the part in the warehouse.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Listing details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Price (USD) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className={`${inputClassName} pl-7`}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            {lookupWarning && (
              <div className="flex items-start gap-2 text-amber-300 text-sm bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {lookupWarning}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => void resetForm()}
                disabled={isBusy}
                className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isBusy || !mandatoryFilled}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {isBusy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <ScanLine size={16} />
                    Process SKU (Enter)
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-[320px]">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Generated listing</CardTitle>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  preview.status === 'saved'
                    ? 'bg-emerald-400'
                    : preview.status === 'ready' || preview.status === 'lookup'
                      ? 'bg-blue-400 animate-pulse'
                      : mandatoryFilled
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
                }`}
              />
              {preview.status === 'saved'
                ? 'Saved'
                : preview.status === 'lookup'
                  ? 'Looking up…'
                  : preview.status === 'ready'
                    ? 'Preview ready'
                    : mandatoryFilled
                      ? 'Ready to process'
                      : 'Awaiting input'}
            </span>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {preview.status === 'saved' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-6">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Part saved as{' '}
                  <span className="font-mono font-semibold text-emerald-400">{preview.sku}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  Add photos on Inventory, then Fetch details and Send to pipeline.
                </p>
                <Link
                  to="/inventory"
                  className="text-sm text-blue-400 hover:underline font-medium"
                >
                  Open Inventory →
                </Link>
              </div>
            ) : preview.status === 'ready' || preview.status === 'lookup' ? (
              <div className="space-y-4 flex-1">
                {preview.status === 'lookup' && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Identifying part…
                  </div>
                )}
                {preview.status === 'ready' && (
                  <>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Title
                      </p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                        {preview.title}
                      </p>
                    </div>
                    {preview.category && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Category
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{preview.category}</p>
                      </div>
                    )}
                    {preview.note && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Seller notes
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {preview.note}
                        </p>
                      </div>
                    )}
                    {preview.confidence && (
                      <p className="text-[11px] text-slate-500">
                        AI confidence:{' '}
                        <span className="capitalize">{preview.confidence}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-8 text-center">
                <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Your generated listing will appear here
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-[240px]">
                  Fill part number, {isAftermarket ? 'brand' : 'vehicle make'}, type, condition, and price — then Process SKU
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
