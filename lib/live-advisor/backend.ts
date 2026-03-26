/**
 * ============================================================================
 * LIVE ADVISOR BACKEND CONFIG
 * ============================================================================
 *
 * PURPOSE:
 * Centralize the small amount of backend-runtime configuration needed by the
 * frontend proxy routes for the live Saved Jobs advisor path.
 *
 * WHY THIS EXISTS:
 * The UI should never know backend auth or base-URL details. Those details
 * belong at the server route boundary so the client only talks to same-origin
 * frontend routes.
 */

export interface LiveAdvisorBackendConfig {
  baseUrl: string;
  apiKey: string;
}

export const LIVE_ADVISOR_DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8000';
export const LIVE_ADVISOR_BACKEND_BASE_URL_ENV = 'PATHOS_BACKEND_BASE_URL';
export const LIVE_ADVISOR_BACKEND_API_KEY_ENV = 'PATHOS_BACKEND_API_KEY';
export const LIVE_ADVISOR_SHARED_API_KEYS_ENV = 'PATHOS_API_KEYS';

function trimTrailingSlash(value: string): string {
  if (value.endsWith('/')) {
    return value.slice(0, value.length - 1);
  }
  return value;
}

/**
 * Resolve the backend base URL used by the proxy routes.
 *
 * Defaulting to localhost keeps local integration simple while still allowing
 * operators to override the target via environment configuration.
 */
export function resolveLiveAdvisorBackendBaseUrl(): string {
  const configured = process.env[`${LIVE_ADVISOR_BACKEND_BASE_URL_ENV}`];
  if (configured !== undefined && configured.trim() !== '') {
    return trimTrailingSlash(configured.trim());
  }
  return LIVE_ADVISOR_DEFAULT_BACKEND_BASE_URL;
}

/**
 * Resolve the backend API key used by the proxy routes.
 *
 * Order:
 * 1. dedicated frontend integration key
 * 2. first key from a shared comma-separated PATHOS_API_KEYS value
 */
export function resolveLiveAdvisorBackendApiKey(): string | null {
  const configured = process.env[`${LIVE_ADVISOR_BACKEND_API_KEY_ENV}`];
  if (configured !== undefined && configured.trim() !== '') {
    return configured.trim();
  }

  const sharedKeys = process.env[`${LIVE_ADVISOR_SHARED_API_KEYS_ENV}`];
  if (sharedKeys === undefined || sharedKeys.trim() === '') {
    return null;
  }

  const parts = sharedKeys.split(',');
  for (let i = 0; i < parts.length; i++) {
    const value = parts[i].trim();
    if (value !== '') {
      return value;
    }
  }

  return null;
}

/**
 * Build a validated backend config object.
 *
 * Returning a structured result keeps the route handlers simple and ensures
 * configuration failures become honest user-facing API errors instead of
 * opaque fetch crashes.
 */
export function resolveLiveAdvisorBackendConfig(): {
  config: LiveAdvisorBackendConfig | null;
  errorMessage: string | null;
} {
  const apiKey = resolveLiveAdvisorBackendApiKey();
  if (apiKey === null) {
    return {
      config: null,
      errorMessage:
        'Live frontend/backend integration requires PATHOS_BACKEND_API_KEY in the frontend environment, or a usable first key in PATHOS_API_KEYS. Copy .env.local.example to .env.local, set the backend URL and key, then restart the frontend dev server.',
    };
  }

  return {
    config: {
      baseUrl: resolveLiveAdvisorBackendBaseUrl(),
      apiKey: apiKey,
    },
    errorMessage: null,
  };
}
