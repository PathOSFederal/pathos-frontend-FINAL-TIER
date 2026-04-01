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
      <ResumeBuilderScreen />
    </SharedDashboardRouteShell>
  );
}
