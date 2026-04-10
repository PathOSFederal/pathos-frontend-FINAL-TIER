'use client';

import { CareerReadinessScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

export default function CareerReadinessPage() {
  const intelligence = useCareerResumeIntelligence();

  return (
    <SharedDashboardRouteShell
      currentView="career-readiness"
      conversationIntelligence={intelligence}
    >
      <CareerReadinessScreen intelligence={intelligence} />
    </SharedDashboardRouteShell>
  );
}
