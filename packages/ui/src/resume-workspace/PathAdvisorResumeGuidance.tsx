/**
 * ============================================================================
 * PATHADVISOR RESUME EXPLANATION COMPONENTS
 * ============================================================================
 *
 * PURPOSE:
 * Render backend-owned resume explanation objects in calm, section-aware UI
 * blocks. These components do not derive review logic on the client. They only
 * present explanation payloads that already came from the backend diagnostics
 * response.
 *
 * BOUNDARY RULE:
 * - No frontend scoring logic lives here.
 * - No chat behavior lives here.
 * - These components may focus existing target refs, but they never generate
 *   new target refs or new reasoning.
 */

'use client';

import type React from 'react';
import type {
  ResumeDiagnosticsExplanations,
  ResumeDiagnosticsRecommendation,
  ResumeKeyTakeawayExplanation,
  ResumeRecommendationExplanation,
  ResumeSectionExplanation,
  ResumeTargetRef,
  ResumeWarningExplanation,
} from './resumeDiagnostics';
import { findMatchingDiagnosticsRecommendationForExplanation } from './resumeRewrite';

function readNonEmptyText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function resolveTakeawayTitle(
  takeaway: ResumeKeyTakeawayExplanation,
  index: number
): string {
  const title = readNonEmptyText(takeaway.title);
  if (title !== null) {
    return title;
  }
  return 'Takeaway ' + (index + 1).toString();
}

function resolveRecommendationKey(
  recommendation: ResumeRecommendationExplanation,
  index: number
): string {
  const code = readNonEmptyText(recommendation.code);
  if (code !== null) {
    return code + '-' + index.toString();
  }
  const title = readNonEmptyText(recommendation.title);
  if (title !== null) {
    return title + '-' + index.toString();
  }
  return 'recommendation-' + index.toString();
}

function resolveWarningKey(
  warning: ResumeWarningExplanation,
  index: number
): string {
  const code = readNonEmptyText(warning.code);
  if (code !== null) {
    return code + '-' + index.toString();
  }
  const title = readNonEmptyText(warning.title);
  if (title !== null) {
    return title + '-' + index.toString();
  }
  return 'warning-' + index.toString();
}

export function hasResumeExplanations(
  explanations: ResumeDiagnosticsExplanations | null | undefined
): boolean {
  if (explanations === null || explanations === undefined) {
    return false;
  }
  const overallHeadline =
    explanations.overall_summary !== null &&
    explanations.overall_summary !== undefined
      ? readNonEmptyText(explanations.overall_summary.headline)
      : null;
  const overallDetail =
    explanations.overall_summary !== null &&
    explanations.overall_summary !== undefined
      ? readNonEmptyText(explanations.overall_summary.detail)
      : null;
  const keyTakeaways =
    Array.isArray(explanations.key_takeaways)
      ? explanations.key_takeaways.length
      : 0;
  const sections =
    Array.isArray(explanations.section_explanations)
      ? explanations.section_explanations.length
      : 0;
  const recommendations =
    Array.isArray(explanations.recommendation_explanations)
      ? explanations.recommendation_explanations.length
      : 0;
  const warnings =
    Array.isArray(explanations.warning_explanations)
      ? explanations.warning_explanations.length
      : 0;
  return (
    overallHeadline !== null ||
    overallDetail !== null ||
    keyTakeaways > 0 ||
    sections > 0 ||
    recommendations > 0 ||
    warnings > 0
  );
}

export function findSectionExplanation(
  explanations: ResumeDiagnosticsExplanations | null | undefined,
  sectionId: string
): ResumeSectionExplanation | null {
  if (
    explanations === null ||
    explanations === undefined ||
    !Array.isArray(explanations.section_explanations)
  ) {
    return null;
  }
  for (let i = 0; i < explanations.section_explanations.length; i++) {
    const item = explanations.section_explanations[i];
    if (item.section_id === sectionId) {
      return item;
    }
  }
  return null;
}

function TargetActionRow(props: {
  targetRefs: ResumeTargetRef[] | null | undefined;
  onFocusTargetRefs?: ((targetRefs: ResumeTargetRef[]) => void) | undefined;
}) {
  if (
    props.onFocusTargetRefs === undefined ||
    !Array.isArray(props.targetRefs) ||
    props.targetRefs.length === 0
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={function () {
        if (props.onFocusTargetRefs !== undefined && Array.isArray(props.targetRefs)) {
          props.onFocusTargetRefs(props.targetRefs);
        }
      }}
      className="mt-3 rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
      style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
    >
      Open related section
    </button>
  );
}

export function PathAdvisorSummary(props: {
  explanations: ResumeDiagnosticsExplanations | null | undefined;
  fallbackHeadline: string;
  fallbackDetail: string;
  statusLabel?: string | null;
}) {
  const overallSummary =
    props.explanations !== null && props.explanations !== undefined
      ? props.explanations.overall_summary
      : null;
  const headline =
    overallSummary !== null && overallSummary !== undefined
      ? readNonEmptyText(overallSummary.headline)
      : null;
  const detail =
    overallSummary !== null && overallSummary !== undefined
      ? readNonEmptyText(overallSummary.detail)
      : null;
  const topPriority =
    overallSummary !== null && overallSummary !== undefined
      ? readNonEmptyText(overallSummary.top_priority)
      : null;

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' }}>
      {props.statusLabel !== null && props.statusLabel !== undefined ? (
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          {props.statusLabel}
        </div>
      ) : null}
      <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
        {headline !== null ? headline : props.fallbackHeadline}
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
        {detail !== null ? detail : props.fallbackDetail}
      </p>
      {topPriority !== null ? (
        <div className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Top priority
          </div>
          <div className="mt-1" style={{ color: 'var(--p-text)' }}>
            {topPriority}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function KeyTakeawaysPanel(props: {
  explanations: ResumeDiagnosticsExplanations | null | undefined;
  onFocusTargetRefs?: ((targetRefs: ResumeTargetRef[]) => void) | undefined;
}) {
  const takeaways =
    props.explanations !== null &&
    props.explanations !== undefined &&
    Array.isArray(props.explanations.key_takeaways)
      ? props.explanations.key_takeaways
      : [];

  if (takeaways.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
        PathAdvisor key takeaways will appear here when the backend includes them.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {takeaways.slice(0, 5).map(function (takeaway, index) {
        const title = resolveTakeawayTitle(takeaway, index);
        const detail = readNonEmptyText(takeaway.detail);
        const hasTargets =
          Array.isArray(takeaway.target_refs) && takeaway.target_refs.length > 0;
        return (
          <div key={(takeaway.takeaway_id ? takeaway.takeaway_id : 'takeaway') + '-' + index.toString()} className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold" style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}>
                {(index + 1).toString()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                  {title}
                </div>
                {detail !== null ? (
                  <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                    {detail}
                  </p>
                ) : null}
                {hasTargets ? (
                  <TargetActionRow
                    targetRefs={takeaway.target_refs}
                    onFocusTargetRefs={props.onFocusTargetRefs}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SectionGuidance(props: {
  explanation: ResumeSectionExplanation | null;
  onFocusTargetRefs?: ((targetRefs: ResumeTargetRef[]) => void) | undefined;
  variant?: 'default' | 'builder';
  attachmentLabel?: string | null;
}) {
  if (props.explanation === null) {
    return null;
  }

  const title = readNonEmptyText(props.explanation.title);
  const whatIsWrong = readNonEmptyText(props.explanation.what_is_wrong);
  const whyItMatters = readNonEmptyText(props.explanation.why_it_matters);
  const whatToDo = readNonEmptyText(props.explanation.what_to_do);
  if (title === null && whatIsWrong === null && whyItMatters === null && whatToDo === null) {
    return null;
  }

  const isBuilderVariant = props.variant === 'builder';

  return (
    <details
      open
      className="mt-3 rounded-xl border"
      style={{
        borderColor: isBuilderVariant ? 'color-mix(in srgb, var(--p-accent) 55%, var(--p-border))' : 'var(--p-border)',
        background: isBuilderVariant
          ? 'color-mix(in srgb, var(--p-accent) 7%, var(--p-surface))'
          : 'color-mix(in srgb, var(--p-accent) 4%, white)',
        boxShadow: isBuilderVariant ? 'inset 3px 0 0 var(--p-accent)' : 'none',
      }}
    >
      <summary className="cursor-pointer list-none px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              {isBuilderVariant ? 'Attached guidance' : 'PathAdvisor guidance'}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
              {title !== null ? title : 'Section guidance'}
            </div>
            {isBuilderVariant && props.attachmentLabel !== null && props.attachmentLabel !== undefined ? (
              <div className="mt-1 text-xs" style={{ color: 'var(--p-text-muted)' }}>
                {props.attachmentLabel}
              </div>
            ) : null}
          </div>
          <div className="text-xs font-medium" style={{ color: 'var(--p-accent)' }}>
            Expand or collapse
          </div>
        </div>
      </summary>
      <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--p-border)' }}>
        {whatIsWrong !== null ? (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              What&apos;s wrong
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
              {whatIsWrong}
            </p>
          </div>
        ) : null}
        {whyItMatters !== null ? (
          <div className={whatIsWrong !== null ? 'mt-3' : ''}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              Why it matters
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
              {whyItMatters}
            </p>
          </div>
        ) : null}
        {whatToDo !== null ? (
          <div className={whatIsWrong !== null || whyItMatters !== null ? 'mt-3' : ''}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              What to do
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
              {whatToDo}
            </p>
          </div>
        ) : null}
        <TargetActionRow
          targetRefs={props.explanation.target_refs}
          onFocusTargetRefs={props.onFocusTargetRefs}
        />
      </div>
    </details>
  );
}

export function RecommendationCard(props: {
  recommendation: ResumeRecommendationExplanation;
  matchedRecommendation?: ResumeDiagnosticsRecommendation | null;
  canRequestRewrite?: boolean;
  rewriteDisabledReason?: string | null;
  onRequestRewrite?:
    | ((
        recommendation: ResumeDiagnosticsRecommendation,
        explanation: ResumeRecommendationExplanation
      ) => void)
    | undefined;
  rewriteButtonLabel?: string | null;
  onFocusTargetRefs?: ((targetRefs: ResumeTargetRef[]) => void) | undefined;
}) {
  const title = readNonEmptyText(props.recommendation.title);
  const explanation = readNonEmptyText(props.recommendation.short_explanation);
  const actionHint = readNonEmptyText(props.recommendation.action_hint);
  if (title === null && explanation === null && actionHint === null) {
    return null;
  }

  return (
    <details className="rounded-xl border" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
      <summary className="cursor-pointer list-none px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            {title !== null ? title : 'Recommendation'}
          </div>
          <div className="text-xs font-medium" style={{ color: 'var(--p-accent)' }}>
            Details
          </div>
        </div>
        {explanation !== null ? (
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            {explanation}
          </p>
        ) : null}
      </summary>
      {actionHint !== null || (Array.isArray(props.recommendation.target_refs) && props.recommendation.target_refs.length > 0) ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--p-border)' }}>
          {actionHint !== null ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Action hint
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                {actionHint}
              </p>
            </div>
          ) : null}
          <TargetActionRow
            targetRefs={props.recommendation.target_refs}
            onFocusTargetRefs={props.onFocusTargetRefs}
          />
          {props.matchedRecommendation !== null && props.matchedRecommendation !== undefined ? (
            <div className="mt-3">
              <button
                type="button"
                disabled={!props.canRequestRewrite}
                onClick={function () {
                  if (
                    props.canRequestRewrite &&
                    props.onRequestRewrite !== undefined &&
                    props.matchedRecommendation !== null &&
                    props.matchedRecommendation !== undefined
                  ) {
                    props.onRequestRewrite(
                      props.matchedRecommendation,
                      props.recommendation
                    );
                  }
                }}
                className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
              >
                {props.rewriteButtonLabel !== null && props.rewriteButtonLabel !== undefined
                  ? props.rewriteButtonLabel
                  : 'Rewrite with AI'}
              </button>
              {!props.canRequestRewrite && props.rewriteDisabledReason !== null ? (
                <p className="mt-2 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                  {props.rewriteDisabledReason}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

export function WarningExplanationList(props: {
  explanations: ResumeDiagnosticsExplanations | null | undefined;
}) {
  const warnings =
    props.explanations !== null &&
    props.explanations !== undefined &&
    Array.isArray(props.explanations.warning_explanations)
      ? props.explanations.warning_explanations
      : [];

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings.map(function (warning, index) {
        const title = readNonEmptyText(warning.title);
        const detail = readNonEmptyText(warning.detail);
        if (title === null && detail === null) {
          return null;
        }
        return (
          <div key={resolveWarningKey(warning, index)} className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
            {title !== null ? (
              <div className="font-semibold" style={{ color: 'var(--p-text)' }}>
                {title}
              </div>
            ) : null}
            {detail !== null ? (
              <div className={title !== null ? 'mt-1' : ''} style={{ color: 'var(--p-text-muted)' }}>
                {detail}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RecommendationList(props: {
  explanations: ResumeDiagnosticsExplanations | null | undefined;
  diagnosticsRecommendations?: ResumeDiagnosticsRecommendation[] | null | undefined;
  canRequestRewrite?: boolean;
  rewriteDisabledReason?: string | null;
  onRequestRewrite?:
    | ((
        recommendation: ResumeDiagnosticsRecommendation,
        explanation: ResumeRecommendationExplanation
      ) => void)
    | undefined;
  rewriteButtonLabel?: string | null;
  onFocusTargetRefs?: ((targetRefs: ResumeTargetRef[]) => void) | undefined;
  emptyMessage: string;
}) {
  const recommendations =
    props.explanations !== null &&
    props.explanations !== undefined &&
    Array.isArray(props.explanations.recommendation_explanations)
      ? props.explanations.recommendation_explanations
      : [];

  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
        {props.emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map(function (recommendation, index) {
        const matchedRecommendation =
          findMatchingDiagnosticsRecommendationForExplanation(
            props.diagnosticsRecommendations !== undefined
              ? props.diagnosticsRecommendations
              : null,
            recommendation
          );
        return (
          <RecommendationCard
            key={resolveRecommendationKey(recommendation, index)}
            recommendation={recommendation}
            matchedRecommendation={matchedRecommendation}
            canRequestRewrite={props.canRequestRewrite}
            rewriteDisabledReason={props.rewriteDisabledReason !== undefined ? props.rewriteDisabledReason : null}
            onRequestRewrite={props.onRequestRewrite}
            rewriteButtonLabel={props.rewriteButtonLabel !== undefined ? props.rewriteButtonLabel : null}
            onFocusTargetRefs={props.onFocusTargetRefs}
          />
        );
      })}
    </div>
  );
}
