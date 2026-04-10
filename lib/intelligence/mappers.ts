import type { Profile, EducationLevel } from '@/lib/api/profile';
import type { ResumeDraft } from '@pathos/core';
import {
  buildResumeDiagnosticsRequest,
  type ResumeDraftSummary,
  type UnifiedCareerResumeWorkspaceSource,
} from '@pathos/ui';

export interface CareerReadinessRequestPayload {
  user_profile: Record<string, unknown>;
  target_role: string;
  resume_id?: string | null;
}

export interface ResumeReadinessRequestPayload {
  resume_text: string;
  resume_id?: string | null;
  target_role: string;
}

function mapEducationLevel(level: EducationLevel | null | undefined): string {
  if (level === 'associate') {
    return 'Associate';
  }
  if (level === 'bachelor') {
    return 'Bachelor';
  }
  if (level === 'master') {
    return 'Master';
  }
  if (level === 'doctorate') {
    return 'Doctorate';
  }
  if (level === 'high_school') {
    return 'High School';
  }
  if (level === 'other') {
    return 'Other';
  }
  return 'Unknown';
}

function stripEmpty(values: Array<string | null | undefined>): string[] {
  const output: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value !== null && value !== undefined && value.trim() !== '') {
      output.push(value.trim());
    }
  }
  return output;
}

function selectPrimarySeries(profile: Profile): string {
  if (profile.goals.targetSeries.length > 0 && profile.goals.targetSeries[0].trim() !== '') {
    return profile.goals.targetSeries[0].trim();
  }
  if (profile.current !== null && profile.current.series.trim() !== '') {
    return 'Series ' + profile.current.series.trim();
  }
  if (profile.goals.nextCareerMove.trim() !== '') {
    return profile.goals.nextCareerMove.trim();
  }
  return 'Federal role';
}

function selectGradeLabel(profile: Profile): string | null {
  const gradeFrom = profile.goals.targetGradeFrom;
  const gradeTo = profile.goals.targetGradeTo;

  if (
    gradeFrom !== null &&
    gradeTo !== null &&
    gradeFrom.trim() !== '' &&
    gradeTo.trim() !== '' &&
    gradeFrom.trim() !== gradeTo.trim()
  ) {
    return gradeFrom.trim() + ' to ' + gradeTo.trim();
  }

  if (gradeFrom !== null && gradeFrom.trim() !== '') {
    return gradeFrom.trim();
  }

  if (gradeTo !== null && gradeTo.trim() !== '') {
    return gradeTo.trim();
  }

  if (profile.current !== null && profile.current.grade.trim() !== '') {
    return profile.current.grade.trim();
  }

  return null;
}

function selectLocation(profile: Profile): string | null {
  if (profile.location.preferredLocations.length > 0) {
    return profile.location.preferredLocations[0];
  }
  if (profile.location.currentMetroArea.trim() !== '') {
    return profile.location.currentMetroArea.trim();
  }
  if (profile.current !== null && profile.current.dutyLocation.trim() !== '') {
    return profile.current.dutyLocation.trim();
  }
  return null;
}

export function buildCareerTargetRole(profile: Profile): string {
  return stripEmpty([selectGradeLabel(profile), selectPrimarySeries(profile)]).join(' ');
}

export function buildCareerReadinessRequest(
  profile: Profile,
  workspaceResumeId?: string | null
): CareerReadinessRequestPayload {
  const targetRole = buildCareerTargetRole(profile);
  const location = selectLocation(profile);
  const currentSeries =
    profile.current !== null && profile.current.series.trim() !== ''
      ? profile.current.series.trim()
      : null;
  const agency =
    profile.current !== null && profile.current.agency.trim() !== ''
      ? profile.current.agency.trim()
      : null;

  return {
    user_profile: {
      years_experience:
        profile.jobSeeker !== null ? profile.jobSeeker.yearsOfExperience : 0,
      education_level: mapEducationLevel(
        profile.jobSeeker !== null ? profile.jobSeeker.highestEducation : null
      ),
      target_series: profile.goals.targetSeries.slice(),
      current_series: currentSeries,
      grade:
        selectGradeLabel(profile) !== null ? selectGradeLabel(profile) : '',
      agency: agency,
      location: location,
    },
    target_role: targetRole,
    resume_id:
      workspaceResumeId !== undefined && workspaceResumeId !== null && workspaceResumeId.trim() !== ''
        ? workspaceResumeId
        : null,
  };
}

export function buildResumeReadinessRequest(
  summary: ResumeDraftSummary | null,
  draft: ResumeDraft | null,
  fallbackTargetRole: string
): ResumeReadinessRequestPayload | null {
  if (summary === null || draft === null) {
    return null;
  }

  const diagnosticsRequest = buildResumeDiagnosticsRequest(summary, draft);
  const resumeText = diagnosticsRequest.resume.document_text;
  if (resumeText === null || resumeText === undefined || resumeText.trim() === '') {
    return null;
  }

  const targetRole =
    summary.targetContext.targetRoleTitle.trim() !== ''
      ? summary.targetContext.targetRoleTitle.trim()
      : fallbackTargetRole;

  return {
    resume_text: resumeText.trim(),
    resume_id: summary.id,
    target_role: targetRole,
  };
}

export function buildWorkspaceResumeSource(
  summary: ResumeDraftSummary | null
): UnifiedCareerResumeWorkspaceSource | null {
  if (summary === null) {
    return null;
  }

  return {
    id: summary.id,
    name: summary.name,
    mode: summary.mode,
    updatedAt: summary.updatedAt,
    targetRoleTitle:
      summary.targetContext.targetRoleTitle.trim() !== ''
        ? summary.targetContext.targetRoleTitle.trim()
        : null,
  };
}

export function formatSnapshotUpdatedLabel(
  timestamps: Array<string | null | undefined>
): string | null {
  let latest: Date | null = null;

  for (let i = 0; i < timestamps.length; i++) {
    const value = timestamps[i];
    if (value === null || value === undefined || value.trim() === '') {
      continue;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    if (latest === null || parsed.getTime() > latest.getTime()) {
      latest = parsed;
    }
  }

  if (latest === null) {
    return null;
  }

  return latest.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
