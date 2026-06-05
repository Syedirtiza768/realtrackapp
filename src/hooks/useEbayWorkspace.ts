import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/auth/AuthContext';
import { fetchWithAuth } from '../lib/authApi';

const WORKSPACE_LS = 'rt_workspace_id';

export type WorkspaceSummary = {
  organizationId: string;
  name: string;
  slug: string;
  role: string;
};

type WorkspaceContext = {
  organizationId: string;
  organizationName: string;
  organizations: WorkspaceSummary[];
};

export function useEbayWorkspace() {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setLoading(false);
      setOrganizationId(null);
      setOrganizationName(null);
      setOrganizations([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ctx = await fetchWithAuth<WorkspaceContext>(
        '/api/integrations/ebay/workspace',
      );
      const stored = localStorage.getItem(WORKSPACE_LS);
      const pick =
        ctx.organizations.find((o) => o.organizationId === stored) ??
        ctx.organizations.find((o) => o.organizationId === ctx.organizationId) ??
        ctx.organizations[0];
      const activeId = pick?.organizationId ?? ctx.organizationId;
      const activeName = pick?.name ?? ctx.organizationName;
      localStorage.setItem(WORKSPACE_LS, activeId);
      setOrganizationId(activeId);
      setOrganizationName(activeName);
      setOrganizations(ctx.organizations);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectWorkspace = useCallback((id: string) => {
    const found = organizations.find((o) => o.organizationId === id);
    if (!found) return;
    localStorage.setItem(WORKSPACE_LS, id);
    setOrganizationId(id);
    setOrganizationName(found.name);
  }, [organizations]);

  return {
    signedIn,
    organizationId,
    organizationName,
    organizations,
    loading,
    error,
    reload: load,
    selectWorkspace,
    ready: signedIn && !!organizationId && !loading,
  };
}
