import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from './authApi';

const API = '/api';

export interface PublishTarget {
  storeId: string;
  marketplaceId: string;
  policyOverrides?: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
  };
}

export interface PublishResultTarget {
  storeId: string;
  marketplaceId: string;
  status: 'eligible' | 'skipped';
  errors?: string[];
}

export interface InventoryPublishResult {
  jobId: string;
  status: string;
  targets: PublishResultTarget[];
}

export interface JobTargetStatus {
  id: string;
  status: string;
  marketplaceId: string;
  ebayAccountId: string;
  resultPayload?: Record<string, unknown>;
  errorPayload?: Record<string, unknown>;
}

/**
 * Publish a listing to selected eBay stores.
 */
export function usePublishListing() {
  return useMutation({
    mutationFn: (input: { listingId: string; targets: PublishTarget[] }) =>
      fetchWithAuth<InventoryPublishResult>(`${API}/inventory/${input.listingId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: input.targets }),
      }),
  });
}

/**
 * Poll publish job targets for status updates.
 */
export function usePublishJobTargets(jobId: string | null) {
  return useQuery({
    queryKey: ['publish-job-targets', jobId],
    queryFn: ({ signal }) =>
      fetchWithAuth<JobTargetStatus[]>(`${API}/ebay/listing-jobs/${jobId}/targets`, { signal }),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const targets = query.state.data;
      if (!targets) return 3000;
      const allDone = targets.every((t) =>
        ['success', 'failed', 'skipped'].includes(t.status),
      );
      return allDone ? false : 3000;
    },
  });
}
