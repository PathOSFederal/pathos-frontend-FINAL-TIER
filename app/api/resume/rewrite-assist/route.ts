/**
 * ============================================================================
 * RESUME REWRITE ASSISTANCE PROXY ROUTE — Day 85
 * ============================================================================
 *
 * PURPOSE:
 * Provide the smallest honest same-origin boundary for bounded rewrite
 * assistance. The browser never talks to the backend directly, and the route
 * validates that the payload stays anchored to resume diagnostics truth.
 *
 * IMPORTANT:
 * The backend rewrite endpoint is not guaranteed to exist yet. This route
 * therefore keeps the contract explicit and lets 404/5xx failures pass back to
 * the client as honest "unavailable" states instead of fabricating local text.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiveAdvisorBackendConfig } from '@/lib/live-advisor/backend';

interface BackendErrorPayload {
  detail?: string | { code?: string; message?: string } | null;
}

function isPlainObject(payload: unknown): payload is Record<string, unknown> {
  return payload !== null && !Array.isArray(payload) && typeof payload === 'object';
}

function hasOnlyAllowedKeys(payload: Record<string, unknown>, allowedKeys: string[]): boolean {
  const actualKeys = Object.keys(payload);
  for (let i = 0; i < actualKeys.length; i++) {
    if (allowedKeys.indexOf(actualKeys[i]) === -1) {
      return false;
    }
  }
  return true;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isRewriteCandidate(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.candidate_id === 'string' &&
    value.candidate_id.trim() !== '' &&
    isNullableString(value.label) &&
    typeof value.text === 'string' &&
    value.text.trim() !== '' &&
    isNullableString(value.rationale)
  );
}

function isRewriteRequestPayload(payload: unknown): boolean {
  if (!isPlainObject(payload)) {
    return false;
  }
  if (!hasOnlyAllowedKeys(payload, ['rewrite_request_id', 'resume', 'target', 'grounding'])) {
    return false;
  }
  if (
    typeof payload.rewrite_request_id !== 'string' ||
    payload.rewrite_request_id.trim() === '' ||
    !isPlainObject(payload.resume) ||
    !isPlainObject(payload.target) ||
    !isPlainObject(payload.grounding)
  ) {
    return false;
  }

  const resume = payload.resume;
  const target = payload.target;
  const grounding = payload.grounding;

  if (
    !hasOnlyAllowedKeys(resume, [
      'resume_id',
      'variant_id',
      'revision_id',
      'snapshot_id',
      'diagnostics_id',
    ]) ||
    !hasOnlyAllowedKeys(target, ['section_id', 'bullet_id', 'original_text']) ||
    !hasOnlyAllowedKeys(grounding, [
      'issue_code',
      'recommendation_code',
      'explanation_title',
      'explanation_detail',
      'action_hint',
      'target_role',
    ])
  ) {
    return false;
  }

  return (
    isNullableString(resume.resume_id) &&
    typeof resume.variant_id === 'string' &&
    resume.variant_id.trim() !== '' &&
    typeof resume.revision_id === 'string' &&
    resume.revision_id.trim() !== '' &&
    typeof resume.snapshot_id === 'string' &&
    resume.snapshot_id.trim() !== '' &&
    typeof resume.diagnostics_id === 'string' &&
    resume.diagnostics_id.trim() !== '' &&
    typeof target.section_id === 'string' &&
    target.section_id.trim() !== '' &&
    isNullableString(target.bullet_id) &&
    typeof target.original_text === 'string' &&
    target.original_text.trim() !== '' &&
    isNullableString(grounding.issue_code) &&
    isNullableString(grounding.recommendation_code) &&
    isNullableString(grounding.explanation_title) &&
    isNullableString(grounding.explanation_detail) &&
    isNullableString(grounding.action_hint) &&
    isNullableString(grounding.target_role)
  );
}

async function readBackendPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }
  return JSON.parse(text) as unknown;
}

function extractBackendErrorMessage(
  payload: unknown,
  fallbackMessage: string
): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }
  if (typeof payload !== 'object') {
    return fallbackMessage;
  }
  const typedPayload = payload as BackendErrorPayload;
  if (typeof typedPayload.detail === 'string' && typedPayload.detail.trim() !== '') {
    return typedPayload.detail;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.message === 'string' &&
    typedPayload.detail.message.trim() !== ''
  ) {
    return typedPayload.detail.message;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.code === 'string' &&
    typedPayload.detail.code.trim() !== ''
  ) {
    return 'Resume rewrite backend request failed: ' + typedPayload.detail.code;
  }
  return fallbackMessage;
}

function isRewriteResponsePayload(payload: unknown): boolean {
  if (!isPlainObject(payload)) {
    return false;
  }
  if (
    typeof payload.rewrite_request_id !== 'string' ||
    payload.rewrite_request_id.trim() === '' ||
    payload.status !== 'ready' ||
    !Array.isArray(payload.candidates)
  ) {
    return false;
  }
  if (payload.candidates.length === 0 || payload.candidates.length > 3) {
    return false;
  }
  for (let i = 0; i < payload.candidates.length; i++) {
    if (!isRewriteCandidate(payload.candidates[i])) {
      return false;
    }
  }
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const backend = resolveLiveAdvisorBackendConfig();
  if (backend.config === null) {
    return NextResponse.json(
      {
        error: backend.errorMessage,
      },
      { status: 500 }
    );
  }

  const requestPayload = (await request.json()) as unknown;
  if (!isRewriteRequestPayload(requestPayload)) {
    return NextResponse.json(
      {
        error:
          'The resume rewrite route requires a bounded diagnostics-grounded rewrite payload.',
      },
      { status: 400 }
    );
  }

  const response = await fetch(
    backend.config.baseUrl + '/api/v1/resume/rewrite-assist/generate',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + backend.config.apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(requestPayload),
    }
  );
  const payload = await readBackendPayload(response);

  if (!response.ok) {
    return NextResponse.json(
      {
        error: extractBackendErrorMessage(
          payload,
          'The backend did not return any resume rewrite candidates.'
        ),
      },
      { status: response.status }
    );
  }

  if (!isRewriteResponsePayload(payload)) {
    return NextResponse.json(
      {
        error:
          'The backend rewrite response was malformed. PathOS refused to apply any suggestion.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
