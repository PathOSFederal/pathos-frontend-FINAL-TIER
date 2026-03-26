'use client';

import { useCallback, useEffect } from 'react';
import {
  JobSearchScreen,
  type JobSearchLiveAdvisorIntegration,
  type JobSearchLiveSearchIntegration,
} from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { useProfileStore } from '@/store/profileStore';
import {
  fetchLiveJobSearchEvaluation,
  fetchLiveJobSearchResults,
} from '@/lib/live-advisor/client';

export default function JobSearchPage() {
  /**
   * Job Search uses the persisted frontend profile as the user evidence source
   * for backend advisor evaluation. This keeps the selected-job flow aligned
   * with the same runtime contract used by Saved Jobs.
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

  const liveAdvisor = useCallback<JobSearchLiveAdvisorIntegration['evaluateJob']>(
    async function (job) {
      return fetchLiveJobSearchEvaluation(job, profile);
    },
    [profile]
  );

  /**
   * Job Search results now run through the same frontend-to-backend boundary as
   * live evaluation. The page wrapper owns the transport so the shared screen
   * stays focused on UI state and selection behavior.
   */
  const liveSearch = useCallback<JobSearchLiveSearchIntegration['searchJobs']>(
    async function (input) {
      return fetchLiveJobSearchResults(input);
    },
    []
  );

  return (
    <SharedDashboardRouteShell>
      <JobSearchScreen
        liveAdvisor={{
          evaluateJob: liveAdvisor,
        }}
        liveSearch={{
          searchJobs: liveSearch,
        }}
      />
    </SharedDashboardRouteShell>
  );
}
