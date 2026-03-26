/**
 * ============================================================================
 * LIVE ADVISOR ADAPTER TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Protect the thin frontend contract boundary used by the live Saved Jobs
 * integration. These tests make sure backend payloads are normalized into the
 * shared UI model without inventing fields or dropping explainability data.
 */

import { describe, expect, it } from 'vitest';
import { demoJobSeekerProfile } from '@/lib/api/profile';
import {
  adaptAdvisorEvaluation,
  adaptLiveJobSearchResponse,
  adaptStoredJobCatalogItems,
  buildLiveJobSearchRequest,
  buildJobSearchEvaluationRequest,
  buildStoredJobEvaluationRequest,
  shouldApplyJobSearchEvaluationResult,
} from './adapter';

describe('live advisor adapter', function () {
  it('adapts stored canonical job summaries into live saved-job records', function () {
    const result = adaptStoredJobCatalogItems([
      {
        saved_search_id: 'saved-search-1',
        job_id: '123456789',
        title: 'Program Analyst',
        organization: 'Department of Veterans Affairs',
        locations: ['Washington, DC'],
        grade_min: 12,
        grade_max: 13,
        salary_min: 98000,
        salary_max: 128000,
        open_date: '2026-03-20',
        close_date: '2026-03-31',
        apply_url: 'https://www.usajobs.gov/job/123456789',
        source_name: 'usajobs',
        last_seen_at: '2026-03-26T10:00:00Z',
      },
    ]);

    expect(result).toEqual([
      {
        savedSearchId: 'saved-search-1',
        jobId: '123456789',
        title: 'Program Analyst',
        organization: 'Department of Veterans Affairs',
        locations: ['Washington, DC'],
        gradeMin: 12,
        gradeMax: 13,
        salaryMin: 98000,
        salaryMax: 128000,
        openDate: '2026-03-20',
        closeDate: '2026-03-31',
        applyUrl: 'https://www.usajobs.gov/job/123456789',
        sourceName: 'usajobs',
        lastSeenAt: '2026-03-26T10:00:00Z',
      },
    ]);
  });

  it('adapts backend advisor output while preserving explainability fields', function () {
    const result = adaptAdvisorEvaluation({
      recommendation: 'consider',
      decision_band: 'caution',
      confidence_band: 'medium',
      overall_score: 72,
      reasons: [
        {
          code: 'ROLE_ALIGNMENT',
          rule_id: 'role_alignment_positive',
          basis: 'known',
          text: 'Your target role overlaps with this posting.',
          severity: 'info',
          suggestion: 'Review the duties section before applying.',
          importance: 'high',
          evidence_refs: [
            {
              label: 'profile.goals.targetSeries',
              source_category: 'profile',
              fact_status: 'known',
            },
          ],
        },
      ],
      gaps: [],
      warnings: [
        {
          code: 'MISSING_EVIDENCE',
          rule_id: 'missing_resume_signal',
          basis: 'missing',
          text: 'Resume evidence was not available.',
          severity: 'warning',
          suggestion: 'Upload a recent resume.',
          importance: 'medium',
          evidence_refs: [
            {
              label: 'profile.resume',
              source_category: 'missing',
              fact_status: 'missing',
            },
          ],
        },
      ],
      missing_evidence: [
        {
          code: 'MISSING_SKILLS',
          rule_id: 'missing_skill_signal',
          basis: 'missing',
          text: 'No skills evidence was provided.',
          severity: 'warning',
          suggestion: 'Add skills to your profile.',
          importance: 'medium',
          evidence_refs: [
            {
              label: 'profile.skills',
              source_category: 'missing',
              fact_status: 'missing',
            },
          ],
        },
      ],
      next_actions: [
        {
          code: 'ADD_SKILLS',
          action: 'Add skills before treating this as a strong fit.',
          priority: 1,
        },
      ],
      application_decision: {
        decision_band: 'consider',
        priority_level: 'medium',
        alert_importance: 'medium',
        rationale_summary: 'There is enough signal to review the role closely.',
        blocking_issues: [
          {
            code: 'NO_RESUME',
            rule_id: 'resume_missing',
            source_type: 'profile',
            severity: 'warning',
            text: 'No resume evidence is linked.',
            evidence_refs: [
              {
                label: 'profile.resume',
                source_category: 'missing',
                fact_status: 'missing',
              },
            ],
          },
        ],
        recommended_next_actions: [
          {
            code: 'REFRESH_PROFILE',
            action: 'Refresh profile evidence and review missing fields.',
            priority: 1,
          },
        ],
        decision_rule_ids: ['decision_consider_partial'],
        decision_version: 'decision-v1',
      },
      meta: {
        explainability_version: 'explainability-v1',
        engine_version: 'qualification-v1',
      },
    });

    expect(result.recommendation).toBe('consider');
    expect(result.decisionBand).toBe('caution');
    expect(result.confidenceBand).toBe('medium');
    expect(result.reasons[0].ruleId).toBe('role_alignment_positive');
    expect(result.reasons[0].evidenceRefs[0].sourceCategory).toBe('profile');
    expect(result.warnings[0].evidenceRefs[0].factStatus).toBe('missing');
    expect(result.applicationDecision !== null).toBe(true);
    if (result.applicationDecision === null) {
      throw new Error('Expected application decision to exist.');
    }
    expect(result.applicationDecision.decisionRuleIds).toEqual([
      'decision_consider_partial',
    ]);
    expect(result.applicationDecision.blockingIssues[0].ruleId).toBe(
      'resume_missing'
    );
    expect(result.explainabilityVersion).toBe('explainability-v1');
    expect(result.engineVersion).toBe('qualification-v1');
  });

  it('builds a stored-job evaluation request from the frontend profile', function () {
    const profile = Object.assign({}, demoJobSeekerProfile, {
      name: 'Casey Operator',
      goals: Object.assign({}, demoJobSeekerProfile.goals, {
        targetSeries: ['0343', '2210'],
        nextCareerMove: 'Program analyst',
      }),
      location: Object.assign({}, demoJobSeekerProfile.location, {
        currentMetroArea: 'Baltimore, MD',
        preferredLocations: ['Washington, DC'],
      }),
      jobSeeker: {
        highestEducation: 'bachelor',
        yearsOfExperience: 7,
      },
    });

    const result = buildStoredJobEvaluationRequest(
      {
        savedSearchId: 'saved-search-2',
        jobId: '987654321',
        title: 'Program Analyst',
        organization: 'Department of Labor',
        locations: ['Washington, DC'],
        gradeMin: 11,
        gradeMax: 12,
        salaryMin: 88000,
        salaryMax: 111000,
        openDate: '2026-03-19',
        closeDate: '2026-03-29',
        applyUrl: 'https://www.usajobs.gov/job/987654321',
        sourceName: 'usajobs',
        lastSeenAt: '2026-03-26T10:00:00Z',
      },
      profile
    );

    expect(result.saved_search_id).toBe('saved-search-2');
    expect(result.job_id).toBe('987654321');
    expect(result.profile.user_id).toBe('Casey Operator');
    expect(result.profile.years_experience).toBe(7);
    expect(result.profile.target_roles).toEqual([
      '0343',
      '2210',
      'Program analyst',
    ]);
    expect(result.profile.preferred_locations).toEqual([
      'Washington, DC',
      'Baltimore, MD',
    ]);
    expect(result.profile.authorized_to_work).toBe(true);
  });

  it('builds a generic advisor request from a Job Search job', function () {
    const profile = Object.assign({}, demoJobSeekerProfile, {
      name: 'Jordan Reviewer',
      goals: Object.assign({}, demoJobSeekerProfile.goals, {
        targetSeries: ['2210'],
        nextCareerMove: 'Cybersecurity specialist',
      }),
      location: Object.assign({}, demoJobSeekerProfile.location, {
        currentMetroArea: 'Washington, DC',
        preferredLocations: ['Remote'],
      }),
      jobSeeker: {
        highestEducation: 'bachelor',
        yearsOfExperience: 5,
      },
    });

    const result = buildJobSearchEvaluationRequest(
      {
        id: 'mock-js-7',
        title: 'IT Specialist (INFOSEC)',
        agency: 'Department of Defense',
        location: 'Remote',
        grade: 'GS-13',
        url: 'https://www.usajobs.gov/job/123450001',
        summary: 'Cybersecurity role',
        savedAt: '2026-03-26T12:00:00Z',
        overview: {
          remoteJob: 'Yes',
          teleworkEligible: 'Yes',
        },
      },
      profile
    );

    expect(result.profile.user_id).toBe('Jordan Reviewer');
    expect(result.profile.target_roles).toEqual([
      '2210',
      'Cybersecurity specialist',
    ]);
    expect(result.job.job_id).toBe('123450001');
    expect(result.job.company).toBe('Department of Defense');
    expect(result.job.location.remote).toBe(true);
    expect(result.job.grade_range).toEqual({
      min_grade: 13,
      max_grade: 13,
    });
    expect(result.job.source_url).toBe('https://www.usajobs.gov/job/123450001');
  });

  it('builds a live backend search request from frontend Job Search state', function () {
    const result = buildLiveJobSearchRequest({
      keyword: 'program analyst',
      location: 'Washington, DC',
      filters: {
        gradeBand: 'GS-12',
        series: '0343',
        agency: 'Department of Veterans Affairs',
        appointmentType: 'Competitive',
        remoteType: 'Remote',
      },
      page: 2,
      pageSize: 10,
    });

    expect(result.keyword).toBe('program analyst');
    expect(result.location).toBe('Washington, DC');
    expect(result.remote_only).toBe(true);
    expect(result.grade_min).toBe(12);
    expect(result.grade_max).toBe(12);
    expect(result.series).toEqual(['0343']);
    expect(result.agency_codes).toBe(null);
    expect(result.appointment_type).toBe('Competitive');
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(10);
  });

  it('adapts canonical backend search results into frontend Job rows', function () {
    const result = adaptLiveJobSearchResponse({
      results: [
        {
          id: 'usajobs-1',
          title: 'Program Analyst',
          organization: 'Department of Veterans Affairs',
          locations: ['Washington, DC', 'Remote'],
          compensation: {
            grade_min: 11,
            grade_max: 12,
            salary_min: 82000,
            salary_max: 111000,
          },
          open_date: '2026-03-20',
          close_date: '2026-03-31',
          apply_url: 'https://www.usajobs.gov/job/123456',
          source: {
            source: 'USAJOBS',
            retrieved_at: '2026-03-26T10:00:00Z',
            mapper_version: 'usajobs-normalize-v1',
          },
        },
      ],
      total: 48,
      page: 1,
      page_size: 20,
      request_id: 'request-123',
    });

    expect(result.total).toBe(48);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.requestId).toBe('request-123');
    expect(result.results).toEqual([
      {
        id: 'usajobs-1',
        title: 'Program Analyst',
        agency: 'Department of Veterans Affairs',
        location: 'Washington, DC | Remote',
        grade: 'GS-11 - GS-12',
        salaryRange: '$82000 - $111000',
        url: 'https://www.usajobs.gov/job/123456',
        savedAt: '2026-03-26T10:00:00Z',
        closeDate: '2026-03-31',
        telework: 'Remote',
      },
    ]);
  });

  it('accepts only the newest live Job Search evaluation result for the same selected job', function () {
    expect(
      shouldApplyJobSearchEvaluationResult('mock-js-1', 3, 'mock-js-1', 3)
    ).toBe(true);
    expect(
      shouldApplyJobSearchEvaluationResult('mock-js-1', 4, 'mock-js-1', 3)
    ).toBe(false);
    expect(
      shouldApplyJobSearchEvaluationResult('mock-js-2', 3, 'mock-js-1', 3)
    ).toBe(false);
  });
});
