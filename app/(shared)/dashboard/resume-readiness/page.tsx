'use client';

import Link from 'next/link';
import { CareerScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function ResumeReadinessPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="resume-readiness"
      conversationIntelligence={intelligence}
    >
      <div className="space-y-4">
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--p-border)',
            background: 'color-mix(in srgb, var(--p-warning) 10%, var(--p-surface))',
            color: 'var(--p-text)',
          }}
        >
          The Day 75 review shell now lives at <Link href="/dashboard/resume" className="font-semibold underline underline-offset-2">/dashboard/resume</Link> and <Link href="/dashboard/resume/resume-master-seed/review" className="font-semibold underline underline-offset-2">/dashboard/resume/[resumeId]/review</Link>. This legacy readiness route remains available only as a transition surface.
        </div>
        <CareerScreen intelligence={intelligence} />
      </div>
    </SharedDashboardRouteShell>
  );
}
