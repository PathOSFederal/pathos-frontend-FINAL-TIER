'use client';

import { use } from 'react';
import { ResumeWorkspaceScreen } from '@pathos/ui';
import { SharedDashboardRouteShell } from '../../../_components/SharedDashboardRouteShell';

export default function ResumeWorkspaceReviewPage(props: {
  params: Promise<{
    resumeId: string;
  }>;
}) {
  const params = use(props.params);
  return (
    <SharedDashboardRouteShell currentView="resume-review" hideAdvisor>
      <ResumeWorkspaceScreen view="review" resumeId={params.resumeId} />
    </SharedDashboardRouteShell>
  );
}
