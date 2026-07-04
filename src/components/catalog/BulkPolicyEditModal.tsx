import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Shield, Loader2, Store as StoreIcon } from 'lucide-react';
import { getStoresByChannel, getStoreProfiles } from '../../lib/multiStoreApi';
import { bulkApplyListingProfiles } from '../../lib/listingsApi';
import type { Store } from '../../types/multiStore';
import ProfileSelectors from './ProfileSelectors';
import {
  EMPTY_PROFILE_SELECTION,
  defaultProfileSelection,
  type ProfileSelection,
} from './profileUtils';

interface Props {
  open: boolean;
  listingIds: string[];
  teamIds: string[];
  teamLabels: string[];
  onClose: () => void;
  onComplete?: () => void;
}

export default function BulkPolicyEditModal({
  open,
  listingIds,
  teamIds,
  teamLabels,
  onClose,
  onComplete,
}: Props) {
  const [profileStoreId, setProfileStoreId] = useState('');
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['ebay-stores-policy-edit'],
    queryFn: () => getStoresByChannel('ebay'),
    enabled: open,
    staleTime: 60_000,
  });

  const activeStores = useMemo(
    () => stores.filter((s) => s.status === 'active'),
    [stores],
  );

  const profileStore = useMemo<Store | null>(
    () => activeStores.find((s) => s.id === profileStoreId) ?? null,
    [activeStores, profileStoreId],
  );

  const { data: storeProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['store-profiles-policy-edit', profileStoreId],
    queryFn: () => getStoreProfiles(profileStoreId),
    enabled: open && !!profileStoreId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setProfileStoreId('');
      setProfiles(EMPTY_PROFILE_SELECTION);
      setError(null);
      setApplying(false);
      return;
    }
    if (!profileStoreId && activeStores.length === 1) {
      setProfileStoreId(activeStores[0].id);
    }
  }, [open, activeStores, profileStoreId]);

  useEffect(() => {
    if (!storeProfiles || !profileStore) return;
    setProfiles(defaultProfileSelection(storeProfiles, profileStore));
  }, [storeProfiles, profileStore]);

  const hasProfileSelection =
    profiles.shippingProfileName || profiles.returnProfileName || profiles.paymentProfileName;

  const handleApply = async () => {
    if (listingIds.length === 0 || !hasProfileSelection) return;
    setApplying(true);
    setError(null);
    try {
      await bulkApplyListingProfiles({
        ids: listingIds,
        shippingProfile: profiles.shippingProfileName || undefined,
        returnProfile: profiles.returnProfileName || undefined,
        paymentProfile: profiles.paymentProfileName || undefined,
        teamIds: teamIds.length ? teamIds : undefined,
      });
      onComplete?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply policies');
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const teamBanner =
    teamLabels.length > 0
      ? teamLabels.join(', ')
      : teamIds.length > 0
        ? `${teamIds.length} team(s) filtered`
        : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Edit Policies ({listingIds.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {teamBanner && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
              Policies apply only to listings in team: <strong>{teamBanner}</strong>
            </div>
          )}

          {!teamBanner && teamIds.length === 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              No team filter active. Select a team in the catalog sidebar to scope policy changes.
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Update shipping, return, and payment profiles for the selected listings. Changes sync to catalog products by SKU.
          </p>

          <div>
            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Profile source store
            </label>
            {storesLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 size={12} className="animate-spin" />
                Loading stores…
              </div>
            ) : (
              <select
                value={profileStoreId}
                onChange={(e) => setProfileStoreId(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value="">— Select a store —</option>
                {activeStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {profileStoreId && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <StoreIcon size={12} className="text-blue-400" />
                {profileStore?.storeName}
              </div>
              <ProfileSelectors
                profiles={storeProfiles}
                loading={profilesLoading}
                value={profiles}
                onChange={setProfiles}
                disabled={applying}
              />
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 border border-red-800/60 bg-red-950/20 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || listingIds.length === 0 || !hasProfileSelection || !profileStoreId}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {applying ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
            {applying ? 'Applying…' : 'Apply Policies'}
          </button>
        </div>
      </div>
    </div>
  );
}
