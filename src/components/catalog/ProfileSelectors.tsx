import { Loader2 } from 'lucide-react';
import type { StoreProfiles } from '../../lib/multiStoreApi';
import type { ProfileSelection } from './profileUtils';

interface Props {
  profiles: StoreProfiles | undefined;
  loading?: boolean;
  storeLabel?: string;
  value: ProfileSelection;
  onChange: (next: ProfileSelection) => void;
  disabled?: boolean;
}

export default function ProfileSelectors({
  profiles,
  loading,
  storeLabel,
  value,
  onChange,
  disabled,
}: Props) {
  const setField = (
    field: 'shippingProfileName' | 'returnProfileName' | 'paymentProfileName',
    name: string,
  ) => {
    const next = { ...value, [field]: name };
    const shipping = profiles?.shippingProfiles.find(
      (p) => p.name === (field === 'shippingProfileName' ? name : next.shippingProfileName),
    );
    const returns = profiles?.returnProfiles.find(
      (p) => p.name === (field === 'returnProfileName' ? name : next.returnProfileName),
    );
    const payment = profiles?.paymentProfiles.find(
      (p) => p.name === (field === 'paymentProfileName' ? name : next.paymentProfileName),
    );

    onChange({
      shippingProfileName: field === 'shippingProfileName' ? name : next.shippingProfileName,
      returnProfileName: field === 'returnProfileName' ? name : next.returnProfileName,
      paymentProfileName: field === 'paymentProfileName' ? name : next.paymentProfileName,
      fulfillmentPolicyId: shipping?.ebayPolicyId,
      paymentPolicyId: payment?.ebayPolicyId,
      returnPolicyId: returns?.ebayPolicyId,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-2">
        <Loader2 size={12} className="animate-spin" />
        Loading profiles…
      </div>
    );
  }

  if (!profiles) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Select a store to load shipping, return, and payment profiles.
      </p>
    );
  }

  const hasAny =
    profiles.shippingProfiles.length > 0 ||
    profiles.returnProfiles.length > 0 ||
    profiles.paymentProfiles.length > 0;

  if (!hasAny) {
    return (
      <p className="text-xs text-amber-400">
        No profiles found for this store. Sync eBay policies in Settings → Integrations.
      </p>
    );
  }

  const selectClass =
    'w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50';

  return (
    <div className="space-y-3">
      {storeLabel && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Profiles from {storeLabel}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
            Shipping profile
          </label>
          <select
            value={value.shippingProfileName}
            onChange={(e) => setField('shippingProfileName', e.target.value)}
            disabled={disabled || profiles.shippingProfiles.length === 0}
            className={selectClass}
          >
            <option value="">— Select —</option>
            {profiles.shippingProfiles.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
            Return profile
          </label>
          <select
            value={value.returnProfileName}
            onChange={(e) => setField('returnProfileName', e.target.value)}
            disabled={disabled || profiles.returnProfiles.length === 0}
            className={selectClass}
          >
            <option value="">— Select —</option>
            {profiles.returnProfiles.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
            Payment profile
          </label>
          <select
            value={value.paymentProfileName}
            onChange={(e) => setField('paymentProfileName', e.target.value)}
            disabled={disabled || profiles.paymentProfiles.length === 0}
            className={selectClass}
          >
            <option value="">— Select —</option>
            {profiles.paymentProfiles.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
