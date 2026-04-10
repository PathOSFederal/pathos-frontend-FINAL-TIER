'use client';

import { useCallback, useEffect } from 'react';
import { SavedJobsScreen, type SavedJobsLiveStoredJob } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { useProfileStore } from '@/store/profileStore';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';
import {
  fetchLiveSavedJobsSummary,
  fetchLiveStoredJobIntelligence,
  fetchLiveStoredJobs,
} from '@/lib/live-advisor/client';

export default function SavedJobsPage() {
  const intelligence = useCareerResumeIntelligence();
  /**
   * The live Saved Jobs integration depends on the persisted frontend profile so
   * the backend receives real user context instead of a frontend mock payload.
   */
  const profile = useProfileStore(function (state) {
    return state.profile;
  });
  const isProfileLoaded = useProfileStore(function (state) {
    return state.isLoaded;
  });
  const loadProfileFromStorage = useProfileStore(function (state) {
    return state.loadFromStorage;
  });

  useEffect(function () {
    if (!isProfileLoaded) {
      loadProfileFromStorage();
    }
  }, [isProfileLoaded, loadProfileFromStorage]);

  /**
   * Load the recent canonical stored jobs that already exist in the backend.
   *
   * Important for this phase: this bypasses the old local mock saved-jobs seed
   * path so the actual Saved Jobs page is evaluating live persisted records.
   */
  const loadStoredJobs = useCallback(async function () {
    return fetchLiveStoredJobs();
  }, []);

  /**
   * Evaluate one backend-backed stored job using the current frontend profile.
   *
   * The profile-to-backend mapping stays in the adapter layer so the page keeps
   * orchestration responsibilities only.
   */
  const evaluateStoredJob = useCallback(
    async function (storedJob: SavedJobsLiveStoredJob) {
      return fetchLiveStoredJobIntelligence(storedJob, profile);
    },
    [profile]
  );

  const loadSummary = useCallback(async function () {
    return fetchLiveSavedJobsSummary(profile);
  }, [profile]);

  return (
    <SharedDashboardRouteShell
      currentView="saved-jobs"
      conversationIntelligence={intelligence}
    >
      <SavedJobsScreen
        liveAdvisor={{
          loadStoredJobs: loadStoredJobs,
          evaluateStoredJob: evaluateStoredJob,
          loadSummary: loadSummary,
        }}
      />
    </SharedDashboardRouteShell>
  );
}
