import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Barcode, AlertCircle, Loader2, Search, Download } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { getListingsByVin, exportDbListingsByVin, type VinListingsResponse } from '../../lib/fitmentVinListingsApi';

function isValidVin(v: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(v.trim());
}

export default function VinListingsPage() {
  const [vinInput, setVinInput] = useState('');
  const [submittedVin, setSubmittedVin] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    if (!submittedVin) return;
    setExporting(true);
    try {
      await exportDbListingsByVin(submittedVin);
    } catch {
      // error handled by download
    } finally {
      setExporting(false);
    }
  };

  const vehicleSummary = data?.vehicle
    ? `${data.vehicle.year || '?'} ${data.vehicle.make || ''} ${data.vehicle.model || ''} ${data.vehicle.trim || ''}`.trim()
    : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">VIN Parts Lookup</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Enter a VIN to see all matching part listings.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Vehicle VIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vinInput}
                    onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                    placeholder="1HGCV1F34LA000001"
                    maxLength={17}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none font-mono tracking-wider"
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Searching listings for VIN <span className="font-mono text-slate-500 dark:text-slate-300">{submittedVin}</span>
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 size={20} className="animate-spin" /> Fetching listings for VIN...
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-red-400">
              <AlertCircle size={20} />
              <span>
                Failed to fetch listings for this VIN.{' '}
                <span className="text-slate-500 dark:text-slate-400 text-xs">
                  {(error as any)?.body?.message || (error as Error).message}
                </span>
              </span>
            </div>
          )}

          {!isLoading && !isError && submittedVin && !data && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-slate-400">
              <AlertCircle size={20} /> No data returned for this VIN.
            </div>
          )}

          {!isLoading && data && (
            <div className="p-4 space-y-4">
              {/* Vehicle summary card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white/60 dark:bg-slate-900/60 px-3 py-3 sm:px-4 sm:py-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5">
                    Vehicle
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {vehicleSummary || 'Unknown vehicle'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    VIN: <span className="font-mono">{data.vin}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Match mode:{' '}
                    <span className="text-slate-500 dark:text-slate-300">
                      {data.matchStrategy === 'fitment'
                        ? 'Exact fitment mapping'
                        : data.matchStrategy === 'ai_enriched'
                          ? 'AI-enhanced search'
                          : data.matchStrategy === 'ebay_browse'
                            ? 'eBay marketplace search'
                            : 'Vehicle text fallback'}
                    </span>
                    {data.vehicle.aiEnriched && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        AI Enriched
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-200">{data.totalListings}</span>{' '}
                    listing{data.totalListings === 1 ? '' : 's'}
                  </span>
                  <span className="hidden sm:inline">&middot;</span>
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-200">{data.totalFitments}</span>{' '}
                    fitment record{data.totalFitments === 1 ? '' : 's'}
                  </span>
                  {data.totalListings > 0 && (
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium"
                    >
                      <Download size={12} />
                      {exporting ? 'Exporting...' : 'Export XLSX'}
                    </button>
                  )}
                </div>
              </div>

              {/* AI-enriched vehicle specifications */}
              {data.vehicle.aiEnriched && data.vehicle.aiData && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white/60 dark:bg-slate-900/60 px-3 py-3 sm:px-4 sm:py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                    Vehicle Specifications
                  </div>
                  {data.vehicle.aiData.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                      {data.vehicle.aiData.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {data.vehicle.bodyClass && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Body</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.bodyClass}</div>
                      </div>
                    )}
                    {data.vehicle.driveType && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Drive</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.driveType}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.engineDescription && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Engine</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.engineDescription}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.transmission && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Transmission</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.transmission}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.horsepower && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Horsepower</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.horsepower}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.torque && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Torque</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.torque}</div>
                      </div>
                    )}
                    {data.vehicle.fuelType && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Fuel</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.fuelType}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.mpg && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">MPG</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.mpg}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.seatingCapacity && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Seating</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.seatingCapacity}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.wheelbase && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Wheelbase</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.wheelbase}</div>
                      </div>
                    )}
                    {data.vehicle.aiData.curbWeight && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Curb Weight</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.aiData.curbWeight}</div>
                      </div>
                    )}
                    {data.vehicle.plantCountry && (
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Made In</div>
                        <div className="text-sm text-slate-700 dark:text-slate-200">{data.vehicle.plantCountry}</div>
                      </div>
                    )}
                  </div>
                  {data.vehicle.aiData.commonParts && data.vehicle.aiData.commonParts.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1">Common Parts</div>
                      <div className="flex flex-wrap gap-1">
                        {data.vehicle.aiData.commonParts.map((part, i) => (
                          <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {part}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.vehicle.aiData.knownFitment && data.vehicle.aiData.knownFitment.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1">Compatible Vehicles</div>
                      <div className="flex flex-wrap gap-1">
                        {data.vehicle.aiData.knownFitment.map((fit, i) => (
                          <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                            {fit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {data.listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                  <Search size={32} className="mb-2 opacity-50" />
                  <p className="text-sm text-center">
                    No part listings found that match this VIN yet.
                  </p>
                </div>
              ) : (
                <div className="relative w-full overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
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
                              {row.parsedImages && row.parsedImages.length > 0 ? (
                                <div className="relative shrink-0">
                                  <img
                                    src={row.parsedImages[0]}
                                    alt={row.title ?? ''}
                                    className="w-12 h-12 rounded-md object-cover bg-slate-800"
                                  />
                                  {row.parsedImages.length > 1 && (
                                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                                      {row.parsedImages.length}
                                    </span>
                                  )}
                                </div>
                              ) : row.itemPhotoUrl ? (
                                <img
                                  src={row.itemPhotoUrl}
                                  alt={row.title ?? ''}
                                  className="w-12 h-12 rounded-md object-cover bg-slate-800 shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                                  No Image
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {row.title || 'Untitled listing'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  SKU:{' '}
                                  <span className="font-mono">
                                    {row.customLabelSku || '-'}
                                  </span>
                                </div>
                                {row.parsedImages && row.parsedImages.length > 1 && (
                                  <div className="flex gap-1 mt-1 overflow-x-auto max-w-xs">
                                    {row.parsedImages.slice(1, 5).map((img, i) => (
                                      <img
                                        key={i}
                                        src={img}
                                        alt=""
                                        className="w-6 h-6 rounded object-cover bg-slate-800 shrink-0"
                                      />
                                    ))}
                                    {row.parsedImages.length > 5 && (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-[9px] text-slate-500 shrink-0">
                                        +{row.parsedImages.length - 5}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-slate-600 dark:text-slate-200">
                              {row.cBrand || <span className="text-slate-500 dark:text-slate-400">-</span>}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              MPN:{' '}
                              <span className="font-mono">
                                {row.cManufacturerPartNumber || '-'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              OEM:{' '}
                              <span className="font-mono">
                                {row.cOeOemPartNumber || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-slate-600 dark:text-slate-200">
                              {row.categoryName || <span className="text-slate-500 dark:text-slate-400">-</span>}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              ID: {row.categoryId || '-'}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {row.startPrice ? `$${row.startPrice}` : '-'}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-slate-600 dark:text-slate-200">
                              {row.quantity || '-'}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-xs inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                              {row.conditionId || '-'}
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
