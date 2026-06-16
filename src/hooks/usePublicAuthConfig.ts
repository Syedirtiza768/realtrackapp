import { useEffect, useState } from 'react';

const API = '/api';

export interface PublicAuthConfig {
  registrationEnabled: boolean;
}

const DEFAULT_CONFIG: PublicAuthConfig = {
  registrationEnabled: false,
};

export function usePublicAuthConfig() {
  const [config, setConfig] = useState<PublicAuthConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/auth/public-config`);
        if (!res.ok) throw new Error('Failed to load auth config');
        const data = (await res.json()) as PublicAuthConfig;
        if (!cancelled) setConfig(data);
      } catch {
        if (!cancelled) setConfig(DEFAULT_CONFIG);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading };
}
