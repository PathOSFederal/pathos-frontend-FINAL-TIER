import { describe, expect, it } from 'vitest';
import { createDefaultDraft } from '@pathos/core';
import type { ResumeDraftSummary } from '../stores/resumeWorkspaceStore';
import {
  buildResumeDiagnosticsRequest,
  collectTargetedBuilderSections,
} from './resumeDiagnostics';

function buildSummary(): ResumeDraftSummary {
  return {
    id: 'resume-123',
    variantId: 'resume-123',
    name: 'Program Analyst Variant',
    mode: 'tailored',
    status: 'tailored',
    updatedAt: '2026-04-08T13:00:00.000Z',
    targetContext: {
      targetRoleTitle: 'Program Analyst',
      seriesGrade: 'GS-0343 / GS-12',
      agencyDomain: 'HHS',
      jobAnnouncementText: 'Implementation and reporting role.',
      plainLanguageGoal: 'Tailor to a federal analyst role.',
      linkedJobId: null,
    },
    linkedToResumeId: 'resume-master-seed',
    sourceVariantId: 'resume-master-seed',
    currentRevisionId: 'revision-123',
    latestSnapshotId: null,
  };
}

describe('resumeDiagnostics helpers', function () {
  it('assembles a full-document diagnostics request from the current draft', function () {
    const draft = createDefaultDraft();
    draft.contact.fullName = 'Jordan Ellis';
    draft.contact.email = 'jordan@example.gov';
    draft.contact.phone = '202-555-0101';
    draft.contact.city = 'Washington';
    draft.contact.state = 'DC';
    draft.summary = 'Program analyst focused on delivery and reporting.';
    draft.experience.push({
      id: 'exp-1',
      jobTitle: 'Analyst',
      employer: 'Agency',
      location: 'DC',
      startDate: '2022',
      endDate: 'Present',
      hoursPerWeek: '40',
      grade: 'GS-12',
      duties: 'Improved reporting cadence.\nTracked milestones.',
    });
    draft.education.push({
      id: 'edu-1',
      institution: 'George Mason University',
      degree: 'MPA',
      field: 'Public Administration',
      graduationDate: '2021',
      gpa: '',
    });
    draft.skills.push({
      id: 'skill-1',
      name: 'Program analysis',
    });

    const request = buildResumeDiagnosticsRequest(buildSummary(), draft);

    expect(request.scope.evaluation_mode).toBe('full_document');
    expect(request.resume.resume_id).toBe('resume-123');
    expect(request.resume.revision_id).toBe('revision-123');
    expect(request.target_context).toEqual({
      mode: 'role',
      target_role: 'Program Analyst',
      canonical_job_id: null,
    });
    expect(request.resume.sections[0].section_id).toBe('contact');
    expect(request.resume.sections.some(function (section) {
      return section.section_id === 'experience';
    })).toBe(true);
    const experienceSection = request.resume.sections.find(function (section) {
      return section.section_id === 'experience';
    });
    expect(experienceSection !== undefined && Array.isArray(experienceSection.bullets)).toBe(true);
    if (experienceSection !== undefined && Array.isArray(experienceSection.bullets)) {
      expect(experienceSection.bullets[0].bullet_id).toBe('exp-1-bullet-0');
      expect(experienceSection.bullets[1].text).toBe('Tracked milestones.');
    }
  });

  it('maps target refs back to builder sections without duplicates', function () {
    const sections = collectTargetedBuilderSections([
      { section_id: 'experience', bullet_id: 'exp-1-bullet-0' },
      { section_id: 'experience', bullet_id: 'exp-1-bullet-1' },
      { section_id: 'skills', bullet_id: null },
      { section_id: 'certifications', bullet_id: null },
    ]);

    expect(sections).toEqual(['experience', 'skills', 'review']);
  });
});
