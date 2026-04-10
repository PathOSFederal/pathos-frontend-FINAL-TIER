'use client';

import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { SharedPlaceholderScreen } from '../_components/SharedPlaceholderScreen';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function CompensationPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="compensation"
      conversationIntelligence={intelligence}
    >
      <SharedPlaceholderScreen
        title="Compensation"
        description="Review compensation planning modules in the shared dashboard."
      />
    </SharedDashboardRouteShell>
  );
}
