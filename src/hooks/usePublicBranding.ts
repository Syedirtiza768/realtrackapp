import { useEffect, useState } from 'react';
import {
  applyBrandingToDocument,
  fetchPublicBranding,
  getDefaultBranding,
  invalidateBrandingCache,
  type PublicBranding,
} from '../lib/clientBrandingApi';

export function usePublicBranding() {
  const [branding, setBranding] = useState<PublicBranding>(getDefaultBranding);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      invalidateBrandingCache();
      const data = await fetchPublicBranding();
      if (cancelled) return;
      setBranding(data);
      applyBrandingToDocument(data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { branding, loading };
}
