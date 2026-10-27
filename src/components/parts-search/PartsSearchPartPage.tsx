import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Download, ExternalLink, FolderDown, ImageOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  formatMoney,
  getPartDetail,
  partImageUrl,
  partPublicUrl,
  type PartDetail,
} from '../../lib/partsSearchApi';
import { downloadPartImage, downloadPartImagesZip, listPartImages } from '../../lib/partsSearchOptionsApi';
import DataSourceNotice from './DataSourceNotice';
import InternalOffersTable from './InternalOffersTable';

type Vehicle = { year?: number | string; make?: string; model?: string; trim?: string; engine?: string };

function vehiclesOf(part: PartDetail): Vehicle[] {
  return Array.isArray(part.compatibility) ? (part.compatibility as Vehicle[]).filter((row) => row && typeof row === 'object') : [];
}

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

export default function PartsSearchPartPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [imageIndex, setImageIndex] = useState(0);
  const [showAllVehicles, setShowAllVehicles] = useState(false);
  const [downloading, setDownloading] = useState<'one' | 'all' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Server-side list: high-quality previews whose indexes match the download endpoint.
  const imageList = useQuery({
    queryKey: ['parts-search', 'part-images', id],
    queryFn: ({ signal }) => listPartImages(id, signal),
    staleTime: 60_000,
    retry: false,
  });

  const query = useQuery({
    queryKey: ['parts-search', 'part', id],
    queryFn: ({ signal }) => getPartDetail(id, signal),
    staleTime: 60_000,
    retry: 1,
  });
  const part = query.data;

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/parts-search'))}
      className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
    >
      <ArrowLeft size={14} aria-hidden="true" /> Back to results
    </button>
  );

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (query.isError || !part) {
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{(query.error as Error)?.message ?? 'This part could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  const served = imageList.data?.images ?? null;
  const images = served
    ? served.map((img) => img.previewUrl)
    : (part.imageUrls ?? []).map(partImageUrl).filter((url): url is string => Boolean(url));
  const mainImage = images[Math.min(imageIndex, images.length - 1)];
  const download = async (kind: 'one' | 'all') => {
    setDownloading(kind);
    setDownloadError(null);
    try {
      if (kind === 'all') await downloadPartImagesZip(part.id);
      else await downloadPartImage(part.id, served?.[Math.min(imageIndex, served.length - 1)]?.index ?? 0);
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  };
  const vehicles = vehiclesOf(part);
  const visibleVehicles = showAllVehicles ? vehicles : vehicles.slice(0, 12);
  const publicOffers = part.offers ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      {back}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          {mainImage ? (
            <img src={mainImage} alt={part.title} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-900" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <ImageOff size={32} aria-hidden="true" />
            </div>
          )}
          {images.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.slice(0, 10).map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show image ${index + 1}`}
                  className={`h-14 w-14 overflow-hidden rounded-lg border ${index === imageIndex ? 'border-slate-900 dark:border-slate-100' : 'border-slate-200 dark:border-slate-700'}`}
                >
                  <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full bg-white object-contain dark:bg-slate-900" />
                </button>
              ))}
            </div>
          )}
          {served && served.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => void download('one')}
                disabled={downloading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {downloading === 'one' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
                Download full size
              </button>
              {served.length > 1 && (
                <button
                  type="button"
                  onClick={() => void download('all')}
                  disabled={downloading !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {downloading === 'all' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <FolderDown size={13} aria-hidden="true" />}
                  All {served.length} images (.zip)
                </button>
              )}
              {downloadError && <span className="text-red-600 dark:text-red-400">{downloadError}</span>}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{part.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <DataSourceNotice audience={part.audience} internalUnavailableReason={part.internalUnavailableReason} />
              <a
                href={partPublicUrl(part)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              >
                Open on PartsBazar360 <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </div>

          <Section title="Part details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Fact label="Brand" value={part.brand} />
              <Fact label="Manufacturer" value={part.manufacturer} />
              <Fact label="Manufacturer part no." value={part.manufacturerPartNumber} />
              <Fact label="Genuine OEM no." value={part.genuineOemPartNumber} />
              <Fact label="Category" value={[part.categoryGroup, part.category].filter(Boolean).join(' › ') || null} />
              <Fact label="Part type" value={part.partType && part.partType !== 'UNCLASSIFIED' ? part.partType : null} />
              <Fact label="Source" value={part.partSource} />
              <Fact label="Quality" value={part.qualityTier} />
              <Fact label="Position" value={part.position} />
              <Fact label="Vehicle system" value={part.vehicleSystem} />
              <Fact label="Fitment status" value={part.fitmentStatus} />
              <Fact label="eBay item" value={part.ebayItemId} />
              <Fact label="PartsBazar360 id" value={part.id} />
              {part.updatedAt && <Fact label="Updated" value={new Date(part.updatedAt).toLocaleString()} />}
            </dl>
            {part.oeNumbers && part.oeNumbers.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">OE / cross-reference numbers</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {part.oeNumbers.slice(0, 40).map((number) => (
                    <span key={number} className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {number}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title={part.audience === 'internal' ? `Sellers, offers & stock (${part.internalOfferCount ?? 0})` : `Offers buyers see (${publicOffers.length})`}>
            {part.audience === 'internal' ? (
              <InternalOffersTable offers={part.internalOffers ?? []} />
            ) : publicOffers.length ? (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {publicOffers.map((offer) => (
                  <li key={offer.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-slate-700 dark:text-slate-200">{offer.sellerName || offer.seller?.name || 'Seller'}</span>
                    <span className="text-slate-500 dark:text-slate-400">{offer.condition}</span>
                    <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatMoney(offer.price, offer.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No offers buyers can see.</p>
            )}
          </Section>

          {part.audience === 'internal' && (part.sourceRecords?.length ?? 0) > 0 && (
            <Section title={`Source records (${part.sourceRecords!.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-1.5 pr-3 font-medium">Type</th>
                      <th className="py-1.5 pr-3 font-medium">Platform</th>
                      <th className="py-1.5 pr-3 font-medium">External id</th>
                      <th className="py-1.5 pr-3 font-medium">File / row</th>
                      <th className="py-1.5 pr-3 font-medium">Imported</th>
                      <th className="py-1.5 font-medium">Last synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.sourceRecords!.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-200">{record.sourceType}</td>
                        <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{record.sourcePlatform ?? '—'}</td>
                        <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{record.externalId ?? '—'}</td>
                        <td className="max-w-[14rem] truncate py-1.5 pr-3 text-slate-600 dark:text-slate-300" title={record.sourceFileName ?? undefined}>
                          {record.sourceFileName ? `${record.sourceFileName}${record.sourceRowNumber ? ` · row ${record.sourceRowNumber}` : ''}` : '—'}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-3 text-slate-500 dark:text-slate-400">{new Date(record.importedAt).toLocaleDateString()}</td>
                        <td className="whitespace-nowrap py-1.5 text-slate-500 dark:text-slate-400">{record.lastSyncedAt ? new Date(record.lastSyncedAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {vehicles.length > 0 && (
            <Section title={`Fits (${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'})`}>
              <ul className="grid gap-1 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
                {visibleVehicles.map((vehicle, index) => (
                  <li key={index} className="truncate">
                    {[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')}
                    {vehicle.engine && <span className="text-xs text-slate-500 dark:text-slate-400"> · {vehicle.engine}</span>}
                  </li>
                ))}
              </ul>
              {vehicles.length > visibleVehicles.length && (
                <button type="button" onClick={() => setShowAllVehicles(true)} className="mt-2 text-xs font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
                  Show all {vehicles.length}
                </button>
              )}
            </Section>
          )}

          {part.description && (
            <Section title="Description">
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{part.description.slice(0, 4000)}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
