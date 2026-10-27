/* ─── Part page (deep link) ────────────────────────────────
 *  /parts-search/parts/:id — the same description the result
 *  list opens in a modal, for shared links and new tabs.
 * ────────────────────────────────────────────────────────── */

import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { optionsPath } from '../../lib/partsSearchOptionsApi';
import PartDetailView from './PartDetailView';

export default function PartsSearchPartPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/parts-search'))}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to results
      </button>
      <PartDetailView id={id} onSearchNumber={(number) => navigate(optionsPath({ q: number }))} />
    </div>
  );
}
