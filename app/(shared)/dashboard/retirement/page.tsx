'use client';

import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { SharedPlaceholderScreen } from '../_components/SharedPlaceholderScreen';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function RetirementPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="retirement"
      conversationIntelligence={intelligence}
    >
      <SharedPlaceholderScreen
        title="Retirement"
        description="Review retirement planning modules in the shared dashboard."
      />
    </SharedDashboardRouteShell>
  );
}
