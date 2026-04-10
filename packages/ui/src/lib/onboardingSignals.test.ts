import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitOnboardingSignal } from './onboardingSignals';

function buildStorage() {
  const map = new Map<string, string>();
  return {
    getItem: function (key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem: function (key: string, value: string) {
      map.set(key, value);
    },
    removeItem: function (key: string) {
      map.delete(key);
    },
    clear: function () {
      map.clear();
    },
  };
}

afterEach(function () {
  vi.restoreAllMocks();
});

describe('emitOnboardingSignal', function () {
  it('skips emission when there is no active onboarding session id', async function () {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('window', {
      localStorage: buildStorage(),
      sessionStorage: buildStorage(),
      fetch: fetchSpy,
    });

    await emitOnboardingSignal('job_search', 'job_saved', {
      role_family: 'Program Analyst',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a bounded signal to the frontend onboarding route', async function () {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    const localStorage = buildStorage();
    localStorage.setItem('pathos_onboarding_session_id', 'session-1');
    vi.stubGlobal('window', {
      localStorage: localStorage,
      sessionStorage: buildStorage(),
      fetch: fetchSpy,
    });

    await emitOnboardingSignal('resume_builder', 'resume_validation_completed', {
      readiness_score: 58,
      gap_count: 2,
      validation_status: '2 issues need attention',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/onboarding/session/session-1/signal');
  });
});
