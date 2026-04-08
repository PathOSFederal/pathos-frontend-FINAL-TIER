'use client';

import { ResumeWorkspaceScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../../_components/SharedDashboardRouteShell';

export default function ResumeWorkspaceNewPage() {
  return (
    <SharedDashboardRouteShell hideAdvisor>
      <ResumeWorkspaceScreen view="new" />
    </SharedDashboardRouteShell>
  );
}
