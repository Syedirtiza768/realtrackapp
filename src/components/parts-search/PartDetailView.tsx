/* ─── Part description (shared by the modal and the page) ──
 *  Images with full-size downloads, facts, every cross-reference
 *  number by role (each one searchable), sellers and stock,
 *  structured fitment with its evidence, the listing's
 *  compatibility list, item specifics, description and source
 *  records. Loads the internal part detail via Omni Core.
 * ────────────────────────────────────────────────────────── */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, ExternalLink, FolderDown, ImageOff, Loader2, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  formatMoney,
  getPartDetail,
  partImageUrl,
  partPublicUrl,
  type PartCrossReference,
  type PartDetail,
  type PartFitment,
  type PartNumberRole,
} from '../../lib/partsSearchApi';
import { downloadPartImage, downloadPartImagesZip, listPartImages } from '../../lib/partsSearchOptionsApi';
import DataSourceNotice from './DataSourceNotice';
import InternalOffersTable from './InternalOffersTable';
import ListingDescription from './ListingDescription';

type Vehicle = { year?: number | string; make?: string; model?: string; trim?: string; engine?: string };

function vehiclesOf(part: PartDetail): Vehicle[] {
  return Array.isArray(part.compatibility) ? (part.compatibility as Vehicle[]).filter((row) => row && typeof row === 'object') : [];
}

/** Display groups for cross-reference roles, strongest first. */
const ROLE_GROUPS: Array<{ label: string; hint: string; roles: PartNumberRole[] }> = [
  { label: 'Part numbers', hint: 'The number(s) this part is sold under', roles: ['MPN', 'BRAND_MPN', 'OEM'] },
  { label: 'Supersedes / superseded by', hint: 'Older or newer numbers for the same part', roles: ['SUPERSEDED'] },
  { label: 'Interchange numbers', hint: 'Numbers the listing says this part interchanges with', roles: ['INTERCHANGE'] },
  { label: 'OEM cross-references', hint: 'OEM numbers a catalogue maps this part to', roles: ['OEM_CROSS_REFERENCE'] },
  { label: 'OE / OEM numbers', hint: 'OE numbers listed on the part (seller or catalogue data)', roles: ['OE'] },
];

/** PartsBazar360 grades fitment evidence A (strongest) … F; only verified A/B counts as a confirmed fit. */
const evidenceHint = (level: string) => `Evidence level ${level} (A strongest … F weakest; verified A/B = confirmed fit)`;

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{value}</dd>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function CrossReferences({ refs, onSearchNumber }: { refs: PartCrossReference[]; onSearchNumber?: (number: string) => void }) {
  const groups = ROLE_GROUPS.map((group) => ({ ...group, refs: refs.filter((ref) => group.roles.includes(ref.role)) })).filter((group) => group.refs.length);
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="text-xs text-slate-500 dark:text-slate-400" title={group.hint}>
            {group.label} <span className="tabular-nums">({group.refs.length})</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {group.refs.slice(0, 80).map((ref) => {
              const title = `${ref.source}${ref.verified ? ' · verified' : ' · unverified'}${onSearchNumber ? ' — click to search every option for this number' : ''}`;
              const body = (
                <>
                  {ref.number}
                  {ref.verified && <span className="ml-1 text-[10px] font-sans font-semibold text-emerald-600 dark:text-emerald-400">✓</span>}
                </>
              );
              return onSearchNumber ? (
                <button
                  key={`${ref.role}-${ref.normalized}`}
                  type="button"
                  onClick={() => onSearchNumber(ref.number)}
                  title={title}
                  aria-label={`${ref.number} — search every option for this number`}
                  className="inline-flex items-center rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {body}
                </button>
              ) : (
                <span key={`${ref.role}-${ref.normalized}`} title={title} className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {body}
                </span>
              );
            })}
            {group.refs.length > 80 && <span className="text-xs text-slate-500">+{group.refs.length - 80} more</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function years(row: PartFitment): string {
  if (row.startYear == null) return '';
  if (row.endYear == null) return `${row.startYear}–`;
  return row.startYear === row.endYear ? `${row.startYear}` : `${row.startYear}–${row.endYear}`;
}

function FitmentTable({ rows, total }: { rows: PartFitment[]; total: number }) {
  const [filter, setFilter] = useState('');
  const [shown, setShown] = useState(25);
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.make, row.model, row.generation, row.trim, row.engine, years(row)].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [rows, filter]);
  return (
    <div>
      {rows.length > 10 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setShown(25);
          }}
          placeholder="Filter by make, model, year, engine…"
          className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="Filter fitment"
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-1.5 pr-3 font-medium">Vehicle</th>
              <th className="py-1.5 pr-3 font-medium">Years</th>
              <th className="py-1.5 pr-3 font-medium">Engine / trim</th>
              <th className="py-1.5 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, shown).map((row, index) => (
              <tr key={index} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-1.5 pr-3 text-slate-800 dark:text-slate-100">
                  {row.make} {row.model}
                  {row.generation && row.generation !== row.model && <span className="text-slate-500 dark:text-slate-400"> · {row.generation}</span>}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{years(row) || '—'}</td>
                <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{[row.engine, row.trim, row.drivetrain].filter(Boolean).join(' · ') || '—'}</td>
                <td className="whitespace-nowrap py-1.5 text-slate-600 dark:text-slate-300" title={[evidenceHint(row.evidenceLevel), row.source, row.verificationStatus, row.notes].filter(Boolean).join('\n')}>
                  <span className={`mr-1 rounded px-1 font-semibold ${['A', 'B'].includes(row.evidenceLevel) && row.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {row.evidenceLevel}
                  </span>
                  {row.verificationStatus === 'VERIFIED' ? 'verified' : row.source ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {visible.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + 100)} className="font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
            Show more ({visible.length - shown} left)
          </button>
        )}
        {total > rows.length && <span className="text-slate-500 dark:text-slate-400">Showing the strongest {rows.length} of {total} fitment rows.</span>}
      </div>
    </div>
  );
}

function specificValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.filter((v) => typeof v === 'string' || typeof v === 'number').map(String);
    return items.length ? items.join(', ') : null;
  }
  return null;
}

function ItemSpecifics({ specifics }: { specifics: Record<string, unknown> }) {
  const [all, setAll] = useState(false);
  const rows = Object.entries(specifics)
    .map(([key, value]) => [key, specificValue(value)] as const)
    .filter((row): row is readonly [string, string] => Boolean(row[1]));
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <Section title={`Item specifics (${rows.length})`}>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {shown.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt>
            <dd className="text-sm text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{value.slice(0, 400)}</dd>
          </div>
        ))}
      </dl>
      {rows.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 text-xs font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
          Show all {rows.length}
        </button>
      )}
    </Section>
  );
}

type Props = {
  id: string;
  /** Click on a cross-reference number: search every option for it. */
  onSearchNumber?: (number: string) => void;
  /** Rendered under the title, e.g. why the part is in the option list. */
  context?: ReactNode;
  /** Heading level of the title (h1 on the page, h2 in the modal). */
  headingId?: string;
  as?: 'page' | 'modal';
};

export default function PartDetailView({ id, onSearchNumber, context, headingId, as = 'page' }: Props) {
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

  if (query.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]" aria-busy="true">
        <div className="aspect-square animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        <div className="space-y-3">
          <div className="h-7 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (query.isError || !part) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>{(query.error as Error)?.message ?? 'This part could not be loaded.'}</p>
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
  // Only the internal payload carries structured rows; the buyer view's `fitments` has another shape.
  const fitments = Array.isArray(part.fitments) ? part.fitments.filter((row) => row && typeof row.make === 'string' && row.make) : [];
  const crossReferences = part.crossReferences ?? [];
  const Title = as === 'page' ? 'h1' : 'h2';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-0 lg:self-start">
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
          <Title id={headingId} className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {part.title}
          </Title>
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
          {context && <div className="mt-3">{context}</div>}
        </div>

        <Section title="Part details">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label="Brand" value={part.brand} />
            <Fact label="Manufacturer" value={part.manufacturer} />
            <Fact label="Manufacturer part no." value={part.manufacturerPartNumber} />
            <Fact label="Genuine OEM no." value={part.genuineOemPartNumber} />
            {part.genuineOem && <Fact label="Genuine OEM" value="Yes (listing)" />}
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
        </Section>

        {crossReferences.length > 0 ? (
          <Section
            title={`Cross-references (${crossReferences.length})`}
            aside={onSearchNumber ? <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"><Search size={11} aria-hidden="true" /> click a number to search it</span> : undefined}
          >
            <CrossReferences refs={crossReferences} onSearchNumber={onSearchNumber} />
          </Section>
        ) : (
          part.oeNumbers &&
          part.oeNumbers.length > 0 && (
            <Section title="OE / cross-reference numbers">
              <div className="flex flex-wrap gap-1.5">
                {part.oeNumbers.slice(0, 40).map((number) => (
                  <span key={number} className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {number}
                  </span>
                ))}
              </div>
            </Section>
          )
        )}

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

        {fitments.length > 0 && (
          <Section title={`Fitment (${Math.max(part.fitmentCount ?? 0, fitments.length).toLocaleString()} vehicle configuration${Math.max(part.fitmentCount ?? 0, fitments.length) === 1 ? '' : 's'})`}>
            <FitmentTable rows={fitments} total={Math.max(part.fitmentCount ?? 0, fitments.length)} />
          </Section>
        )}

        {vehicles.length > 0 && (
          <Section title={`Compatibility list on the listing (${vehicles.length})`}>
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
            <ListingDescription description={part.description} title={part.title} />
          </Section>
        )}

        {part.itemSpecifics && typeof part.itemSpecifics === 'object' && <ItemSpecifics specifics={part.itemSpecifics} />}

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
      </div>
    </div>
  );
}
