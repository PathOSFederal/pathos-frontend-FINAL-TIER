import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  NavigationProvider,
  type NavigationAdapter,
  type NavLinkProps,
} from '@pathos/adapters';
import {
  RESUME_WORKSPACE_STORAGE_KEY,
  useResumeWorkspaceStore,
} from '../stores/resumeWorkspaceStore';
import { ResumeWorkspaceScreen } from './ResumeWorkspaceScreen';

function noop(text?: string) {
  void text;
}

const testAdapter: NavigationAdapter = {
  pathname: '/dashboard/resume',
  push: noop,
  replace: noop,
  back: function () {
    /* noop for tests */
  },
};

function TestLink(props: NavLinkProps) {
  return (
    <a href={props.href} className={props.className} onClick={props.onClick}>
      {props.children}
    </a>
  );
}

function renderInNavigation(element: React.ReactNode) {
  return renderToString(
    <NavigationProvider adapter={testAdapter} linkComponent={TestLink}>
      {element}
    </NavigationProvider>
  );
}


describe('ResumeWorkspaceScreen', function () {
  beforeEach(function () {
    localStorage.removeItem(RESUME_WORKSPACE_STORAGE_KEY);
    useResumeWorkspaceStore.getState().hydrate();
  });

  it('renders the workspace home with the create new resume CTA', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="home" />);
    expect(output).toContain('Resume Workspace');
    expect(output).toContain('Create new resume');
  });

  it('renders the guided new flow step shell', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="new" />);
    expect(output).toContain('New Resume Flow');
    expect(output).toContain('What are you creating');
  });

  it('renders the builder shell with section rail, document canvas, and mode toggle', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="builder" resumeId="resume-master-seed" />);
    /* Section rail entries still present in the slim left rail */
    expect(output).toContain('Summary');
    expect(output).toContain('Experience');
    expect(output).toContain('Education');
    expect(output).toContain('Skills');
    /* Mode toggle buttons in the top bar */
    expect(output).toContain('Canvas');
    expect(output).toContain('Guidance');
    expect(output).toContain('Diagnostics');
    /* Focus guidance button is present on the active section */
    expect(output).toContain('Focus guidance');
    /* Right rail is hidden by default in canvas mode */
    expect(output).not.toContain('Attached to active section');
    /* Save/review actions in top bar */
    expect(output).toContain('Save master');
    expect(output).toContain('Review');
  });

  it('renders a resume-not-found fallback for an invalid builder resume id', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="builder" resumeId="missing-resume-id" />);
    expect(output).toContain('Resume not found');
    expect(output).toContain('Return to workspace');
  });

  it('renders the dedicated review shell', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="review" resumeId="resume-master-seed" />);
    expect(output).toContain('Review / Optimize');
    expect(output).toContain('Export readiness');
    expect(output).toContain('PathAdvisor summary');
    expect(output).toContain('Key takeaways');
  });

  it('keeps review as a handoff surface instead of rendering the rewrite panel there', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="review" resumeId="resume-master-seed" />);
    expect(output).toContain('Rewrite suggestions open in the builder');
    expect(output).not.toContain('AI rewrite assistance');
  });

});
