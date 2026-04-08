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
    expect(output).toContain('Resume Workspace Home');
    expect(output).toContain('Create new resume');
  });

  it('renders the guided new flow step shell', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="new" />);
    expect(output).toContain('New Resume Flow');
    expect(output).toContain('What are you creating');
  });

  it('renders the builder shell with left rail, canvas, and right rail', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="builder" resumeId="resume-master-seed" />);
    expect(output).toContain('Resume canvas');
    expect(output).toContain('Sections');
    expect(output).toContain('Right rail');
  });

  it('renders a resume-not-found fallback for an invalid builder resume id', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="builder" resumeId="missing-resume-id" />);
    expect(output).toContain('Resume not found');
    expect(output).toContain('Return to workspace');
  });

  it('renders the dedicated review shell', function () {
    const output = renderInNavigation(<ResumeWorkspaceScreen view="review" resumeId="resume-master-seed" />);
    expect(output).toContain('Review / Optimize');
    expect(output).toContain('Overall readiness band');
    expect(output).toContain('Category breakdown');
  });
});
