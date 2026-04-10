'use client';

import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { SharedPlaceholderScreen } from '../_components/SharedPlaceholderScreen';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function BenefitsPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="benefits"
      conversationIntelligence={intelligence}
    >
      <SharedPlaceholderScreen
        title="Benefits"
        description="Review benefits planning modules in the shared dashboard."
      />
    </SharedDashboardRouteShell>
  );
}
