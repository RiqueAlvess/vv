'use client';

import { useCallback } from 'react';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

// Module-level mutex: if a refresh is already in-flight, all concurrent 401s
// reuse the same promise instead of each firing their own refresh request.
// This prevents token rotation race conditions when multiple requests fail
// simultaneously (e.g. on a hard page reload with an expired access token).
let refreshPromise: Promise<boolean> | null = null;

export function useApi() {
  const fetchWithAuth = useCallback(async (url: string, options: ApiOptions = {}) => {
    const { skipAuth, ...fetchOptions } = options;

    // Do NOT set Content-Type for FormData — browser sets it with boundary automatically
    const isFormData = fetchOptions.body instanceof FormData;

    const res = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers: isFormData
        ? { ...fetchOptions.headers }
        : {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
    });

    // If 401, try to refresh token — deduplicated via module-level mutex
    if (res.status === 401 && !skipAuth) {
      if (!refreshPromise) {
        refreshPromise = fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
          .then((r) => r.ok)
          .finally(() => { refreshPromise = null; });
      }

      const refreshed = await refreshPromise;

      if (refreshed) {
        // Retry original request with fresh token
        return fetch(url, {
          ...fetchOptions,
          credentials: 'include',
          headers: isFormData
            ? { ...fetchOptions.headers }
            : {
                'Content-Type': 'application/json',
                ...fetchOptions.headers,
              },
        });
      }

      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (res.status === 429) {
      console.warn(`[API] Rate limited: ${url}`);
    }

    return res;
  }, []);

  const get = useCallback((url: string) => fetchWithAuth(url), [fetchWithAuth]);

  const post = useCallback((url: string, data?: unknown) => fetchWithAuth(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  }), [fetchWithAuth]);

  const put = useCallback((url: string, data?: unknown) => fetchWithAuth(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  }), [fetchWithAuth]);

  const del = useCallback((url: string) => fetchWithAuth(url, {
    method: 'DELETE',
  }), [fetchWithAuth]);

  const patch = useCallback((url: string, data?: unknown) => fetchWithAuth(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  }), [fetchWithAuth]);

  return { fetchWithAuth, get, post, put, del, patch };
}
