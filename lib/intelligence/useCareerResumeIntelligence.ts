'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfileStore } from '@/store/profileStore';
import {
  useResumeWorkspaceStore,
  type UnifiedCareerResumeIntelligenceState,
} from '@pathos/ui';
import {
  fetchCareerReadinessSnapshot,
  fetchResumeReadinessSnapshot,
} from './client';
import {
  buildCareerReadinessRequest,
  buildResumeReadinessRequest,
  buildWorkspaceResumeSource,
  formatSnapshotUpdatedLabel,
} from './mappers';

function uniqueMessages(values: Array<string | null>): string | null {
  const output: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value.trim() === '') {
      continue;
    }
    if (output.indexOf(value) === -1) {
      output.push(value);
    }
  }
  if (output.length === 0) {
    return null;
  }
  return output.join(' • ');
}

export function useCareerResumeIntelligence(): UnifiedCareerResumeIntelligenceState {
  const profile = useProfileStore(function (state) {
    return state.profile;
  });
  const isProfileLoaded = useProfileStore(function (state) {
    return state.isLoaded;
  });
  const loadProfileFromStorage = useProfileStore(function (state) {
    return state.loadFromStorage;
  });
  const hydrateResumeWorkspace = useResumeWorkspaceStore(function (state) {
    return state.hydrate;
  });
  const activeResumeId = useResumeWorkspaceStore(function (state) {
    return state.activeResumeId;
  });
  const activeSummary = useResumeWorkspaceStore(function (state) {
    if (state.activeResumeId === null) {
      return null;
    }
    for (let i = 0; i < state.resumes.length; i++) {
      if (state.resumes[i].id === state.activeResumeId) {
        return state.resumes[i];
      }
    }
    return null;
  });
  const activeDraft = useResumeWorkspaceStore(function (state) {
    if (state.activeResumeId === null) {
      return null;
    }
    return state.resumeDrafts[state.activeResumeId] ?? null;
  });

  const [careerReadiness, setCareerReadiness] =
    useState<UnifiedCareerResumeIntelligenceState['careerReadiness']>(null);
  const [resumeReadiness, setResumeReadiness] =
    useState<UnifiedCareerResumeIntelligenceState['resumeReadiness']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(function () {
    if (!isProfileLoaded) {
      loadProfileFromStorage();
    }
  }, [isProfileLoaded, loadProfileFromStorage]);

  useEffect(function () {
    hydrateResumeWorkspace();
  }, [hydrateResumeWorkspace]);

  const workspaceResume = useMemo(
    function () {
      return buildWorkspaceResumeSource(activeSummary);
    },
    [activeSummary]
  );

  const careerRequest = useMemo(
    function () {
      return buildCareerReadinessRequest(profile, activeResumeId);
    },
    [profile, activeResumeId]
  );

  const resumeRequest = useMemo(
    function () {
      return buildResumeReadinessRequest(
        activeSummary,
        activeDraft,
        careerRequest.target_role
      );
    },
    [activeSummary, activeDraft, careerRequest.target_role]
  );

  const careerRequestKey = useMemo(
    function () {
      return JSON.stringify(careerRequest);
    },
    [careerRequest]
  );

  const resumeRequestKey = useMemo(
    function () {
      return resumeRequest === null ? 'resume:none' : JSON.stringify(resumeRequest);
    },
    [resumeRequest]
  );

  const refresh = useCallback(function () {
    setRefreshToken(function (value) {
      return value + 1;
    });
  }, []);

  useEffect(
    function () {
      if (!isProfileLoaded) {
        return;
      }

      let isCancelled = false;

      async function loadSnapshots(): Promise<void> {
        setIsRefreshing(true);

        const careerResult = await fetchCareerReadinessSnapshot(careerRequest);
        const nextCareerSnapshot = careerResult.ok ? careerResult.snapshot : null;

        const resumeResult =
          resumeRequest !== null
            ? await fetchResumeReadinessSnapshot(resumeRequest)
            : null;
        const nextResumeSnapshot =
          resumeResult !== null && resumeResult.ok ? resumeResult.snapshot : null;

        if (isCancelled) {
          return;
        }

        setCareerReadiness(nextCareerSnapshot);
        setResumeReadiness(nextResumeSnapshot);
        setErrorMessage(
          uniqueMessages([
            careerResult.ok ? null : careerResult.errorMessage,
            resumeResult !== null && !resumeResult.ok
              ? resumeResult.errorMessage
              : null,
          ])
        );
        setIsRefreshing(false);
      }

      void loadSnapshots();

      return function () {
        isCancelled = true;
      };
    },
    [careerRequest, careerRequestKey, isProfileLoaded, refreshToken, resumeRequest, resumeRequestKey]
  );

  const source =
    careerReadiness !== null && resumeReadiness !== null
      ? 'live'
      : careerReadiness !== null || resumeReadiness !== null
        ? 'partial_live'
        : 'fallback';

  return {
    source: source,
    isRefreshing: isRefreshing,
    lastUpdatedLabel: formatSnapshotUpdatedLabel([
      careerReadiness?.meta.generated_at,
      resumeReadiness?.meta.generated_at,
    ]),
    errorMessage: errorMessage,
    careerReadiness: careerReadiness,
    resumeReadiness: resumeReadiness,
    workspaceResume: workspaceResume,
    refresh: refresh,
  };
}
