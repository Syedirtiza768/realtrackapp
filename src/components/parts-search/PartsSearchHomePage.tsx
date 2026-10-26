import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getPartsSearchStatus, readRecentSearches, resultsPath } from '../../lib/partsSearchApi';
import DataSourceNotice from './DataSourceNotice';
import SearchBox from './SearchBox';

/** Queries that show off what universal search understands. */
const EXAMPLES = [
  { q: '86401-12020', hint: 'OEM number, any separator' },
  { q: 'A 221 820 02 64', hint: 'Mercedes-style spacing' },
  { q: '86401', hint: 'Partial number' },
  { q: 'altrenator', hint: 'Typos are fine' },
  { q: '2019 toyota corolla lane camera', hint: 'Year, make, model, part' },
  { q: 'BMW headlight', hint: 'Make + part' },
];

export default function PartsSearchHomePage() {
  const [recent] = useState(readRecentSearches);
  const status = useQuery({
    queryKey: ['parts-search', 'status'],
    queryFn: ({ signal }) => getPartsSearchStatus(signal),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-3xl py-6 lg:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 lg:text-3xl">Parts Search</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Search the whole PartsBazar360 catalogue by OEM or part number, keyword, or vehicle.
      </p>

      <div className="mt-6">
        <SearchBox size="lg" autoFocus />
      </div>

      <div className="mt-3 min-h-[1.25rem]">
        {status.data && (
          <DataSourceNotice
            audience={status.data.internalConfigured && status.data.internal?.ok ? 'internal' : 'public'}
            internalUnavailableReason={status.data.internalConfigured && !status.data.internal?.ok ? status.data.internal?.message : undefined}
          />
        )}
        {status.data && !status.data.upstream.ok && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            PartsBazar360 search is not responding right now{status.data.upstream.message ? `: ${status.data.upstream.message}` : '.'}
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <section className="mt-8" aria-labelledby="parts-search-recent">
          <h2 id="parts-search-recent" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recent searches
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recent.map((q) => (
              <li key={q}>
                <Link
                  to={resultsPath({ q })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Clock size={13} className="text-slate-400" aria-hidden="true" />
                  {q}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="parts-search-examples">
        <h2 id="parts-search-examples" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Try
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map((example) => (
            <li key={example.q}>
              <Link
                to={resultsPath({ q: example.q })}
                className="block rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
              >
                <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{example.q}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{example.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
