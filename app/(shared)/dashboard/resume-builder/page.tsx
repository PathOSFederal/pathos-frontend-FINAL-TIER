'use client';

import { ResumeBuilderScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';

/**
 * Resume Builder hides the PathAdvisor right rail because the builder
 * provides its own section-scoped callout guidance layer. Having both
 * the callout layer and the PathAdvisor rail visible creates competing
 * guidance surfaces.
 */
export default function ResumeBuilderPage() {
  return (
    <SharedDashboardRouteShell hideAdvisor>
      <div className="space-y-4">
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--p-border)',
            background: 'color-mix(in srgb, var(--p-warning) 10%, var(--p-surface))',
            color: 'var(--p-text)',
          }}
        >
          The Day 75 guided resume workspace now lives at <a href="/dashboard/resume" className="font-semibold underline underline-offset-2">/dashboard/resume</a>. This legacy builder route remains available for compatibility while review and migration finish.
        </div>
        <ResumeBuilderScreen />
      </div>
    </SharedDashboardRouteShell>
  );
}
