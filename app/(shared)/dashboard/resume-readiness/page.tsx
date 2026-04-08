'use client';

import { CareerScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';

export default function ResumeReadinessPage() {
  return (
    <SharedDashboardRouteShell>
      <div className="space-y-4">
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--p-border)',
            background: 'color-mix(in srgb, var(--p-warning) 10%, var(--p-surface))',
            color: 'var(--p-text)',
          }}
        >
          The Day 75 review shell now lives at <a href="/dashboard/resume" className="font-semibold underline underline-offset-2">/dashboard/resume</a> and <a href="/dashboard/resume/resume-master-seed/review" className="font-semibold underline underline-offset-2">/dashboard/resume/[resumeId]/review</a>. This legacy readiness route remains available only as a transition surface.
        </div>
        <CareerScreen />
      </div>
    </SharedDashboardRouteShell>
  );
}
