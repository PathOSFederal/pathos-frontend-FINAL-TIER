'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  completeOnboardingSession,
  createOnboardingSession,
  getOnboardingSession,
  OnboardingClientError,
  recordOnboardingAction,
  submitOnboardingAnswer,
} from '@/lib/onboarding/client';
import { ONBOARDING_SESSION_ID_STORAGE_KEY } from '@/lib/storage-keys';
import type {
  CompleteOnboardingResponse,
  EnrichmentRecommendation,
  OnboardingActionEvent,
  OnboardingFirstInsight,
  OnboardingProfileEvolution,
  OnboardingProfileFreshness,
  OnboardingProfileCompleteness,
  OnboardingQuestion,
  OnboardingQuestionState,
  OnboardingSessionState,
  OnboardingThread,
  PrioritizedQuestionCandidate,
  ReengagementSignal,
  RefinementRecommendation,
  WorkspaceHandoff,
} from '@/types/onboarding';

/**
 * The backend owns question wording, answer labels, and editability. The
 * frontend turns that canonical history into compact dashboard checklist rows
 * without inferring any new decision state from the answers.
 */
export function buildAnswerSummaryItems(session: OnboardingSessionState): string[] {
  const items: string[] = [];
  for (let i = 0; i < session.question_history.length; i++) {
    const entry = session.question_history[i];
    if (entry.skipped) {
      items.push(entry.question.prompt + ': answer later');
      continue;
    }
    items.push(entry.question.prompt + ': ' + entry.answer_label);
  }
  return items;
}

/**
 * The dashboard needs one deterministic rule for whether a client error means
 * local session state is stale. Missing-session errors are recoverable because
 * the frontend can discard the local session id and start a fresh backend
 * session. Other failures must remain visible and honest.
 */
export function isRecoverableSessionError(error: unknown): boolean {
  if (!(error instanceof OnboardingClientError)) {
    return false;
  }
  if (error.status === 404) {
    return true;
  }
  return error.code === 'NOT_FOUND';
}

/**
 * Backend validation errors can happen if the browser tries to submit against
 * stale question state after a slow network round trip. In that case the safe
 * recovery is to reload the authoritative session instead of inventing client
 * conflict resolution.
 */
export function shouldReloadAuthoritativeSession(error: unknown): boolean {
  if (!(error instanceof OnboardingClientError)) {
    return false;
  }
  if (error.status === 400) {
    return true;
  }
  return error.code === 'BAD_REQUEST';
}

function persistSessionId(sessionId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(ONBOARDING_SESSION_ID_STORAGE_KEY, sessionId);
}

function clearSessionId(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(ONBOARDING_SESSION_ID_STORAGE_KEY);
}

function findQuestionForEdit(
  session: OnboardingSessionState,
  editingQuestionId: string | null
): OnboardingQuestion | null {
  if (editingQuestionId === null) {
    return session.next_question;
  }
  for (let i = 0; i < session.question_history.length; i++) {
    const entry = session.question_history[i];
    if (entry.question.question_id === editingQuestionId) {
      return entry.question;
    }
  }
  return session.next_question;
}

function renderAnswerLabel(entry: OnboardingQuestionState): string {
  if (entry.skipped) {
    return 'Answer later';
  }
  return entry.answer_label;
}

function renderPriorityTone(priority: 'high' | 'medium' | 'low'): string {
  if (priority === 'high') {
    return 'High value';
  }
  if (priority === 'medium') {
    return 'Useful next';
  }
  return 'Optional later';
}

function formatTimestampLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderFreshnessTone(freshness: OnboardingProfileFreshness | null): string {
  if (freshness === null) {
    return 'Freshness unavailable';
  }
  if (freshness.freshness_band === 'stale') {
    return 'Needs review';
  }
  if (freshness.freshness_band === 'aging') {
    return 'Worth refreshing';
  }
  return 'Fresh enough';
}

export function PathAdvisorOnboardingView(props: {
  session: OnboardingSessionState;
  activeQuestion: OnboardingQuestion | null;
  editingQuestionId: string | null;
  isSubmitting: boolean;
  isCompleting: boolean;
  isRecordingAction: boolean;
  errorMessage: string | null;
  onSelect: (question: OnboardingQuestion, answer: string) => void;
  onSkip: (question: OnboardingQuestion) => void;
  onEditQuestion: (questionId: string) => void;
  onRecordAction: (
    actionType:
      | 'opened_job_search'
      | 'opened_resume_builder'
      | 'viewed_roles_no_apply'
      | 'edited_resume'
      | 'skipped_applying',
    workspace: 'job_search' | 'resume_builder' | 'dashboard'
  ) => void;
  onRetryLoad: () => void;
  onRestartSession: () => void;
  onEnterDashboard: () => void;
  onAnswerLater: () => void;
}) {
  const session = props.session;
  const question = props.activeQuestion;
  const answerSummaryItems = useMemo(function () {
    return buildAnswerSummaryItems(session);
  }, [session]);

  return (
    <div className="w-full px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_320px]">
          <div className="space-y-6">
            <Card className="border-[var(--p-border)] bg-[var(--p-surface)] shadow-sm">
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--p-border)] bg-[var(--p-surface2)] px-3 py-1 text-xs font-medium text-[var(--p-text-muted)]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Trust-first onboarding mode
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--p-text)]">
                      {session.current_stage === 'refinement'
                        ? 'Continue improving your PathAdvisor profile'
                        : 'Build your first PathAdvisor context'}
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-[var(--p-text-muted)]">
                      {session.current_stage === 'refinement'
                        ? 'PathAdvisor keeps profile continuity through structured topic threads, recent activity signals, and bounded refinement prompts.'
                        : 'Answer a few structured questions and PathAdvisor will return a bounded first insight. You can skip some items now and edit them later from the backend-owned intake checklist.'}
                    </p>
                  </div>
                  <Sparkles className="mt-1 hidden h-6 w-6 text-[var(--p-accent)] sm:block" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                      {session.current_stage === 'refinement' ? 'Refinement mode' : 'Progress'}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--p-text)]">
                      {session.current_stage === 'refinement'
                        ? renderFreshnessTone(session.profile_freshness)
                        : session.progress_summary.completed_steps +
                          '/' +
                          session.progress_summary.total_steps}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                      Core facts
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--p-text)]">
                      {session.progress_summary.answered_core_facts}/3
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                      First insight threshold
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--p-text)]">
                      {session.progress_summary.answered_branch_facts}/
                      {session.progress_summary.branch_facts_required_for_insight}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                      Completeness
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--p-text)]">
                      {session.profile_completeness_detail != null
                        ? session.profile_completeness_detail.overall_score
                        : session.progress_summary.profile_completeness}
                      %
                    </div>
                    {session.profile_completeness_detail != null ? (
                      <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                        {session.profile_completeness_detail.overall_band} profile state
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                      Last updated
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--p-text)]">
                      {session.profile_freshness !== null
                        ? formatTimestampLabel(session.profile_freshness.last_updated)
                        : formatTimestampLabel(session.updated_at)}
                    </div>
                    {session.profile_freshness !== null ? (
                      <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                        {session.profile_freshness.update_prompt}
                      </div>
                    ) : null}
                  </div>
                </div>

                {props.errorMessage !== null ? (
                  <div className="space-y-3 rounded-xl border border-[var(--p-danger)]/30 bg-[color-mix(in_srgb,var(--p-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--p-text)]">
                    <div>{props.errorMessage}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={props.onRetryLoad}>
                        Retry sync
                      </Button>
                      <Button type="button" variant="outline" onClick={props.onRestartSession}>
                        Start fresh session
                      </Button>
                    </div>
                  </div>
                ) : null}

                {session.first_insight !== null ? (
                  <FirstInsightCard insight={session.first_insight} />
                ) : null}

                {session.reengagement_signals.length > 0 ? (
                  <ReengagementSignalsCard signals={session.reengagement_signals} />
                ) : null}

                {session.signal_derived_insights.length > 0 || session.recent_signals.length > 0 ? (
                  <SignalUpdatesCard
                    insights={session.signal_derived_insights}
                    recentSignals={session.recent_signals}
                  />
                ) : null}

                {session.profile_completeness_detail != null ? (
                  <ProfileCompletenessCard completeness={session.profile_completeness_detail} />
                ) : null}

                {session.threads.length > 0 ? <ThreadMemoryCard threads={session.threads} /> : null}

                {session.profile_evolution !== null && session.profile_evolution.changes.length > 0 ? (
                  <ProfileEvolutionCard evolution={session.profile_evolution} />
                ) : null}

                {session.prioritized_next_question != null ? (
                  <PrioritizationCard
                    candidate={session.prioritized_next_question}
                    alternatives={session.additional_question_candidates || []}
                  />
                ) : null}

                {question !== null ? (
                  <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                        {props.editingQuestionId === null
                          ? 'PathAdvisor asks next'
                          : 'Review or update earlier answer'}
                      </div>
                      <h2 className="text-xl font-semibold text-[var(--p-text)]">{question.prompt}</h2>
                      {question.helper_text !== '' ? (
                        <p className="text-sm text-[var(--p-text-muted)]">{question.helper_text}</p>
                      ) : null}
                      {question.why_it_matters !== '' ? (
                        <p className="text-xs text-[var(--p-text-dim)]">
                          Why this matters: {question.why_it_matters}
                        </p>
                      ) : null}
                      {props.editingQuestionId === null && session.prioritized_next_question != null ? (
                        <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text-muted)]">
                          <div className="font-medium text-[var(--p-text)]">
                            {renderPriorityTone(session.prioritized_next_question.priority_band)}
                          </div>
                          <div className="mt-1">
                            {session.prioritized_next_question.prioritization_reason}
                          </div>
                          <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                            Unlocks: {session.prioritized_next_question.expected_unlock}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3">
                      {question.options.map(function (option) {
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={function () {
                              props.onSelect(question, option.value);
                            }}
                            className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--p-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={props.isSubmitting}
                          >
                            <div className="font-medium text-[var(--p-text)]">{option.label}</div>
                            {option.description !== '' ? (
                              <div className="mt-1 text-sm text-[var(--p-text-muted)]">
                                {option.description}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {question.allow_skip ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={function () {
                            props.onSkip(question);
                          }}
                          disabled={props.isSubmitting}
                        >
                          Skip for now
                        </Button>
                      ) : null}
                      <div className="text-xs text-[var(--p-text-dim)]">
                        Answers improve recommendation quality. Storage and reset options follow current
                        product behavior.
                      </div>
                    </div>
                  </div>
                ) : null}

                {session.first_insight !== null &&
                Array.isArray(session.enrichment_recommendations) &&
                session.enrichment_recommendations.length > 0 ? (
                  <EnrichmentRecommendationsCard recommendations={session.enrichment_recommendations} />
                ) : null}

                {session.refinement_recommendations.length > 0 ? (
                  <RefinementRecommendationsCard recommendations={session.refinement_recommendations} />
                ) : null}

                <ActionLoopCard
                  recentActions={session.recent_actions}
                  isRecordingAction={props.isRecordingAction}
                  onRecordAction={props.onRecordAction}
                />

                {(session.job_search_handoff != null || session.resume_builder_handoff != null) ? (
                  <HandoffCards
                    recommendedNextWorkspace={session.recommended_next_workspace}
                    handoffReason={session.handoff_reason}
                    jobSearchHandoff={session.job_search_handoff}
                    resumeBuilderHandoff={session.resume_builder_handoff}
                  />
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={props.onEnterDashboard}
                    disabled={props.isCompleting || session.first_insight === null}
                  >
                    Enter dashboard
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={props.onAnswerLater}
                    disabled={props.isCompleting}
                  >
                    Answer later
                  </Button>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <LockedPreviewCard
                title="Readiness surface"
                description="Your first recommendation and blockers will settle here after this bounded intake."
              />
              <LockedPreviewCard
                title="PathAdvisor context"
                description="Known facts, missing facts, and the next governed follow-up stay visible after handoff."
              />
            </div>
          </div>

          <div className="space-y-4">
            <Card className="border-[var(--p-border)] bg-[var(--p-surface)]">
              <div className="space-y-4 p-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                    Intake checklist
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--p-text)]">
                    {session.progress_summary.profile_completeness}% complete
                  </div>
                </div>
                <div className="space-y-2">
                  {session.question_history.length > 0 ? (
                    session.question_history.map(function (entry) {
                      return (
                        <div
                          key={entry.question.question_id}
                          className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-3 text-sm text-[var(--p-text-muted)]"
                        >
                          <div className="font-medium text-[var(--p-text)]">{entry.question.prompt}</div>
                          <div className="mt-1">{renderAnswerLabel(entry)}</div>
                          {entry.editable ? (
                            <div className="mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={function () {
                                  props.onEditQuestion(entry.question.question_id);
                                }}
                                disabled={
                                  props.isSubmitting || props.isCompleting || props.isRecordingAction
                                }
                              >
                                Edit answer
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : answerSummaryItems.length > 0 ? (
                    answerSummaryItems.map(function (item) {
                      return (
                        <div
                          key={item}
                          className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text-muted)]"
                        >
                          {item}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-[var(--p-border)] px-3 py-4 text-sm text-[var(--p-text-dim)]">
                      PathAdvisor will build context here as you answer.
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="border-[var(--p-border)] bg-[var(--p-surface)]">
              <div className="space-y-3 p-5">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                  Bootstrap snapshot
                </div>
                <div className="text-sm text-[var(--p-text-muted)]">
                  {session.context_bootstrap.active_recommendation_summary !== ''
                    ? session.context_bootstrap.active_recommendation_summary
                    : 'No recommendation yet. PathAdvisor is still collecting the highest-signal facts.'}
                </div>
                {session.context_bootstrap.handoff_reason !== '' ? (
                  <div className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text-muted)]">
                    {session.context_bootstrap.handoff_reason}
                  </div>
                ) : null}
                {session.context_bootstrap.next_question_candidates.length > 0 ? (
                  <div className="space-y-2">
                    {session.context_bootstrap.next_question_candidates.map(function (item) {
                      return (
                        <div
                          key={item}
                          className="rounded-lg bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text)]"
                        >
                          {item}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LockedPreviewCard(props: { title: string; description: string }) {
  return (
    <Card className="border-[var(--p-border)] bg-[color-mix(in_srgb,var(--p-surface)_85%,transparent)] opacity-80">
      <div className="flex items-start gap-3 p-5">
        <div className="rounded-full bg-[var(--p-surface2)] p-2 text-[var(--p-text-dim)]">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <div className="font-medium text-[var(--p-text)]">{props.title}</div>
          <div className="mt-1 text-sm text-[var(--p-text-muted)]">{props.description}</div>
        </div>
      </div>
    </Card>
  );
}

function ProfileCompletenessCard(props: { completeness: OnboardingProfileCompleteness }) {
  const completeness = props.completeness;
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
            Profile completeness
          </div>
          <div className="mt-1 text-xl font-semibold text-[var(--p-text)]">
            {completeness.overall_score}% complete
          </div>
        </div>
        <div className="rounded-full border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-1 text-xs text-[var(--p-text-muted)]">
          {completeness.overall_band}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {completeness.section_breakdown.map(function (section) {
          return (
            <div
              key={section.section_id}
              className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[var(--p-text)]">{section.label}</div>
                <div className="text-sm text-[var(--p-text-muted)]">{section.completeness}%</div>
              </div>
              <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                {section.answered_fields}/{section.total_fields} facts answered
              </div>
            </div>
          );
        })}
      </div>

      {completeness.top_missing_fields.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
            Most valuable next details
          </div>
          <div className="mt-2 space-y-2">
            {completeness.top_missing_fields.map(function (field) {
              return (
                <div
                  key={field.field_id}
                  className="rounded-lg border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text-muted)]"
                >
                  <div className="font-medium text-[var(--p-text)]">{field.label}</div>
                  <div className="mt-1">{field.reason}</div>
                  <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                    Unlocks: {field.expected_unlock}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PrioritizationCard(props: {
  candidate: PrioritizedQuestionCandidate;
  alternatives: PrioritizedQuestionCandidate[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        PathAdvisor prioritization
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Next best question: {props.candidate.question.prompt}
      </div>
      <div className="mt-2 text-sm text-[var(--p-text-muted)]">
        {props.candidate.prioritization_reason}
      </div>
      <div className="mt-2 text-xs text-[var(--p-text-dim)]">
        Unlocks: {props.candidate.expected_unlock}
      </div>

      {props.alternatives.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
            Also useful next
          </div>
          {props.alternatives.map(function (candidate) {
            return (
              <div
                key={candidate.question.question_id}
                className="rounded-lg border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text-muted)]"
              >
                <div className="font-medium text-[var(--p-text)]">{candidate.question.prompt}</div>
                <div className="mt-1">{candidate.prioritization_reason}</div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ReengagementSignalsCard(props: { signals: ReengagementSignal[] }) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        PathAdvisor prompts
      </div>
      <div className="mt-3 space-y-3">
        {props.signals.map(function (signal) {
          return (
            <div
              key={signal.trigger_type + signal.message}
              className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[var(--p-text)]">{signal.message}</div>
                <div className="rounded-full border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-1 text-xs text-[var(--p-text-muted)]">
                  {renderPriorityTone(signal.priority)}
                </div>
              </div>
              <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                Suggested next step: {signal.recommended_next_step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThreadMemoryCard(props: { threads: OnboardingThread[] }) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        Topic threads
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Revisit one topic at a time instead of restarting onboarding
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {props.threads.map(function (thread) {
          return (
            <div
              key={thread.id}
              className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[var(--p-text)]">{thread.title}</div>
                <div className="text-sm text-[var(--p-text-muted)]">{thread.completeness}%</div>
              </div>
              <div className="mt-1 text-sm text-[var(--p-text-muted)]">{thread.why_it_matters}</div>
              <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                Confidence: {thread.confidence}. Last updated {formatTimestampLabel(thread.last_updated)}.
              </div>
              {thread.signal_influence_summary !== '' ? (
                <div className="mt-2 rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-xs text-[var(--p-text-muted)]">
                  Recent signal update: {thread.signal_influence_summary}
                  {thread.last_signal_at !== null
                    ? ' Updated ' + formatTimestampLabel(thread.last_signal_at) + '.'
                    : ''}
                </div>
              ) : null}
              {thread.facts.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {thread.facts.map(function (fact) {
                    return (
                      <div
                        key={fact}
                        className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text)]"
                      >
                        {fact}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignalUpdatesCard(props: { insights: string[]; recentSignals: OnboardingSessionState['recent_signals'] }) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        Real product signals
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Recent Job Search and resume activity is refining this guidance
      </div>
      <div className="mt-2 text-sm text-[var(--p-text-muted)]">
        PathAdvisor only uses bounded activity signals that are already explicit in the product.
      </div>

      {props.insights.length > 0 ? (
        <div className="mt-4 space-y-2">
          {props.insights.map(function (insight) {
            return (
              <div
                key={insight}
                className="rounded-lg border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text)]"
              >
                {insight}
              </div>
            );
          })}
        </div>
      ) : null}

      {props.recentSignals.length > 0 ? (
        <div className="mt-4 space-y-2">
          {props.recentSignals.slice(0, 3).map(function (signal) {
            return (
              <div
                key={signal.signal_type + signal.occurred_at}
                className="rounded-lg border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text-muted)]"
              >
                <div className="font-medium text-[var(--p-text)]">{signal.summary}</div>
                <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                  {signal.source.replace('_', ' ')} · {formatTimestampLabel(signal.occurred_at)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ProfileEvolutionCard(props: { evolution: OnboardingProfileEvolution }) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        Profile evolution
      </div>
      <div className="mt-3 space-y-3">
        {props.evolution.changes.map(function (change) {
          return (
            <div
              key={change.field_id + change.changed_at}
              className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-4"
            >
              <div className="font-medium text-[var(--p-text)]">{change.label}</div>
              <div className="mt-1 text-sm text-[var(--p-text-muted)]">
                {change.previous_value !== ''
                  ? 'Updated from ' + change.previous_value + ' to ' + change.current_value + '.'
                  : 'Added ' + change.current_value + '.'}
              </div>
              <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                {change.impact} Updated {formatTimestampLabel(change.changed_at)}.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FirstInsightCard(props: { insight: OnboardingFirstInsight }) {
  const insight = props.insight;
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[color-mix(in_srgb,var(--p-accent)_8%,var(--p-surface))] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
            First insight
          </div>
          <div className="mt-1 text-xl font-semibold text-[var(--p-text)]">
            Confidence: {insight.confidence_band}
          </div>
        </div>
        <div className="rounded-full border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-1 text-xs font-medium text-[var(--p-text-muted)]">
          {insight.engine_version}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--p-text-muted)]">{insight.explanation}</p>

      <InsightList title="Likely fit areas" items={insight.likely_fit_areas} />
      <InsightList title="Likely blockers" items={insight.likely_blockers} />
      <InsightList title="Next actions" items={insight.next_actions} />
      <InsightList title="Missing information" items={insight.missing_information} />
    </div>
  );
}

function EnrichmentRecommendationsCard(props: { recommendations: EnrichmentRecommendation[] }) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        Guided enrichment
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Improve recommendation quality without turning this into a long form
      </div>
      <div className="mt-2 text-sm text-[var(--p-text-muted)]">
        PathAdvisor is prioritizing the smallest next details that would improve confidence or unlock a better handoff.
      </div>

      <div className="mt-4 space-y-3">
        {props.recommendations.map(function (recommendation) {
          return (
            <div
              key={recommendation.question.question_id}
              className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[var(--p-text)]">{recommendation.question.prompt}</div>
                <div className="rounded-full border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-1 text-xs text-[var(--p-text-muted)]">
                  {renderPriorityTone(recommendation.recommendation_priority)}
                </div>
              </div>
              <div className="mt-2 text-sm text-[var(--p-text-muted)]">
                {recommendation.recommendation_reason}
              </div>
              <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                Benefit: {recommendation.expected_benefit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefinementRecommendationsCard(props: { recommendations: RefinementRecommendation[] }) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        Refinement loop
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Continue improving the profile where the next answer matters most
      </div>
      <div className="mt-4 space-y-3">
        {props.recommendations.map(function (recommendation) {
          return (
            <div
              key={recommendation.question.question_id}
              className="rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[var(--p-text)]">{recommendation.question.prompt}</div>
                <div className="rounded-full border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-1 text-xs text-[var(--p-text-muted)]">
                  {renderPriorityTone(recommendation.recommendation_priority)}
                </div>
              </div>
              <div className="mt-2 text-sm text-[var(--p-text-muted)]">{recommendation.reason}</div>
              <div className="mt-2 text-xs text-[var(--p-text-dim)]">
                Impact: {recommendation.expected_impact}
              </div>
              <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                Related thread: {recommendation.related_thread.replace('_', ' ')}
              </div>
              {recommendation.derived_from_signals ? (
                <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                  Derived from recent {recommendation.related_workspace.replace('_', ' ')} signals.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionLoopCard(props: {
  recentActions: OnboardingActionEvent[];
  isRecordingAction: boolean;
  onRecordAction: (
    actionType:
      | 'opened_job_search'
      | 'opened_resume_builder'
      | 'viewed_roles_no_apply'
      | 'edited_resume'
      | 'skipped_applying',
    workspace: 'job_search' | 'resume_builder' | 'dashboard'
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        Action loop
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Onboarding, action, feedback, refinement
      </div>
      <div className="mt-2 text-sm text-[var(--p-text-muted)]">
        These bounded activity signals help PathAdvisor decide what missing detail would improve your next move.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={props.isRecordingAction}
          onClick={function () {
            props.onRecordAction('opened_job_search', 'job_search');
          }}
        >
          I opened Job Search
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={props.isRecordingAction}
          onClick={function () {
            props.onRecordAction('opened_resume_builder', 'resume_builder');
          }}
        >
          I opened Resume Builder
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={props.isRecordingAction}
          onClick={function () {
            props.onRecordAction('viewed_roles_no_apply', 'job_search');
          }}
        >
          I viewed roles but did not apply
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={props.isRecordingAction}
          onClick={function () {
            props.onRecordAction('edited_resume', 'resume_builder');
          }}
        >
          I edited my resume
        </Button>
      </div>

      {props.recentActions.length > 0 ? (
        <div className="mt-4 space-y-2">
          {props.recentActions.map(function (action) {
            return (
              <div
                key={action.action_type + action.occurred_at}
                className="rounded-lg border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text-muted)]"
              >
                <div className="font-medium text-[var(--p-text)]">{action.summary}</div>
                <div className="mt-1 text-xs text-[var(--p-text-dim)]">
                  {formatTimestampLabel(action.occurred_at)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function HandoffCards(props: {
  recommendedNextWorkspace: 'job_search' | 'resume_builder' | 'dashboard' | null;
  handoffReason: string;
  jobSearchHandoff: WorkspaceHandoff | null;
  resumeBuilderHandoff: WorkspaceHandoff | null;
}) {
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
        PathAdvisor handoff
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--p-text)]">
        Choose the next workspace with your onboarding context attached
      </div>
      {props.handoffReason !== '' ? (
        <div className="mt-2 text-sm text-[var(--p-text-muted)]">{props.handoffReason}</div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {props.jobSearchHandoff !== null ? (
          <WorkspaceHandoffCard
            handoff={props.jobSearchHandoff}
            highlighted={props.recommendedNextWorkspace === 'job_search'}
          />
        ) : null}
        {props.resumeBuilderHandoff !== null ? (
          <WorkspaceHandoffCard
            handoff={props.resumeBuilderHandoff}
            highlighted={props.recommendedNextWorkspace === 'resume_builder'}
          />
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceHandoffCard(props: { handoff: WorkspaceHandoff; highlighted: boolean }) {
  const handoff = props.handoff;
  return (
    <div
      className={
        'rounded-xl border px-4 py-4 ' +
        (props.highlighted
          ? 'border-[var(--p-accent)] bg-[color-mix(in_srgb,var(--p-accent)_8%,var(--p-surface))]'
          : 'border-[var(--p-border)] bg-[var(--p-surface)]')
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-[var(--p-text)]">{handoff.title}</div>
        {props.highlighted ? (
          <div className="rounded-full border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-1 text-xs text-[var(--p-text-muted)]">
            Recommended
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-sm text-[var(--p-text-muted)]">{handoff.description}</div>

      {handoff.context_items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {handoff.context_items.map(function (item) {
            return (
              <div
                key={item}
                className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text)]"
              >
                {item}
              </div>
            );
          })}
        </div>
      ) : null}

      {handoff.warnings.length > 0 ? (
        <div className="mt-3 space-y-2">
          {handoff.warnings.map(function (warning) {
            return (
              <div
                key={warning}
                className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text-muted)]"
              >
                {warning}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4">
        <a
          href={handoff.cta_href}
          className="inline-flex items-center rounded-md bg-[var(--p-accent)] px-4 py-2 text-sm font-medium text-white"
        >
          {handoff.cta_label}
        </a>
      </div>
    </div>
  );
}

function InsightList(props: { title: string; items: string[] }) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">{props.title}</div>
      <div className="mt-2 space-y-2">
        {props.items.map(function (item) {
          return (
            <div
              key={item}
              className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-2 text-sm text-[var(--p-text)]"
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PathAdvisorOnboardingExperience(props: {
  initialSessionId: string | null;
  onFinished: (result: CompleteOnboardingResponse) => void;
}) {
  const [session, setSession] = useState<OnboardingSessionState | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRecordingAction, setIsRecordingAction] = useState(false);

  /**
   * React state updates are asynchronous. These refs provide immediate guards so
   * double clicks and slow-network retries cannot race a second submission
   * through before the disabled button state is visible.
   */
  const loadGenerationRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const completeInFlightRef = useRef(false);
  const actionInFlightRef = useRef(false);

  const loadAuthoritativeSession = useCallback(async function (
    preferredSessionId: string | null,
    allowMissingSessionRecovery: boolean
  ): Promise<void> {
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;
    setErrorMessage(null);

    try {
      let sessionId = preferredSessionId;
      if (sessionId === null || sessionId.trim() === '') {
        const created = await createOnboardingSession();
        sessionId = created.session_id;
        persistSessionId(sessionId);
      }

      const loaded = await getOnboardingSession(sessionId);
      if (loadGenerationRef.current !== loadGeneration) {
        return;
      }

      persistSessionId(loaded.session_id);
      setEditingQuestionId(null);
      setSession(loaded);
    } catch (error) {
      if (loadGenerationRef.current !== loadGeneration) {
        return;
      }

      if (allowMissingSessionRecovery && isRecoverableSessionError(error)) {
        clearSessionId();
        setSession(null);
        await loadAuthoritativeSession(null, false);
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Failed to load onboarding.');
    }
  }, []);

  useEffect(
    function () {
      void loadAuthoritativeSession(props.initialSessionId, true);
    },
    [loadAuthoritativeSession, props.initialSessionId]
  );

  async function submitQuestion(
    question: OnboardingQuestion,
    answer: string | null,
    skip: boolean
  ): Promise<void> {
    if (session === null || submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitOnboardingAnswer(
        session.session_id,
        question.question_id,
        answer,
        skip
      );
      persistSessionId(response.session.session_id);
      setSession(response.session);
      setEditingQuestionId(null);
    } catch (error) {
      if (isRecoverableSessionError(error)) {
        clearSessionId();
        setSession(null);
        setEditingQuestionId(null);
        setErrorMessage('Your previous onboarding session was no longer available. PathAdvisor started a fresh session.');
        await loadAuthoritativeSession(null, false);
      } else if (shouldReloadAuthoritativeSession(error)) {
        setErrorMessage('PathAdvisor reloaded the latest onboarding state before applying a new answer.');
        await loadAuthoritativeSession(session.session_id, false);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save onboarding answer.');
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function finish(action: 'complete' | 'defer'): Promise<void> {
    if (session === null || completeInFlightRef.current) {
      return;
    }

    completeInFlightRef.current = true;
    setIsCompleting(true);
    setErrorMessage(null);
    try {
      const response = await completeOnboardingSession(session.session_id, action);
      persistSessionId(response.session.session_id);
      props.onFinished(response);
    } catch (error) {
      if (isRecoverableSessionError(error)) {
        clearSessionId();
        setSession(null);
        setEditingQuestionId(null);
        setErrorMessage('The saved onboarding session could not be completed because it was no longer available.');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to finish onboarding.');
      }
    } finally {
      completeInFlightRef.current = false;
      setIsCompleting(false);
    }
  }

  async function recordAction(
    actionType:
      | 'opened_job_search'
      | 'opened_resume_builder'
      | 'viewed_roles_no_apply'
      | 'edited_resume'
      | 'skipped_applying',
    workspace: 'job_search' | 'resume_builder' | 'dashboard'
  ): Promise<void> {
    if (session === null || actionInFlightRef.current) {
      return;
    }

    actionInFlightRef.current = true;
    setIsRecordingAction(true);
    setErrorMessage(null);
    try {
      const response = await recordOnboardingAction(session.session_id, actionType, workspace);
      persistSessionId(response.session.session_id);
      setSession(response.session);
    } catch (error) {
      if (isRecoverableSessionError(error)) {
        clearSessionId();
        setSession(null);
        setEditingQuestionId(null);
        setErrorMessage('The saved onboarding session was no longer available for action feedback.');
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to record onboarding action feedback.'
        );
      }
    } finally {
      actionInFlightRef.current = false;
      setIsRecordingAction(false);
    }
  }

  if (session === null) {
    return (
      <div className="w-full px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6 text-sm text-[var(--p-text-muted)]">
          <div>PathAdvisor is restoring your onboarding context.</div>
          {errorMessage !== null ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={function () {
                  void loadAuthoritativeSession(props.initialSessionId, true);
                }}
              >
                Retry sync
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={function () {
                  clearSessionId();
                  void loadAuthoritativeSession(null, false);
                }}
              >
                Start fresh session
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <PathAdvisorOnboardingView
      session={session}
      activeQuestion={findQuestionForEdit(session, editingQuestionId)}
      editingQuestionId={editingQuestionId}
      isSubmitting={isSubmitting}
      isCompleting={isCompleting}
      isRecordingAction={isRecordingAction}
      errorMessage={errorMessage}
      onSelect={function (question, answer) {
        void submitQuestion(question, answer, false);
      }}
      onSkip={function (question) {
        void submitQuestion(question, null, true);
      }}
      onEditQuestion={function (questionId) {
        setEditingQuestionId(questionId);
      }}
      onRecordAction={function (actionType, workspace) {
        void recordAction(actionType, workspace);
      }}
      onRetryLoad={function () {
        void loadAuthoritativeSession(session.session_id, true);
      }}
      onRestartSession={function () {
        clearSessionId();
        setSession(null);
        setEditingQuestionId(null);
        void loadAuthoritativeSession(null, false);
      }}
      onEnterDashboard={function () {
        void finish('complete');
      }}
      onAnswerLater={function () {
        void finish('defer');
      }}
    />
  );
}
