import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Barcode, AlertCircle, Loader2, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { getListingsByVin, type VinListingsResponse } from '../../lib/fitmentVinListingsApi';

function isValidVin(v: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(v.trim());
}

export default function VinListingsPage() {
  const [vinInput, setVinInput] = useState('');
  const [submittedVin, setSubmittedVin] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');

  const { data, isLoading, isError, error } = useQuery<VinListingsResponse>({
    queryKey: ['vin-listings', submittedVin],
    queryFn: () => getListingsByVin(submittedVin ?? ''),
    enabled: !!submittedVin,
    retry: 1,
  });

  const handleSubmit = () => {
    const vin = vinInput.trim().toUpperCase();
    if (!isValidVin(vin)) {
      setLocalError('Enter a valid 17-character VIN (letters and numbers, excluding I, O, Q).');
      setSubmittedVin(null);
      return;
    }
    setLocalError('');
    setSubmittedVin(vin);
  };

  const vehicleSummary = data?.vehicle
    ? `${data.vehicle.year || '—'} ${data.vehicle.make || ''} ${data.vehicle.model || ''}`.trim()
    : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">VIN Parts Lookup</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Enter a VIN to see all matching part listings.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Vehicle VIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vinInput}
                    onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                    placeholder="1HGCV1F34LA000001"
                    maxLength={17}
                    className="flex-1 bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-200 placeholder:text-slate-500 dark:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none font-mono tracking-wider"
                  />
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    <Barcode size={16} /> Lookup
                  </button>
                </div>
                {localError && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} /> {localError}
                  </p>
                )}
              </div>
            </div>
            {submittedVin && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Searching listings for VIN <span className="font-mono text-slate-500 dark:text-slate-300">{submittedVin}</span>
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
              <Loader2 size={20} className="animate-spin" /> Fetching listings for VIN…
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-red-400">
              <AlertCircle size={20} />
              <span>
                Failed to fetch listings for this VIN.{' '}
                <span className="text-slate-400 dark:text-slate-400 text-xs">
                  {(error as any)?.body?.message || (error as Error).message}
                </span>
              </span>
            </div>
          )}

          {!isLoading && !isError && submittedVin && !data && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
              <AlertCircle size={20} /> No data returned for this VIN.
            </div>
          )}

          {!isLoading && data && (
            <div className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white/60 dark:bg-slate-900/60 px-3 py-3 sm:px-4 sm:py-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">
                    Vehicle
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {vehicleSummary || 'Unknown vehicle'}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    VIN: <span className="font-mono">{data.vin}</span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Match mode:{' '}
                    <span className="text-slate-500 dark:text-slate-300">
                      {data.matchStrategy === 'fitment' ? 'Exact fitment mapping' : 'Vehicle text fallback'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-400 flex flex-wrap gap-3">
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-200">{data.totalListings}</span>{' '}
                    listing{data.totalListings === 1 ? '' : 's'}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-200">{data.totalFitments}</span>{' '}
                    fitment record{data.totalFitments === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {data.listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                  <Search size={32} className="mb-2 opacity-50" />
                  <p className="text-sm text-center">
                    No part listings found that match this VIN yet.
                  </p>
                </div>
              ) : (
                <div className="relative w-full overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-white/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-400 font-medium">
                      <tr>
                        <th className="p-3 sm:p-4">Listing</th>
                        <th className="p-3 sm:p-4">Brand / Part #</th>
                        <th className="p-3 sm:p-4">Category</th>
                        <th className="p-3 sm:p-4">Price</th>
                        <th className="p-3 sm:p-4">Qty</th>
                        <th className="p-3 sm:p-4">Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.listings.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-100/50 dark:bg-slate-800/50 transition-colors">
                          <td className="p-3 sm:p-4">
                            <div className="flex items-center gap-3">
                              {row.itemPhotoUrl ? (
                                <img
                                  src={row.itemPhotoUrl}
                                  alt={row.title ?? ''}
                                  className="w-12 h-12 rounded-md object-cover bg-slate-800 shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                                  No Image
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {row.title || 'Untitled listing'}
                                </div>
                                <div className="text-xs text-slate-400 dark:text-slate-500">
                                  SKU:{' '}
                                  <span className="font-mono">
                                    {row.customLabelSku || '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-slate-600 dark:text-slate-200">
                              {row.cBrand || <span className="text-slate-400 dark:text-slate-500">—</span>}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              MPN:{' '}
                              <span className="font-mono">
                                {row.cManufacturerPartNumber || '—'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              OEM:{' '}
                              <span className="font-mono">
                                {row.cOeOemPartNumber || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-slate-600 dark:text-slate-200">
                              {row.categoryName || <span className="text-slate-400 dark:text-slate-500">—</span>}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              ID: {row.categoryId || '—'}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {row.startPrice ? `$${row.startPrice}` : '—'}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-slate-600 dark:text-slate-200">
                              {row.quantity || '—'}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-xs inline-flex px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 dark:text-slate-300">
                              {row.conditionId || '—'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

