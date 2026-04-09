/**
 * ============================================================================
 * RESUME REWRITE PANEL — Day 85 bounded candidate review UI
 * ============================================================================
 *
 * PURPOSE:
 * Render the current rewrite-assistance request state as a compact, explicit
 * review surface. The user always sees:
 * - the original text
 * - the bounded candidate options
 * - explicit apply and dismiss controls
 *
 * TRUST BOUNDARY:
 * This component never chooses a candidate automatically. It only renders the
 * request state that already exists in the store.
 */

 'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  ResumeRewriteCandidate,
  ResumeRewriteState,
} from './resumeRewrite';

/**
 * Keep the progressive reveal math pure and testable.
 *
 * Why this exists:
 * Day 85e keeps the backend request honest. We do not fake streaming before
 * the response exists. Once a bounded candidate arrives, we can still reveal it
 * progressively on the client so the builder feels active instead of dumping a
 * full block of text at once.
 */
export function sliceResumeRewriteCandidateText(
  text: string,
  visibleCharacterCount: number
): string {
  if (visibleCharacterCount <= 0) {
    return '';
  }
  if (visibleCharacterCount >= text.length) {
    return text;
  }
  return text.slice(0, visibleCharacterCount);
}

export function buildResumeRewriteLoadingLabel(frame: number): string {
  const normalizedFrame = frame % 3;
  if (normalizedFrame === 1) {
    return 'Rewriting..';
  }
  if (normalizedFrame === 2) {
    return 'Rewriting...';
  }
  return 'Rewriting.';
}

function stateLabel(state: ResumeRewriteState['status']): string {
  if (state === 'loading') {
    return 'Loading';
  }
  if (state === 'ready') {
    return 'Ready';
  }
  if (state === 'applied') {
    return 'Applied';
  }
  if (state === 'dismissed') {
    return 'Dismissed';
  }
  if (state === 'unavailable') {
    return 'Unavailable';
  }
  if (state === 'error') {
    return 'Error';
  }
  return 'Idle';
}

function stateTone(state: ResumeRewriteState['status']): string {
  if (state === 'ready' || state === 'applied') {
    return 'var(--p-accent)';
  }
  if (state === 'loading') {
    return 'var(--p-warning)';
  }
  if (state === 'unavailable' || state === 'error') {
    return 'var(--p-danger)';
  }
  return 'var(--p-text-muted)';
}

function rewriteTargetLabel(request: ResumeRewriteState['request']): string {
  if (request === null) {
    return 'Builder section';
  }
  if (request.target.section_id === 'summary') {
    return 'Summary section';
  }
  if (request.target.section_id === 'experience') {
    return request.target.bullet_id !== null ? 'Experience bullet' : 'Experience section';
  }
  if (request.target.section_id === 'skills') {
    return 'Skills section';
  }
  return request.target.section_id + ' section';
}

function ResumeRewriteCandidateCard(props: {
  candidate: ResumeRewriteCandidate;
  isApplied: boolean;
  visibleText: string;
  isRevealing: boolean;
  onApply: (candidateId: string) => void;
}) {
  return (
    <div
      className="rounded-xl border p-4 transition-colors duration-150"
      style={{
        borderColor: props.isApplied ? 'var(--p-success)' : 'var(--p-border)',
        background: props.isApplied
          ? 'color-mix(in srgb, var(--p-success) 8%, var(--p-surface))'
          : 'var(--p-surface2)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            {props.candidate.label !== null ? props.candidate.label : 'Candidate rewrite'}
          </div>
          {props.candidate.rationale !== null ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--p-text-dim)' }}>
              {props.candidate.rationale}
            </p>
          ) : null}
        </div>
        {props.isApplied ? (
          <span
            className="rounded-full border px-2 py-1 text-xs font-semibold"
            style={{ borderColor: 'var(--p-success)', color: 'var(--p-success)' }}
          >
            Applied
          </span>
        ) : null}
      </div>
      <div
        className="mt-3 rounded-lg border px-3 py-3 text-sm"
        style={{
          borderColor: props.isApplied ? 'var(--p-success)' : 'color-mix(in srgb, var(--p-accent) 24%, var(--p-border))',
          background: props.isApplied
            ? 'color-mix(in srgb, var(--p-success) 10%, var(--p-surface))'
            : 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))',
          color: 'var(--p-text)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {props.visibleText.length > 0 ? props.visibleText : ''}
        {props.isRevealing ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block"
            style={{ color: 'var(--p-accent)' }}
          >
            |
          </span>
        ) : null}
      </div>
      {props.isRevealing ? (
        <div className="mt-2 text-xs font-medium" style={{ color: 'var(--p-text-dim)' }}>
          Revealing candidate text...
        </div>
      ) : null}
      {!props.isApplied ? (
        <button
          type="button"
          onClick={function () {
            props.onApply(props.candidate.candidate_id);
          }}
          className="mt-3 rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
          style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
        >
          Apply this rewrite
        </button>
      ) : null}
    </div>
  );
}

export interface ResumeRewritePanelProps {
  rewrite: ResumeRewriteState;
  onApplyCandidate: (candidateId: string) => void;
  onDismiss: () => void;
}

export function ResumeRewritePanel(props: ResumeRewritePanelProps) {
  const previousStatusRef = useRef<ResumeRewriteState['status']>(props.rewrite.status);
  const [loadingFrame, setLoadingFrame] = useState(0);
  const [visibleCharacterCounts, setVisibleCharacterCounts] = useState<Record<string, number>>({});
  const request = props.rewrite.request;
  const originalText =
    request !== null ? request.target.original_text : null;

  /**
   * Animate the loading label so the panel feels alive immediately after the
   * request starts, without pretending the backend already returned any text.
   */
  useEffect(function () {
    if (props.rewrite.status !== 'loading') {
      return;
    }

    const timer = window.setInterval(function () {
      setLoadingFrame(function (currentFrame) {
        return (currentFrame + 1) % 3;
      });
    }, 280);

    return function () {
      window.clearInterval(timer);
    };
  }, [props.rewrite.status]);

  /**
   * Reveal candidate text progressively only after the backend response exists.
   *
   * Trust rule:
   * - loading state stays honest and text-free until candidates arrive
   * - once ready, PathOS reveals the returned candidate text locally so the
   *   suggestion feels collaborative instead of abruptly dumping in all at once
   */
  useEffect(function () {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = props.rewrite.status;

    if (props.rewrite.status !== 'ready') {
      return;
    }

    const shouldAnimate =
      previousStatus === 'loading' || previousStatus === 'unavailable' || previousStatus === 'error';

    if (!shouldAnimate) {
      return;
    }

    const startTimer = window.setTimeout(function () {
      const startingCounts: Record<string, number> = {};
      for (let index = 0; index < props.rewrite.candidates.length; index++) {
        startingCounts[props.rewrite.candidates[index].candidate_id] = 0;
      }
      setVisibleCharacterCounts(startingCounts);
    }, 0);
    const timer = window.setInterval(function () {
      let hasMoreToReveal = false;
      setVisibleCharacterCounts(function (currentCounts) {
        const nextCounts: Record<string, number> = {};
        for (let index = 0; index < props.rewrite.candidates.length; index++) {
          const candidate = props.rewrite.candidates[index];
          const currentCount =
            typeof currentCounts[candidate.candidate_id] === 'number'
              ? currentCounts[candidate.candidate_id]
              : 0;
          const nextCount = Math.min(candidate.text.length, currentCount + 18);
          nextCounts[candidate.candidate_id] = nextCount;
          if (nextCount < candidate.text.length) {
            hasMoreToReveal = true;
          }
        }
        return nextCounts;
      });
      if (!hasMoreToReveal) {
        window.clearInterval(timer);
      }
    }, 28);

    return function () {
      window.clearTimeout(startTimer);
      window.clearInterval(timer);
    };
  }, [props.rewrite.candidates, props.rewrite.status]);

  if (props.rewrite.status === 'idle' || props.rewrite.status === 'dismissed') {
    return null;
  }

  return (
    <section
      className="rounded-xl border p-5 transition-colors duration-150"
      style={{
        background: 'color-mix(in srgb, var(--p-surface2) 82%, black)',
        borderColor: 'color-mix(in srgb, var(--p-accent) 42%, var(--p-border))',
        boxShadow: 'inset 3px 0 0 var(--p-accent)',
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div
            className="mb-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{
              borderColor: 'color-mix(in srgb, var(--p-accent) 35%, var(--p-border))',
              color: 'var(--p-accent)',
              background: 'color-mix(in srgb, var(--p-accent) 10%, var(--p-surface))',
            }}
          >
            {props.rewrite.status === 'loading' ? (
              <span
                aria-hidden
                className="mr-2 inline-flex h-2 w-2 animate-pulse rounded-full"
                style={{ background: 'var(--p-accent)' }}
              />
            ) : null}
            Attached to {rewriteTargetLabel(request)}
          </div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
            AI rewrite assistance
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            Suggestions stay tied to backend diagnostics and require explicit approval before anything changes in the draft.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: stateTone(props.rewrite.status),
              color: stateTone(props.rewrite.status),
            }}
          >
            {stateLabel(props.rewrite.status)}
          </span>
          <button
            type="button"
            onClick={props.onDismiss}
            className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
            style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {request !== null ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              Grounding
            </div>
            <div className="mt-2 text-sm" style={{ color: 'var(--p-text)' }}>
              {request.grounding.issue_code !== null
                ? request.grounding.issue_code
                : request.grounding.recommendation_code !== null
                  ? request.grounding.recommendation_code
                  : 'Diagnostics-grounded rewrite'}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--p-text-muted)' }}>
              Section {request.target.section_id}
              {request.target.bullet_id !== null ? ' · ' + request.target.bullet_id : ''}
            </div>
            {request.grounding.target_role !== null ? (
              <div className="mt-1 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                Target role {request.grounding.target_role}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              Original text
            </div>
            <p
              className="mt-2 rounded-lg border px-3 py-3 text-sm"
              style={{
                borderColor: 'var(--p-border)',
                background: 'color-mix(in srgb, var(--p-surface2) 92%, black)',
                color: 'var(--p-text-muted)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {originalText !== null ? originalText : 'Original text unavailable.'}
            </p>
          </div>
        </div>
      ) : null}

      {props.rewrite.status === 'loading' ? (
        <div
          className="mt-4 rounded-xl border p-4 text-sm transition-colors duration-150"
          style={{
            borderColor: 'color-mix(in srgb, var(--p-warning) 40%, var(--p-border))',
            background: 'color-mix(in srgb, var(--p-warning) 8%, var(--p-surface))',
            color: 'var(--p-text)',
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--p-warning)' }}>
            <span
              aria-hidden
              className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full"
              style={{ background: 'var(--p-warning)' }}
            />
            {buildResumeRewriteLoadingLabel(loadingFrame)}
            <span aria-hidden className="ml-1 inline-block" style={{ color: 'var(--p-warning)' }}>
              |
            </span>
          </div>
          <div className="mt-2" style={{ color: 'var(--p-text-muted)' }}>
            Generating rewrite options from the backend assistance path. Your original text stays visible while PathOS waits for candidates.
          </div>
        </div>
      ) : null}

      {(props.rewrite.status === 'error' || props.rewrite.status === 'unavailable') && props.rewrite.errorMessage !== null ? (
        <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-danger)', background: 'color-mix(in srgb, var(--p-danger) 8%, var(--p-surface))', color: 'var(--p-text-muted)' }}>
          {props.rewrite.errorMessage}
        </div>
      ) : null}

      {(props.rewrite.status === 'ready' || props.rewrite.status === 'applied') && props.rewrite.candidates.length > 0 ? (
        <div className="mt-4 grid gap-4">
          {props.rewrite.candidates.map(function (candidate) {
            const visibleCharacterCount =
              props.rewrite.status === 'ready' &&
              typeof visibleCharacterCounts[candidate.candidate_id] === 'number'
                ? visibleCharacterCounts[candidate.candidate_id]
                : candidate.text.length;
            const visibleText = sliceResumeRewriteCandidateText(
              candidate.text,
              visibleCharacterCount
            );
            return (
              <ResumeRewriteCandidateCard
                key={candidate.candidate_id}
                candidate={candidate}
                isApplied={props.rewrite.appliedCandidateId === candidate.candidate_id}
                visibleText={visibleText}
                isRevealing={visibleCharacterCount < candidate.text.length}
                onApply={props.onApplyCandidate}
              />
            );
          })}
        </div>
      ) : null}

      {(props.rewrite.status === 'ready' || props.rewrite.status === 'applied') && props.rewrite.candidates.length === 0 ? (
        <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
          PathOS did not receive any bounded rewrite candidates for this target. Try re-running diagnostics or choose a different recommendation.
        </div>
      ) : null}
    </section>
  );
}
