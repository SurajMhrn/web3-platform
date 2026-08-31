import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Single axios instance for the whole app. `withCredentials: true` sends
 * the httpOnly `accessToken`/`refreshToken` cookies automatically — no
 * token is ever read from or written to client-side JS/storage.
 *
 * On a 401 (expired access token), the response interceptor below makes
 * one silent attempt to refresh the session via `/auth/refresh` and
 * retries the original request; if that also fails, the caller's own
 * error handling takes over (AuthContext/ProtectedRoute redirect to login).
 */
export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean;
}

// Shared across concurrent 401s so a burst of requests triggers exactly
// one refresh call instead of one per request.
let refreshPromise: Promise<unknown> | null = null;

const isAuthEndpoint = (url?: string) =>
  !!url && ['/auth/refresh', '/auth/login', '/auth/register'].some((path) => url.includes(path));

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retriedAfterRefresh &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retriedAfterRefresh = true;
      try {
        if (!refreshPromise) {
          refreshPromise = apiClient.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed too — fall through and reject with the original error.
      }
    }

    return Promise.reject(error);
  }
);

/** Extracts a human-readable message from a failed API call, with a fallback. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  return fallback;
};
