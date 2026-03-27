'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './use-api';
import type { Company } from '@/types';

// ─── Query key ─────────────────────────────────────────────────────────────
//
// Exported as a typed const so every caller references the SAME value.
// If you ever need sub-keys (e.g. ['companies', id]) derive them from this:
//   [...COMPANIES_KEY, company.id]
//
// Never inline the string array at the call site — a typo creates a second
// cache bucket that never deduplicates with this one.

export const COMPANIES_KEY = ['companies'] as const;

// ─── Fetch hook ────────────────────────────────────────────────────────────

/**
 * Fetches and caches the companies list.
 *
 * staleTime: 5 minutes — company records change rarely. Setting this higher
 * than the global default (30s) prevents the request from firing on every
 * route navigation, which was causing 429s when the page was visited frequently.
 *
 * Single source of truth: any component that calls useCompanies() within the
 * same QueryClient shares the cached data — only ONE network request is made
 * regardless of how many components mount simultaneously (TanStack Query
 * deduplicates by queryKey).
 */
export function useCompanies() {
  const { get } = useApi();

  return useQuery<Company[]>({
    queryKey: COMPANIES_KEY,
    queryFn: async ({ signal }) => {
      const res = await get('/api/companies');
      // The fetch was aborted (component unmounted before response) — let React
      // Query handle cleanup; do not update the cache with stale data.
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      return (body.data ?? []) as Company[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — override the global 30s default
  });
}

// ─── Mutation hooks ────────────────────────────────────────────────────────
//
// Each mutation is its own hook so callers take only what they need and the
// cache-update logic stays co-located with the mutation it belongs to.
//
// Cache strategy per mutation:
//
//   CREATE — setQueryData first (instant row appears), then invalidate
//            (background refetch confirms server state).
//
//   UPDATE — setQueryData to immediately swap the row in place,
//            then invalidate to sync.
//
//   DELETE — setQueryData to immediately remove the row,
//            then invalidate to sync.
//
// Why setQueryData BEFORE invalidateQueries?
//   invalidateQueries alone: triggers a refetch → old list stays visible →
//   new list replaces it when the request resolves (~200-500ms later).
//   No "ghost state" but there IS a noticeable delay.
//
//   setQueryData first: the UI updates in the same synchronous tick as
//   onSuccess — zero latency. invalidateQueries then runs a silent background
//   refetch to confirm the server agrees. If it doesn't (optimistic mismatch),
//   the cache corrects itself automatically.

export function useCreateCompany() {
  const { post } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; cnpj: string; cnae?: string }) => {
      const res = await post('/api/companies', input);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Erro ao criar empresa');
      }
      return (await res.json()) as Company;
    },

    onSuccess: (created) => {
      // 1. Instantly prepend the new row — the user sees it without waiting
      //    for any network round-trip.
      queryClient.setQueryData<Company[]>(COMPANIES_KEY, (old = []) => [
        created,
        ...old,
      ]);

      // 2. Invalidate so a background refetch confirms the server-side state
      //    (e.g. handles any server-side field defaults we didn't return locally).
      //    Because setQueryData already ran, the UI won't flash or go blank
      //    while the refetch is in flight.
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
    },
  });
}

export function useUpdateCompany() {
  const { put } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string; name?: string; cnae?: string; active?: boolean }) => {
      const res = await put(`/api/companies/${id}`, input);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Erro ao atualizar empresa');
      }
      return (await res.json()) as Company;
    },

    onSuccess: (updated) => {
      // Swap the updated row in place — no list-level flash.
      queryClient.setQueryData<Company[]>(COMPANIES_KEY, (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c))
      );
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
    },
  });
}

export function useDeleteCompany() {
  const { del } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await del(`/api/companies/${id}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Erro ao excluir empresa');
      }
    },

    onSuccess: (_void, deletedId) => {
      // Remove the row immediately — mutation arg is the id.
      queryClient.setQueryData<Company[]>(COMPANIES_KEY, (old = []) =>
        old.filter((c) => c.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
    },
  });
}
