/**
 * ============================================================================
 * RESUME EXPORT READINESS — Day 84 bounded readiness gate
 * ============================================================================
 *
 * PURPOSE:
 * The export gate answers one narrow question: based on the latest saved
 * backend diagnostics snapshot and the current known revision state, does this
 * resume variant appear ready to export right now?
 *
 * TRUST BOUNDARY:
 * This helper does not create new diagnostics logic. It only classifies saved
 * backend truth plus known revision freshness into a calm frontend-facing
 * readiness summary.
 */

import type {
  ResumeDiagnosticsIssue,
  ResumeMissingEvidenceItem,
  ResumeDiagnosticsWarning,
} from './resumeDiagnostics';
import type {
  ResumeDiagnosticsSnapshot,
  ResumeDraftSummary,
} from '../stores/resumeWorkspaceStore';

export type ResumeExportReadinessState =
  | 'not_evaluated'
  | 'stale_evaluation'
  | 'not_ready'
  | 'caution'
  | 'ready';

export interface ResumeExportReadinessItem {
  itemKey: string;
  code: string;
  title: string;
  detail: string;
}

export interface ResumeExportReadinessSummary {
  state: ResumeExportReadinessState;
  headline: string;
  detail: string;
  nextAction: string;
  isEvaluationCurrent: boolean;
  hasResumeChangedSinceEvaluation: boolean;
  lastEvaluatedAt: string | null;
  latestSnapshotId: string | null;
  latestSnapshotRevisionId: string | null;
  currentRevisionId: string;
  blockers: ResumeExportReadinessItem[];
  cautionItems: ResumeExportReadinessItem[];
}

function buildIssueItem(issue: ResumeDiagnosticsIssue): ResumeExportReadinessItem {
  return {
    itemKey: issue.issue_id,
    code: issue.code,
    title: issue.title,
    detail: issue.detail,
  };
}

function buildMissingEvidenceItem(item: ResumeMissingEvidenceItem): ResumeExportReadinessItem {
  const targetKeyParts: string[] = [];
  for (let i = 0; i < item.target_refs.length; i++) {
    const targetRef = item.target_refs[i];
    targetKeyParts.push(
      targetRef.section_id +
        '-' +
        (targetRef.bullet_id !== null && targetRef.bullet_id !== undefined
          ? targetRef.bullet_id
          : 'section')
    );
  }
  return {
    itemKey:
      item.code +
      '-' +
      (targetKeyParts.length > 0 ? targetKeyParts.join('|') : item.text),
    code: item.code,
    title: item.code.replace(/_/g, ' '),
    detail: item.text,
  };
}

function buildWarningItem(warning: ResumeDiagnosticsWarning): ResumeExportReadinessItem {
  return {
    itemKey: warning.code + '-' + warning.text,
    code: warning.code,
    title: warning.code.replace(/_/g, ' '),
    detail: warning.text,
  };
}

function hasBlockingBackendState(latestSnapshot: ResumeDiagnosticsSnapshot): boolean {
  const responseState = latestSnapshot.response.response_state;
  if (responseState === 'insufficient_input' || responseState === 'unsupported_context') {
    return true;
  }
  return latestSnapshot.response.overall.readiness_band === 'insufficient_evidence';
}

export function getResumeExportReadiness(
  activeSummary: ResumeDraftSummary,
  latestSnapshot: ResumeDiagnosticsSnapshot | null
): ResumeExportReadinessSummary {
  if (latestSnapshot === null) {
    return {
      state: 'not_evaluated',
      headline: 'No current export-readiness evaluation is available.',
      detail: 'Run diagnostics before treating this variant as ready to export.',
      nextAction: 'Run diagnostics',
      isEvaluationCurrent: false,
      hasResumeChangedSinceEvaluation: false,
      lastEvaluatedAt: null,
      latestSnapshotId: null,
      latestSnapshotRevisionId: null,
      currentRevisionId: activeSummary.currentRevisionId,
      blockers: [
        {
          itemKey: 'NO_EVALUATION-no-saved-evaluation',
          code: 'NO_EVALUATION',
          title: 'No saved evaluation',
          detail: 'This variant does not have a saved backend evaluation tied to the current workspace state.',
        },
      ],
      cautionItems: [],
    };
  }

  const latestSnapshotRevisionId =
    typeof latestSnapshot.revisionId === 'string' && latestSnapshot.revisionId.length > 0
      ? latestSnapshot.revisionId
      : null;
  const isEvaluationCurrent =
    latestSnapshotRevisionId !== null &&
    latestSnapshotRevisionId === activeSummary.currentRevisionId;

  if (!isEvaluationCurrent) {
    return {
      state: 'stale_evaluation',
      headline: 'The latest evaluation is stale relative to the current resume.',
      detail: 'This resume has changed since the last saved evaluation, so current export confidence is not trustworthy yet.',
      nextAction: 'Re-run evaluation',
      isEvaluationCurrent: false,
      hasResumeChangedSinceEvaluation: true,
      lastEvaluatedAt: latestSnapshot.evaluatedAt,
      latestSnapshotId: latestSnapshot.snapshotId,
      latestSnapshotRevisionId: latestSnapshotRevisionId,
      currentRevisionId: activeSummary.currentRevisionId,
      blockers: [
        {
          itemKey: 'STALE_EVALUATION-current-revision-mismatch',
          code: 'STALE_EVALUATION',
          title: 'Diagnostics are stale',
          detail:
            'Latest diagnostics reflect revision ' +
            (latestSnapshotRevisionId !== null ? latestSnapshotRevisionId : 'unknown') +
            ', while the current draft is revision ' +
            activeSummary.currentRevisionId +
            '.',
        },
      ],
      cautionItems: [],
    };
  }

  const blockers: ResumeExportReadinessItem[] = [];
  const cautionItems: ResumeExportReadinessItem[] = [];
  const issues = latestSnapshot.response.issues;
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    if (issue.severity === 'high') {
      blockers.push(buildIssueItem(issue));
    } else if (issue.severity === 'medium') {
      cautionItems.push(buildIssueItem(issue));
    }
  }

  const missingEvidence = latestSnapshot.response.missing_evidence;
  for (let i = 0; i < missingEvidence.length; i++) {
    cautionItems.push(buildMissingEvidenceItem(missingEvidence[i]));
  }

  const warnings = latestSnapshot.response.warnings;
  for (let i = 0; i < warnings.length; i++) {
    cautionItems.push(buildWarningItem(warnings[i]));
  }

  if (hasBlockingBackendState(latestSnapshot)) {
    if (latestSnapshot.response.response_state === 'insufficient_input') {
      blockers.push({
        itemKey: 'INSUFFICIENT_INPUT-backend-state',
        code: 'INSUFFICIENT_INPUT',
        title: 'Evaluation could not confirm export readiness',
        detail: 'The backend marked this resume as insufficient input, so export confidence is not ready yet.',
      });
    }
    if (latestSnapshot.response.response_state === 'unsupported_context') {
      blockers.push({
        itemKey: 'UNSUPPORTED_CONTEXT-backend-state',
        code: 'UNSUPPORTED_CONTEXT',
        title: 'Evaluation context is unsupported',
        detail: 'The backend declined the current targeting context, so export readiness cannot be treated as confirmed.',
      });
    }
    if (latestSnapshot.response.overall.readiness_band === 'insufficient_evidence') {
      blockers.push({
        itemKey: 'INSUFFICIENT_EVIDENCE-backend-state',
        code: 'INSUFFICIENT_EVIDENCE',
        title: 'Evidence is still insufficient',
        detail: latestSnapshot.response.overall.summary,
      });
    }
  }

  if (blockers.length > 0) {
    return {
      state: 'not_ready',
      headline: 'This variant is not ready to export yet.',
      detail: 'The latest evaluation is current, but blocking issues still need to be fixed before export confidence is strong enough.',
      nextAction: 'Fix blocking issues',
      isEvaluationCurrent: true,
      hasResumeChangedSinceEvaluation: false,
      lastEvaluatedAt: latestSnapshot.evaluatedAt,
      latestSnapshotId: latestSnapshot.snapshotId,
      latestSnapshotRevisionId: latestSnapshotRevisionId,
      currentRevisionId: activeSummary.currentRevisionId,
      blockers: blockers,
      cautionItems: cautionItems,
    };
  }

  if (cautionItems.length > 0 || latestSnapshot.response.overall.readiness_band === 'needs_revision') {
    return {
      state: 'caution',
      headline: 'This variant may be exportable, but caution items remain.',
      detail: 'The latest evaluation is current and no blocking issues were detected, but there are still medium-priority items worth reviewing before export.',
      nextAction: 'Review caution items',
      isEvaluationCurrent: true,
      hasResumeChangedSinceEvaluation: false,
      lastEvaluatedAt: latestSnapshot.evaluatedAt,
      latestSnapshotId: latestSnapshot.snapshotId,
      latestSnapshotRevisionId: latestSnapshotRevisionId,
      currentRevisionId: activeSummary.currentRevisionId,
      blockers: [],
      cautionItems: cautionItems,
    };
  }

  return {
    state: 'ready',
    headline: 'This variant appears ready to export.',
    detail: 'The latest evaluation matches the current revision and no blocking or caution-level items were detected from saved backend outputs.',
    nextAction: 'Ready to export',
    isEvaluationCurrent: true,
    hasResumeChangedSinceEvaluation: false,
    lastEvaluatedAt: latestSnapshot.evaluatedAt,
    latestSnapshotId: latestSnapshot.snapshotId,
    latestSnapshotRevisionId: latestSnapshotRevisionId,
    currentRevisionId: activeSummary.currentRevisionId,
    blockers: [],
    cautionItems: [],
  };
}
