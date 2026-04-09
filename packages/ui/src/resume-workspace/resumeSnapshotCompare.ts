/**
 * ============================================================================
 * RESUME SNAPSHOT COMPARE HELPERS — Day 82 history and compare UX
 * ============================================================================
 *
 * PURPOSE:
 * The frontend is allowed to compare saved backend snapshots, but it must not
 * invent new diagnostics logic. This module keeps the allowed comparison work
 * bounded to:
 * - selecting stable display labels
 * - computing deltas between saved backend values
 * - grouping added / resolved / persistent codes
 *
 * TRUST BOUNDARY:
 * Everything here operates on persisted backend responses only. The helper does
 * not run diagnostics, does not reinterpret rule semantics, and does not
 * generate new advisory prose.
 */

import type {
  ResumeDiagnosticsEvaluateResponse,
} from './resumeDiagnostics';
import type {
  ResumeDiagnosticsSnapshot,
} from '../stores/resumeWorkspaceStore';

export type ResumeSnapshotChangeDirection = 'improved' | 'unchanged' | 'regressed';

export interface ResumeSnapshotCategoryDelta {
  code: string;
  label: string;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
  status: ResumeSnapshotChangeDirection;
}

export interface ResumeSnapshotCodeDelta {
  added: string[];
  resolved: string[];
  persistent: string[];
}

export interface ResumeSnapshotExplanationDelta {
  previousHeadline: string | null;
  currentHeadline: string | null;
  previousTopPriority: string | null;
  currentTopPriority: string | null;
  headlineChanged: boolean;
  topPriorityChanged: boolean;
}

export interface ResumeSnapshotCompareSummary {
  readinessStatus: ResumeSnapshotChangeDirection;
  currentReadinessBand: string;
  previousReadinessBand: string;
  previousOverallSummary: string | null;
  currentOverallSummary: string | null;
  categoryDeltas: ResumeSnapshotCategoryDelta[];
  issueDelta: ResumeSnapshotCodeDelta;
  recommendationDelta: ResumeSnapshotCodeDelta;
  explanationDelta: ResumeSnapshotExplanationDelta;
}

const READINESS_RANK: Record<string, number> = {
  insufficient_evidence: 0,
  needs_revision: 1,
  workable: 2,
  strong: 3,
};

/**
 * Snapshot ids are intentionally long and opaque. The history panel only needs
 * a short stable display suffix so people can tell entries apart without
 * turning the workspace into a raw engineering log.
 */
export function getSnapshotDisplayId(snapshotId: string | null | undefined): string {
  if (typeof snapshotId !== 'string' || snapshotId.trim().length === 0) {
    return 'Unknown snapshot';
  }
  const trimmedId = snapshotId.trim();
  if (trimmedId.length <= 14) {
    return trimmedId;
  }
  return '…' + trimmedId.slice(trimmedId.length - 10);
}

function compareReadinessBand(
  currentBand: string,
  previousBand: string
): ResumeSnapshotChangeDirection {
  const currentRank =
    Object.prototype.hasOwnProperty.call(READINESS_RANK, currentBand)
      ? READINESS_RANK[currentBand]
      : 0;
  const previousRank =
    Object.prototype.hasOwnProperty.call(READINESS_RANK, previousBand)
      ? READINESS_RANK[previousBand]
      : 0;
  if (currentRank > previousRank) {
    return 'improved';
  }
  if (currentRank < previousRank) {
    return 'regressed';
  }
  return 'unchanged';
}

function compareNumericDelta(
  currentValue: number | null,
  previousValue: number | null
): ResumeSnapshotChangeDirection {
  if (currentValue === null || previousValue === null) {
    return 'unchanged';
  }
  if (currentValue > previousValue) {
    return 'improved';
  }
  if (currentValue < previousValue) {
    return 'regressed';
  }
  return 'unchanged';
}

function collectSortedCodeDelta(
  previousCodes: string[],
  currentCodes: string[]
): ResumeSnapshotCodeDelta {
  const added: string[] = [];
  const resolved: string[] = [];
  const persistent: string[] = [];

  for (let i = 0; i < currentCodes.length; i++) {
    const currentCode = currentCodes[i];
    let existsInPrevious = false;
    for (let previousIndex = 0; previousIndex < previousCodes.length; previousIndex++) {
      if (previousCodes[previousIndex] === currentCode) {
        existsInPrevious = true;
        break;
      }
    }
    if (existsInPrevious) {
      persistent.push(currentCode);
    } else {
      added.push(currentCode);
    }
  }

  for (let i = 0; i < previousCodes.length; i++) {
    const previousCode = previousCodes[i];
    let existsInCurrent = false;
    for (let currentIndex = 0; currentIndex < currentCodes.length; currentIndex++) {
      if (currentCodes[currentIndex] === previousCode) {
        existsInCurrent = true;
        break;
      }
    }
    if (!existsInCurrent) {
      resolved.push(previousCode);
    }
  }

  added.sort();
  resolved.sort();
  persistent.sort();

  return {
    added: added,
    resolved: resolved,
    persistent: persistent,
  };
}

function getExplanationTextValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

export function buildResumeSnapshotCompareSummary(
  previousSnapshot: ResumeDiagnosticsSnapshot,
  currentSnapshot: ResumeDiagnosticsSnapshot
): ResumeSnapshotCompareSummary {
  const previousResponse = previousSnapshot.response;
  const currentResponse = currentSnapshot.response;

  const categoryDeltas: ResumeSnapshotCategoryDelta[] = [];
  for (let i = 0; i < currentResponse.category_scores.length; i++) {
    const currentCategory = currentResponse.category_scores[i];
    let previousScore: number | null = null;
    let previousFound = false;
    for (let previousIndex = 0; previousIndex < previousResponse.category_scores.length; previousIndex++) {
      const previousCategory = previousResponse.category_scores[previousIndex];
      if (previousCategory.code === currentCategory.code) {
        previousScore = previousCategory.score;
        previousFound = true;
        break;
      }
    }
    if (!previousFound) {
      previousScore = null;
    }
    categoryDeltas.push({
      code: currentCategory.code,
      label: currentCategory.label,
      previousScore: previousScore,
      currentScore: currentCategory.score,
      delta:
        currentCategory.score !== null && previousScore !== null
          ? currentCategory.score - previousScore
          : null,
      status: compareNumericDelta(currentCategory.score, previousScore),
    });
  }

  const previousIssueCodes: string[] = [];
  for (let i = 0; i < previousResponse.issues.length; i++) {
    previousIssueCodes.push(previousResponse.issues[i].code);
  }
  const currentIssueCodes: string[] = [];
  for (let i = 0; i < currentResponse.issues.length; i++) {
    currentIssueCodes.push(currentResponse.issues[i].code);
  }

  const previousRecommendationCodes: string[] = [];
  for (let i = 0; i < previousResponse.recommendations.length; i++) {
    previousRecommendationCodes.push(previousResponse.recommendations[i].code);
  }
  const currentRecommendationCodes: string[] = [];
  for (let i = 0; i < currentResponse.recommendations.length; i++) {
    currentRecommendationCodes.push(currentResponse.recommendations[i].code);
  }

  const previousOverallSummary =
    typeof previousResponse.overall.summary === 'string'
      ? previousResponse.overall.summary
      : null;
  const currentOverallSummary =
    typeof currentResponse.overall.summary === 'string'
      ? currentResponse.overall.summary
      : null;

  const previousHeadline =
    previousResponse.explanations !== null && previousResponse.explanations !== undefined &&
    previousResponse.explanations.overall_summary !== null &&
    previousResponse.explanations.overall_summary !== undefined
      ? getExplanationTextValue(previousResponse.explanations.overall_summary.headline)
      : null;
  const currentHeadline =
    currentResponse.explanations !== null && currentResponse.explanations !== undefined &&
    currentResponse.explanations.overall_summary !== null &&
    currentResponse.explanations.overall_summary !== undefined
      ? getExplanationTextValue(currentResponse.explanations.overall_summary.headline)
      : null;
  const previousTopPriority =
    previousResponse.explanations !== null && previousResponse.explanations !== undefined &&
    previousResponse.explanations.overall_summary !== null &&
    previousResponse.explanations.overall_summary !== undefined
      ? getExplanationTextValue(previousResponse.explanations.overall_summary.top_priority)
      : null;
  const currentTopPriority =
    currentResponse.explanations !== null && currentResponse.explanations !== undefined &&
    currentResponse.explanations.overall_summary !== null &&
    currentResponse.explanations.overall_summary !== undefined
      ? getExplanationTextValue(currentResponse.explanations.overall_summary.top_priority)
      : null;

  return {
    readinessStatus: compareReadinessBand(
      currentResponse.overall.readiness_band,
      previousResponse.overall.readiness_band
    ),
    currentReadinessBand: currentResponse.overall.readiness_band,
    previousReadinessBand: previousResponse.overall.readiness_band,
    previousOverallSummary: previousOverallSummary,
    currentOverallSummary: currentOverallSummary,
    categoryDeltas: categoryDeltas,
    issueDelta: collectSortedCodeDelta(previousIssueCodes, currentIssueCodes),
    recommendationDelta: collectSortedCodeDelta(previousRecommendationCodes, currentRecommendationCodes),
    explanationDelta: {
      previousHeadline: previousHeadline,
      currentHeadline: currentHeadline,
      previousTopPriority: previousTopPriority,
      currentTopPriority: currentTopPriority,
      headlineChanged: previousHeadline !== currentHeadline,
      topPriorityChanged: previousTopPriority !== currentTopPriority,
    },
  };
}

export function getResumeSnapshotResponse(
  snapshot: ResumeDiagnosticsSnapshot | null
): ResumeDiagnosticsEvaluateResponse | null {
  if (snapshot === null) {
    return null;
  }
  return snapshot.response;
}
