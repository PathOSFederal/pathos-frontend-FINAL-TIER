'use client';

import { use } from 'react';
import { ResumeWorkspaceScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../../_components/SharedDashboardRouteShell';

/**
 * RESUME REVIEW & GUIDANCE — Structured diagnostics and section guidance
 *
 * WHY THIS IS NOT THE PRIMARY EDITOR:
 * The canonical document-centered editor lives at /dashboard/resume-builder.
 * This route provides the structured review and guidance experience —
 * section-level diagnostics, focus guidance, and rewrite assistance that
 * complement the main editing workflow. Users reach the editor via
 * "Open builder" from the workspace hub; they reach this surface via
 * "Review" or when they want a deeper diagnostics pass.
 *
 * BACKEND WIRING:
 * Diagnostics evaluation (POST /api/resume/diagnostics/evaluate) and rewrite
 * assistance (POST /api/resume/rewrite-assist) are preserved exactly as-is.
 */
export default function ResumeWorkspaceBuilderPage(props: {
  params: Promise<{
    resumeId: string;
  }>;
}) {
  const params = use(props.params);
  return (
    <SharedDashboardRouteShell currentView="resume-workspace" hideAdvisor>
      <ResumeWorkspaceScreen view="builder" resumeId={params.resumeId} />
    </SharedDashboardRouteShell>
  );
}
