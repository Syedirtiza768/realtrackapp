import { Link, useParams } from 'react-router-dom';
import { useEbayWorkspace } from '../../hooks/useEbayWorkspace';
import { usePermissions } from '../../hooks/usePermissions';
import EbayAccountPolicyEditor from './EbayAccountPolicyEditor';

export default function EbayPolicyMappingPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { signedIn, organizationId, ready } = useEbayWorkspace();
  const { has } = usePermissions();
  const canManage = has('ebay.manage');

  if (!signedIn) {
    return (
      <div className="p-6 text-slate-600 dark:text-slate-200">
        <Link to="/login" className="text-sky-400 underline">
          Sign in
        </Link>{' '}
        to edit policy mapping.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-4">
        <Link to="/settings/integrations/ebay" className="text-sm text-sky-400 hover:underline">
          ← eBay stores
        </Link>
        <Link to="/settings" className="text-sm text-sky-400 hover:underline">
          Settings → Store policies
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Policy mapping</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Run <strong>Sync policies</strong> on the stores list first, then pick default business policies per
        marketplace. Publishing is blocked until these are set.
      </p>
      {!canManage && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          View-only — you need <code className="text-[10px]">ebay.manage</code> to save changes.
        </p>
      )}

      {accountId && ready && (
        <EbayAccountPolicyEditor
          accountId={accountId}
          organizationId={organizationId ?? undefined}
          canEdit={canManage}
        />
      )}
    </div>
  );
}
