import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyBrandingToDocument,
  fetchPublicBranding,
  getDefaultBranding,
  invalidateBrandingCache,
  type PublicBranding,
} from '../lib/clientBrandingApi';

const BRANDING_UPDATED = 'branding-updated';

type BrandingContextValue = {
  branding: PublicBranding;
  loading: boolean;
  refresh: () => Promise<void>;
  applyDraft: (draft: Partial<PublicBranding>) => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: getDefaultBranding(),
      loading: false,
      refresh: async () => {},
      applyDraft: () => {},
    };
  }
  return ctx;
}

export function notifyBrandingUpdated() {
  window.dispatchEvent(new CustomEvent(BRANDING_UPDATED));
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PublicBranding>(getDefaultBranding);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    invalidateBrandingCache();
    const data = await fetchPublicBranding();
    setBranding(data);
    applyBrandingToDocument(data);
    setLoading(false);
  }, []);

  const applyDraft = useCallback((draft: Partial<PublicBranding>) => {
    setBranding((prev) => {
      const next = { ...prev, ...draft };
      applyBrandingToDocument(next);
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener(BRANDING_UPDATED, onUpdate);
    return () => window.removeEventListener(BRANDING_UPDATED, onUpdate);
  }, [refresh]);

  useEffect(() => {
    if (branding.themeMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyBrandingToDocument(branding);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [branding]);

  const value = useMemo(
    () => ({ branding, loading, refresh, applyDraft }),
    [branding, loading, refresh, applyDraft],
  );

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}
