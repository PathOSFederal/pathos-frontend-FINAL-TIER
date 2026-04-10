import { describe, expect, it } from 'vitest';
import { createDefaultDraft } from '@pathos/core';
import type { Profile } from '@/lib/api/profile';
import {
  buildCareerReadinessRequest,
  buildResumeReadinessRequest,
} from './mappers';

function buildProfile(): Profile {
  return {
    name: 'Alex Chen',
    persona: 'job_seeker',
    isComplete: true,
    avatarUrl: null,
    current: null,
    jobSeeker: {
      highestEducation: 'bachelor',
      yearsOfExperience: 3,
    },
    goals: {
      targetSeries: ['Program Analyst (0343)'],
      targetGradeFrom: 'GS-7',
      targetGradeTo: 'GS-9',
      goalTimeHorizon: '1_3_years',
      nextCareerMove: '',
      gradeBand: 'early',
    },
    location: {
      currentMetroArea: 'Washington, DC Metro',
      relocationWillingness: 'stay_local',
      preferredLocations: ['Washington, DC'],
      workArrangement: 'hybrid',
    },
    benefits: {
      householdCoverage: 'self_only',
      targetTspContribution: 5,
      riskComfort: 3,
    },
    preferences: {
      priorities: [],
      advisorTone: 'more_context',
      globalPrivacyDefault: false,
      pathAdvisorDock: 'right',
      theme: 'system',
    },
  };
}

describe('intelligence mappers', function () {
  it('builds a deterministic career-readiness request from the frontend profile', function () {
    const request = buildCareerReadinessRequest(buildProfile(), 'resume-123');

    expect(request.target_role).toBe('GS-7 to GS-9 Program Analyst (0343)');
    expect(request.resume_id).toBe('resume-123');
    expect(request.user_profile.education_level).toBe('Bachelor');
    expect(request.user_profile.location).toBe('Washington, DC');
  });

  it('builds a resume-readiness request from the active workspace draft', function () {
    const draft = createDefaultDraft();
    draft.summary = 'Federal analyst with reporting and program support experience.';
    draft.experience.push({
      id: 'exp-1',
      jobTitle: 'Program Analyst',
      employer: 'HHS',
      location: 'Washington, DC',
      startDate: '2022',
      endDate: 'Present',
      hoursPerWeek: '40',
      grade: 'GS-12',
      duties: 'Tracked program delivery metrics.\nDrafted leadership updates.',
    });

    const request = buildResumeReadinessRequest(
      {
        id: 'resume-123',
        variantId: 'resume-123',
        name: 'Program Analyst Resume',
        mode: 'master',
        status: 'draft',
        updatedAt: '2026-04-09T12:00:00Z',
        targetContext: {
          targetRoleTitle: 'GS-12 Program Analyst (0343)',
          seriesGrade: '',
          agencyDomain: '',
          jobAnnouncementText: '',
          plainLanguageGoal: '',
          linkedJobId: null,
        },
        linkedToResumeId: null,
        sourceVariantId: null,
        currentRevisionId: 'revision-1',
        latestSnapshotId: null,
      },
      draft,
      'GS-12 Program Analyst (0343)'
    );

    expect(request).not.toBeNull();
    expect(request?.resume_id).toBe('resume-123');
    expect(request?.target_role).toBe('GS-12 Program Analyst (0343)');
    expect(request?.resume_text).toContain('Federal analyst with reporting and program support experience.');
    expect(request?.resume_text).toContain('Tracked program delivery metrics.');
  });
});
