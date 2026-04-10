'use client';

import { ResumeWorkspaceScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../_components/SharedDashboardRouteShell';

export default function ResumeWorkspaceHomePage() {
  return (
    <SharedDashboardRouteShell currentView="resume-workspace" hideAdvisor>
      <ResumeWorkspaceScreen view="home" />
    </SharedDashboardRouteShell>
  );
}
