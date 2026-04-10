'use client';

import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { SharedPlaceholderScreen } from '../_components/SharedPlaceholderScreen';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function UsajobsPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="usajobs"
      conversationIntelligence={intelligence}
    >
      <SharedPlaceholderScreen
        title="USAJOBS"
        description="Review USAJOBS workflow modules in the shared dashboard."
      />
    </SharedDashboardRouteShell>
  );
}
