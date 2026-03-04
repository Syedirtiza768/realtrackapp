/**
 * React Query (TanStack Query) provider and pre-configured query client.
 *
 * Wraps the entire application to provide:
 * - Automatic background refetching
 * - Request deduplication
 * - Cache management with stale-while-revalidate
 * - Retry logic
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — data considered fresh
      gcTime: 5 * 60_000,         // 5min — garbage collection
      refetchOnWindowFocus: true,   // refetch when tab regains focus
      retry: 1,                     // retry failed requests once
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
