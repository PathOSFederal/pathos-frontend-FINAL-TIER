'use client';

import { useEffect, useState } from 'react';
import {
  ResumeBuilderScreen,
  type ResumeBuilderIntelligencePayload,
} from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { fetchResumeBuilderIntelligence } from '@/lib/pathadvisor-intelligence/client';

/**
 * RESUME BUILDER — Canonical document-centered editing experience
 *
 * WHY THIS IS THE PRIMARY EDITOR:
 * This route hosts the document-centered canvas builder, which is the
 * canonical resume editing surface. Users reach this page via "Open builder"
 * from the Resume Workspace hub (/dashboard/resume). The PathAdvisor right
 * rail is hidden because the builder provides its own section-scoped callout
 * guidance layer — having both would create competing guidance surfaces.
 *
 * BACKEND WIRING:
 * The builder fetches PathAdvisor intelligence on mount for contextual
 * guidance. All save, rewrite, and export flows are handled by the
 * ResumeBuilderScreen component via @pathos/core stores.
 */
export default function ResumeBuilderPage() {
  const [intelligencePayload, setIntelligencePayload] =
    useState<ResumeBuilderIntelligencePayload | null>(null);

  useEffect(function () {
    let cancelled = false;

    void fetchResumeBuilderIntelligence()
      .then(function (payload) {
        if (!cancelled) {
          setIntelligencePayload(payload);
        }
      })
      .catch(function () {
        if (!cancelled) {
          setIntelligencePayload(null);
        }
      });

    return function () {
      cancelled = true;
    };
  }, []);

  return (
    <SharedDashboardRouteShell hideAdvisor>
      <ResumeBuilderScreen intelligencePayload={intelligencePayload} />
    </SharedDashboardRouteShell>
  );
}
