/**
 * ============================================================================
 * RESUME WORKSPACE PATHADVISOR CONTEXT HELPERS
 * ============================================================================
 *
 * PURPOSE:
 * Build short, bounded PathAdvisor context-log payloads from the canonical
 * resume workspace and review state.
 *
 * WHY THIS FILE EXISTS:
 * Resume Workspace already has the deepest authoritative resume context in the
 * frontend, but the shared PathAdvisor chat rail is hidden on those routes.
 * These helpers let the workspace publish concise, deterministic context
 * entries so the rest of PathOS can still carry that resume context forward.
 *
 * BOUNDARY:
 * - Only authoritative store and backend diagnostics fields are used.
 * - No new scoring or reasoning is generated here.
 * - Output is intentionally short because the downstream route_context payload
 *   stays bounded.
 */

import type { PathAdvisorContextSection } from '../stores/pathAdvisorContextLogStore';
import type {
  ResumeBuilderSection,
  ResumeDiagnosticsStatus,
  ResumeDraftSummary,
  ResumeWorkspaceRouteView,
} from '../stores/resumeWorkspaceStore';
import type {
  ResumeDiagnosticsEvaluateResponse,
  ResumeSectionExplanation,
} from './resumeDiagnostics';
import { formatReadinessBandLabel } from './resumeDiagnostics';

export interface ResumePathAdvisorSelectionPayload {
  title: string;
  subtitle?: string;
  lines: string[];
}

export interface ResumePathAdvisorContextEntryPayload {
  title: string;
  subtitle?: string;
  sections: PathAdvisorContextSection[];
  dedupeKey: string;
}

function readNonEmptyText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function formatModeLabel(mode: ResumeDraftSummary['mode']): string {
  if (mode === 'master') {
    return 'Master resume';
  }
  return 'Tailored variant';
}

function formatStatusLabel(status: ResumeDraftSummary['status']): string {
  if (status === 'ready-to-export') {
    return 'Ready to export';
  }
  if (status === 'needs-review') {
    return 'Needs review';
  }
  if (status === 'tailored') {
    return 'Tailored';
  }
  return 'Draft';
}

function formatViewLabel(view: ResumeWorkspaceRouteView): string {
  if (view === 'review') {
    return 'Resume review';
  }
  if (view === 'builder') {
    return 'Resume builder';
  }
  if (view === 'new') {
    return 'New resume flow';
  }
  return 'Resume workspace';
}

function formatSectionLabel(section: ResumeBuilderSection): string {
  if (section === 'contact') {
    return 'Contact';
  }
  if (section === 'summary') {
    return 'Summary';
  }
  if (section === 'experience') {
    return 'Experience';
  }
  if (section === 'education') {
    return 'Education';
  }
  if (section === 'skills') {
    return 'Skills';
  }
  return 'Review';
}

function formatDiagnosticsStatusHeading(status: ResumeDiagnosticsStatus): string {
  if (status === 'loading') {
    return 'Running backend diagnostics';
  }
  if (status === 'insufficient_input') {
    return 'More resume evidence is needed';
  }
  if (status === 'unsupported_context') {
    return 'The current targeting context is unsupported';
  }
  if (status === 'error') {
    return 'Diagnostics could not be loaded';
  }
  if (status === 'unavailable') {
    return 'Diagnostics are unavailable';
  }
  if (status === 'evaluated') {
    return 'Backend diagnostics';
  }
  return 'Diagnostics not run yet';
}

function formatDiagnosticsStatusMessage(status: ResumeDiagnosticsStatus): string {
  if (status === 'loading') {
    return 'PathOS is waiting on the backend diagnostics contract to evaluate the current draft.';
  }
  if (status === 'insufficient_input') {
    return 'Add more resume evidence or target context, then run diagnostics again.';
  }
  if (status === 'unsupported_context') {
    return 'The backend declined this context. Review the warnings and try a supported role or linked job target.';
  }
  if (status === 'error') {
    return 'The diagnostics request failed. Try again after checking the current draft and network state.';
  }
  if (status === 'unavailable') {
    return 'The diagnostics service is not available right now.';
  }
  if (status === 'evaluated') {
    return 'These explanations and recommendations come directly from the backend diagnostics response.';
  }
  return 'Run diagnostics to replace placeholder guidance with backend-owned findings.';
}

function buildSubtitle(summary: ResumeDraftSummary): string | undefined {
  const parts: string[] = [formatModeLabel(summary.mode)];
  const targetRole = readNonEmptyText(summary.targetContext.targetRoleTitle);

  if (targetRole !== null) {
    parts.push(targetRole);
  }

  return parts.join(' • ');
}

function pushBullet(target: string[], value: string | null): void {
  if (value !== null && target.indexOf(value) === -1) {
    target.push(value);
  }
}

function buildTakeawayBullets(
  diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null
): string[] {
  const bullets: string[] = [];

  if (
    diagnosticsResponse === null ||
    diagnosticsResponse.explanations === null ||
    diagnosticsResponse.explanations === undefined ||
    !Array.isArray(diagnosticsResponse.explanations.key_takeaways)
  ) {
    return bullets;
  }

  for (
    let i = 0;
    i < diagnosticsResponse.explanations.key_takeaways.length && bullets.length < 4;
    i++
  ) {
    const takeaway = diagnosticsResponse.explanations.key_takeaways[i];
    const title = readNonEmptyText(takeaway.title);
    const detail = readNonEmptyText(takeaway.detail);
    pushBullet(bullets, title !== null ? title : detail);
  }

  return bullets;
}

function buildWarningBullets(
  diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null
): string[] {
  const bullets: string[] = [];

  if (
    diagnosticsResponse !== null &&
    diagnosticsResponse.explanations !== null &&
    diagnosticsResponse.explanations !== undefined &&
    Array.isArray(diagnosticsResponse.explanations.warning_explanations)
  ) {
    for (
      let i = 0;
      i < diagnosticsResponse.explanations.warning_explanations.length && bullets.length < 4;
      i++
    ) {
      const warning = diagnosticsResponse.explanations.warning_explanations[i];
      const title = readNonEmptyText(warning.title);
      const detail = readNonEmptyText(warning.detail);
      pushBullet(bullets, title !== null ? title : detail);
    }
  }

  if (diagnosticsResponse !== null && bullets.length === 0) {
    for (
      let i = 0;
      i < diagnosticsResponse.missing_evidence.length && bullets.length < 4;
      i++
    ) {
      pushBullet(bullets, readNonEmptyText(diagnosticsResponse.missing_evidence[i].text));
    }
  }

  return bullets;
}

function buildRecommendationBullets(
  diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null
): string[] {
  const bullets: string[] = [];

  if (
    diagnosticsResponse !== null &&
    diagnosticsResponse.explanations !== null &&
    diagnosticsResponse.explanations !== undefined &&
    Array.isArray(diagnosticsResponse.explanations.recommendation_explanations)
  ) {
    for (
      let i = 0;
      i < diagnosticsResponse.explanations.recommendation_explanations.length &&
      bullets.length < 4;
      i++
    ) {
      const recommendation =
        diagnosticsResponse.explanations.recommendation_explanations[i];
      const title = readNonEmptyText(recommendation.title);
      const actionHint = readNonEmptyText(recommendation.action_hint);
      const shortExplanation = readNonEmptyText(recommendation.short_explanation);
      pushBullet(
        bullets,
        title !== null
          ? title
          : actionHint !== null
            ? actionHint
            : shortExplanation
      );
    }
  }

  if (diagnosticsResponse !== null && bullets.length < 4) {
    for (
      let i = 0;
      i < diagnosticsResponse.recommendations.length && bullets.length < 4;
      i++
    ) {
      pushBullet(bullets, readNonEmptyText(diagnosticsResponse.recommendations[i].title));
    }
  }

  return bullets;
}

function buildSummaryLines(
  diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null,
  diagnosticsStatus: ResumeDiagnosticsStatus
): string[] {
  const lines: string[] = [];

  if (diagnosticsResponse === null) {
    lines.push(formatDiagnosticsStatusHeading(diagnosticsStatus));
    lines.push(formatDiagnosticsStatusMessage(diagnosticsStatus));
    return lines;
  }

  if (
    diagnosticsResponse.explanations !== null &&
    diagnosticsResponse.explanations !== undefined &&
    diagnosticsResponse.explanations.overall_summary !== null &&
    diagnosticsResponse.explanations.overall_summary !== undefined
  ) {
    const headline = readNonEmptyText(
      diagnosticsResponse.explanations.overall_summary.headline
    );
    const detail = readNonEmptyText(
      diagnosticsResponse.explanations.overall_summary.detail
    );
    const topPriority = readNonEmptyText(
      diagnosticsResponse.explanations.overall_summary.top_priority
    );

    pushBullet(lines, headline);
    pushBullet(lines, detail);
    pushBullet(lines, topPriority);
  }

  if (lines.length === 0) {
    pushBullet(lines, readNonEmptyText(diagnosticsResponse.overall.summary));
  }

  return lines;
}

export function buildResumePathAdvisorSelectionPayload(params: {
  view: ResumeWorkspaceRouteView;
  summary: ResumeDraftSummary;
}): ResumePathAdvisorSelectionPayload {
  const lines: string[] = [
    'Current view: ' + formatViewLabel(params.view),
    'Mode: ' + formatModeLabel(params.summary.mode),
    'Resume status: ' + formatStatusLabel(params.summary.status),
  ];
  const targetRole = readNonEmptyText(params.summary.targetContext.targetRoleTitle);

  lines.push(
    'Target role: ' + (targetRole !== null ? targetRole : 'None attached yet')
  );

  return {
    title:
      (params.view === 'review' ? 'Reviewing resume: ' : 'Selected resume: ') +
      params.summary.name,
    subtitle: buildSubtitle(params.summary),
    lines: lines,
  };
}

export function buildResumePathAdvisorContextEntry(params: {
  view: ResumeWorkspaceRouteView;
  summary: ResumeDraftSummary;
  diagnosticsStatus: ResumeDiagnosticsStatus;
  diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null;
  activeSection: ResumeBuilderSection | null;
  activeSectionExplanation: ResumeSectionExplanation | null;
  selectedSnapshotId: string | null;
  snapshotEvaluatedAt: string | null;
}): ResumePathAdvisorContextEntryPayload {
  const sections: PathAdvisorContextSection[] = [];
  const workspaceLines: string[] = [
    'Current view: ' + formatViewLabel(params.view),
    'Resume status: ' + formatStatusLabel(params.summary.status),
  ];

  if (params.view === 'builder' && params.activeSection !== null) {
    workspaceLines.push(
      'Active section: ' + formatSectionLabel(params.activeSection)
    );
  }

  sections.push({
    title: 'Workspace state',
    lines: workspaceLines,
  });

  if (params.diagnosticsResponse === null) {
    sections.push({
      title: 'Diagnostics state',
      lines: [
        formatDiagnosticsStatusHeading(params.diagnosticsStatus),
        formatDiagnosticsStatusMessage(params.diagnosticsStatus),
      ],
    });
  } else {
    const diagnosticsLines: string[] = [
      'Readiness: ' + formatReadinessBandLabel(params.diagnosticsResponse.overall.readiness_band),
      'Response state: ' + params.diagnosticsResponse.response_state,
    ];

    if (
      params.selectedSnapshotId !== null &&
      params.selectedSnapshotId.trim().length > 0
    ) {
      diagnosticsLines.push('Snapshot: ' + params.selectedSnapshotId);
    }
    if (
      params.snapshotEvaluatedAt !== null &&
      params.snapshotEvaluatedAt.trim().length > 0
    ) {
      diagnosticsLines.push('Evaluated at: ' + params.snapshotEvaluatedAt);
    }

    sections.push({
      title: 'Diagnostics state',
      lines: diagnosticsLines,
    });
  }

  const summaryLines = buildSummaryLines(
    params.diagnosticsResponse,
    params.diagnosticsStatus
  );
  if (summaryLines.length > 0) {
    sections.push({
      title: 'PathAdvisor summary',
      lines: summaryLines,
    });
  }

  if (
    params.view === 'builder' &&
    params.activeSectionExplanation !== null &&
    sections.length < 6
  ) {
    const focusedGuidanceLines: string[] = [];
    const title = readNonEmptyText(params.activeSectionExplanation.title);
    const whyItMatters = readNonEmptyText(
      params.activeSectionExplanation.why_it_matters
    );
    const whatToDo = readNonEmptyText(params.activeSectionExplanation.what_to_do);

    pushBullet(focusedGuidanceLines, title);
    pushBullet(focusedGuidanceLines, whyItMatters);
    pushBullet(focusedGuidanceLines, whatToDo);

    if (focusedGuidanceLines.length > 0) {
      sections.push({
        title: 'Focused guidance',
        lines: focusedGuidanceLines,
      });
    }
  }

  const takeawayBullets = buildTakeawayBullets(params.diagnosticsResponse);
  if (takeawayBullets.length > 0 && sections.length < 6) {
    sections.push({
      title: 'Key takeaways',
      bullets: takeawayBullets,
    });
  }

  const warningBullets = buildWarningBullets(params.diagnosticsResponse);
  if (warningBullets.length > 0 && sections.length < 6) {
    sections.push({
      title: 'Warnings or missing evidence',
      bullets: warningBullets,
    });
  }

  const recommendationBullets = buildRecommendationBullets(
    params.diagnosticsResponse
  );
  if (recommendationBullets.length > 0 && sections.length < 6) {
    sections.push({
      title: 'Next actions',
      bullets: recommendationBullets,
    });
  }

  return {
    title:
      (params.view === 'review' ? 'Resume review: ' : 'Resume workspace: ') +
      params.summary.name,
    subtitle: buildSubtitle(params.summary),
    sections: sections,
    dedupeKey:
      'resume-context:' +
      params.view +
      ':' +
      params.summary.id +
      ':' +
      params.summary.currentRevisionId +
      ':' +
      params.diagnosticsStatus +
      ':' +
      (params.activeSection !== null ? params.activeSection : 'none') +
      ':' +
      (params.selectedSnapshotId !== null ? params.selectedSnapshotId : 'none') +
      ':' +
      (params.diagnosticsResponse !== null
        ? params.diagnosticsResponse.response_state +
          ':' +
          params.diagnosticsResponse.overall.readiness_band
        : 'no-diagnostics'),
  };
}
