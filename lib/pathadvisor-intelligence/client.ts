import type {
  DashboardIntelligencePayload,
  ResumeBuilderIntelligencePayload,
} from '@pathos/ui';
import {
  adaptDashboardIntelligencePayload,
  adaptResumeBuilderIntelligencePayload,
  type BackendDashboardIntelligencePayload,
  type BackendResumeBuilderIntelligencePayload,
} from '@/lib/live-advisor/adapter';

interface ErrorPayload {
  error?: string;
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }

  return JSON.parse(text) as unknown;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload !== null && payload !== undefined && typeof payload === 'object') {
    const typed = payload as ErrorPayload;
    if (typeof typed.error === 'string' && typed.error.trim() !== '') {
      return typed.error;
    }
  }

  return fallback;
}

export async function fetchDashboardIntelligence(): Promise<DashboardIntelligencePayload> {
  const response = await fetch('/api/pathadvisor/intelligence/dashboard', {
    cache: 'no-store',
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(
      extractMessage(payload, 'The frontend could not load dashboard intelligence.')
    );
  }

  return adaptDashboardIntelligencePayload(payload as BackendDashboardIntelligencePayload);
}

export async function fetchResumeBuilderIntelligence(): Promise<ResumeBuilderIntelligencePayload> {
  const response = await fetch('/api/pathadvisor/intelligence/resume-builder', {
    cache: 'no-store',
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(
      extractMessage(payload, 'The frontend could not load resume builder intelligence.')
    );
  }

  return adaptResumeBuilderIntelligencePayload(
    payload as BackendResumeBuilderIntelligencePayload
  );
}
