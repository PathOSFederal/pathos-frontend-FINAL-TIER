/**
 * ============================================================================
 * LIVE ADVISOR BACKEND CONFIG TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Protect the small server-side config boundary used by the live frontend
 * proxy routes. These tests make sure local env setup stays explicit and that
 * missing config fails with an honest operator-facing message instead of
 * producing opaque fetch errors.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  LIVE_ADVISOR_BACKEND_API_KEY_ENV,
  LIVE_ADVISOR_BACKEND_BASE_URL_ENV,
  LIVE_ADVISOR_DEFAULT_BACKEND_BASE_URL,
  LIVE_ADVISOR_SHARED_API_KEYS_ENV,
  resolveLiveAdvisorBackendApiKey,
  resolveLiveAdvisorBackendBaseUrl,
  resolveLiveAdvisorBackendConfig,
} from './backend';

function clearLiveAdvisorEnv(): void {
  delete process.env[`${LIVE_ADVISOR_BACKEND_BASE_URL_ENV}`];
  delete process.env[`${LIVE_ADVISOR_BACKEND_API_KEY_ENV}`];
  delete process.env[`${LIVE_ADVISOR_SHARED_API_KEYS_ENV}`];
}

describe('live advisor backend config', function () {
  afterEach(function () {
    clearLiveAdvisorEnv();
  });

  it('defaults the backend base url for local development', function () {
    expect(resolveLiveAdvisorBackendBaseUrl()).toBe(
      LIVE_ADVISOR_DEFAULT_BACKEND_BASE_URL
    );
  });

  it('trims a configured backend base url', function () {
    process.env[`${LIVE_ADVISOR_BACKEND_BASE_URL_ENV}`] =
      ' http://localhost:8000/ ';

    expect(resolveLiveAdvisorBackendBaseUrl()).toBe('http://localhost:8000');
  });

  it('prefers the dedicated frontend backend api key', function () {
    process.env[`${LIVE_ADVISOR_BACKEND_API_KEY_ENV}`] = ' frontend-key ';
    process.env[`${LIVE_ADVISOR_SHARED_API_KEYS_ENV}`] = 'shared-key,second-key';

    expect(resolveLiveAdvisorBackendApiKey()).toBe('frontend-key');
  });

  it('falls back to the first shared backend api key', function () {
    process.env[`${LIVE_ADVISOR_SHARED_API_KEYS_ENV}`] =
      ' , shared-key , second-key ';

    expect(resolveLiveAdvisorBackendApiKey()).toBe('shared-key');
  });

  it('returns an honest setup error when no backend api key is configured', function () {
    const result = resolveLiveAdvisorBackendConfig();

    expect(result.config).toBeNull();
    expect(result.errorMessage).toContain('PATHOS_BACKEND_API_KEY');
    expect(result.errorMessage).toContain('.env.local.example');
    expect(result.errorMessage).toContain('restart the frontend dev server');
  });

  it('builds a validated config object when env is present', function () {
    process.env[`${LIVE_ADVISOR_BACKEND_BASE_URL_ENV}`] =
      'http://localhost:8000/';
    process.env[`${LIVE_ADVISOR_BACKEND_API_KEY_ENV}`] = 'desktop-dev-key';

    expect(resolveLiveAdvisorBackendConfig()).toEqual({
      config: {
        baseUrl: 'http://localhost:8000',
        apiKey: 'desktop-dev-key',
      },
      errorMessage: null,
    });
  });
});
