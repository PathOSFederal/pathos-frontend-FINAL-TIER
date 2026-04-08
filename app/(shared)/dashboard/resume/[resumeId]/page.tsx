'use client';

import { use } from 'react';
import { ResumeWorkspaceScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../../_components/SharedDashboardRouteShell';

export default function ResumeWorkspaceBuilderPage(props: {
  params: Promise<{
    resumeId: string;
  }>;
}) {
  const params = use(props.params);
  return (
    <SharedDashboardRouteShell hideAdvisor>
      <ResumeWorkspaceScreen view="builder" resumeId={params.resumeId} />
    </SharedDashboardRouteShell>
  );
}
