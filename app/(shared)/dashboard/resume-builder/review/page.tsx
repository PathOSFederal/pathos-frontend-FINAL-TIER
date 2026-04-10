'use client';

import { SharedDashboardRouteShell } from '../../_components/SharedDashboardRouteShell';
import { SharedPlaceholderScreen } from '../../_components/SharedPlaceholderScreen';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function ResumeReviewPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="resume-builder-review"
      conversationIntelligence={intelligence}
    >
      <SharedPlaceholderScreen
        title="Resume Review"
        description="Resume review workspace is being migrated into shared UI."
      />
    </SharedDashboardRouteShell>
  );
}
