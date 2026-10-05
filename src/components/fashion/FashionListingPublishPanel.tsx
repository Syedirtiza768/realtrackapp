import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fashionError, publishFashionListing, validateFashionListing, type FashionAccount, type FashionListing, type FashionValidation } from '../../lib/fashionListingsApi';

interface Props { listings: FashionListing[]; account?: FashionAccount; dirty?: boolean }

export default function FashionListingPublishPanel({ listings, account, dirty = false }: Props) {
  const { permissions, activeOrganizationId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<{ id: string; title: string; results: FashionValidation[]; error?: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [validatedContext, setValidatedContext] = useState('');
  const [queuedContext, setQueuedContext] = useState('');
  const keys = useRef<Record<string, string>>({});
  const context = JSON.stringify([listings.map((item) => [item.id, item.updatedAt, item.verticalValidationStatus]), account?.id, account?.marketplaceId, dirty]);
  const currentContext = useRef(context);
  currentContext.current = context;
  useEffect(() => { setReports([]); setMessages([]); setValidatedContext(''); setQueuedContext(''); keys.current = {}; }, [context]);
  if (!permissions.includes('fashion.publish')) return null;
  const eligible = listings.length > 0 && listings.every((item) => item.verticalValidationStatus === 'approved' && !item.manualReview);
  const canValidate = eligible && !!account && !dirty && !busy;
  const canPublish = canValidate && validatedContext === context && queuedContext !== context && reports.length === listings.length && reports.every((report) => !report.error && report.results.length === 1 && report.results.every((result) => ['ready', 'warnings'].includes(result.status) && !result.errors.length));

  async function validate() {
    if (!canValidate || !account) return;
    const startedContext = context;
    setBusy(true); setMessages([]); setReports([]); setValidatedContext('');
    const next: typeof reports = [];
    for (const listing of listings) {
      if (currentContext.current !== startedContext) break;
      try {
        const response = await validateFashionListing(listing.id, account, activeOrganizationId);
        const expectedKey = `${account.id}:${account.marketplaceId}`;
        next.push({ id: listing.id, title: listing.title, results: response.results.filter((result) => result.key === expectedKey) });
      } catch (error) { next.push({ id: listing.id, title: listing.title, results: [], error: fashionError(error) }); }
    }
    if (currentContext.current === startedContext) { setReports(next); setValidatedContext(startedContext); }
    setBusy(false);
  }
  async function publish() {
    if (!canPublish || !account) return;
    const startedContext = context;
    setBusy(true); setMessages([]);
    const next: string[] = [];
    let allQueued = true;
    for (const listing of listings) {
      if (currentContext.current !== startedContext) break;
      try {
        keys.current[listing.id] ??= crypto.randomUUID();
        const result = await publishFashionListing(listing.id, account, keys.current[listing.id], activeOrganizationId);
        if (result.skippedTargets?.length) {
          allQueued = false;
          next.push(`${listing.title}: target skipped — ${result.skippedTargets.flatMap((target) => target.errors).join('; ')}`);
        } else next.push(`${listing.title}: job ${result.jobId} (${result.status}). Queued jobs are not confirmation that the listing is live.`);
      } catch (error) { allQueued = false; next.push(`${listing.title}: ${fashionError(error)}`); }
    }
    if (currentContext.current === startedContext) { setMessages(next); if (allQueued) setQueuedContext(startedContext); else setValidatedContext(''); }
    setBusy(false);
  }
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" aria-label="eBay publishing">
    <h2 className="text-lg font-semibold">Validate and publish to eBay</h2>
    <p className="text-sm text-slate-500">{listings.length} listing(s) · {account ? `${account.storeName || account.accountName} · ${account.marketplaceId}` : 'Select a Fashion seller account first.'}</p>
    {dirty && <p className="text-sm text-amber-700 dark:text-amber-300">Save your changes before validation. Editing requires a new authenticity review.</p>}
    {!eligible && listings.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">Every selected listing must have an approved authenticity review and be outside quarantine.</p>}
    <div className="flex flex-wrap gap-3"><button type="button" onClick={validate} disabled={!canValidate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-600">{busy ? 'Processing…' : 'Validate saved listings'}</button><button type="button" onClick={publish} disabled={!canPublish} className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{queuedContext === context ? 'Publish queued' : `Publish ${listings.length || ''} to eBay`}</button></div>
    <p className="text-xs text-slate-500">Publishing creates a job for the selected seller and marketplace. Validation checks saved data and seller policies.</p>
    <div aria-live="polite" className="space-y-3 text-sm">{reports.map((report) => <div key={report.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="font-semibold">{report.title}</p>{report.error && <p className="text-red-600 dark:text-red-400">{report.error}</p>}{!report.error && !report.results.length && <p className="text-red-600">No matching target validation was returned. Publishing remains blocked.</p>}{report.results.map((result) => <div key={result.key}><p className="mt-1 capitalize">{result.status}</p>{result.errors.map((error, i) => <p key={`error-${i}`} className="text-red-600 dark:text-red-400">{error}</p>)}{result.warnings.map((warning, i) => <p key={`warning-${i}`} className="text-amber-700 dark:text-amber-300">{warning}</p>)}{result.requiredActions.length > 0 && <p>Required actions: {result.requiredActions.join(', ')}</p>}</div>)}</div>)}{messages.map((message, i) => <p key={i} className="break-words">{message}</p>)}</div>
  </section>;
}
