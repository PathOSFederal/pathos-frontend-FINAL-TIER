/**
 * ============================================================================
 * VALIDATION PREFLIGHT TYPES — Calm checklist before export
 * ============================================================================
 *
 * PURPOSE: Defines the validation preflight checklist model. Validation
 * is the final stage of the federal resume builder workflow, presenting
 * a calm, professional checklist that confirms the resume is export-ready.
 *
 * DESIGN: Validation feels like airline preflight, not a generic success
 * banner. Each check item has a clear pass/fail/warn status with a brief
 * explanation. The document remains visible behind the checklist so the
 * user never loses context.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Preflight check status — pass / fail / warn
// ---------------------------------------------------------------------------

/**
 * Status of a single preflight check item.
 *
 *   pass:    Check passed — no issues found.
 *   fail:    Check failed — blocking issue that prevents export.
 *   warn:    Check passed but with a caveat worth noting.
 *   pending: Check has not been evaluated yet (loading/computing).
 */
export type PreflightCheckStatus = 'pass' | 'fail' | 'warn' | 'pending';

// ---------------------------------------------------------------------------
// Preflight check ID — the specific checks in the checklist
// ---------------------------------------------------------------------------

/**
 * Identifier for each check in the validation preflight checklist.
 * These are the exact checks required by the federal resume builder:
 *
 *   page-length:       Resume is within the 2-page federal limit.
 *   required-sections: All mandatory sections are present and non-empty.
 *   federal-details:   Federal-specific fields are complete.
 *   evidence-coverage: Target-job evidence coverage is acceptable.
 *   no-critical:       No critical issues blocking export.
 */
export type PreflightCheckId =
  | 'page-length'
  | 'required-sections'
  | 'federal-details'
  | 'evidence-coverage'
  | 'no-critical';

// ---------------------------------------------------------------------------
// Preflight check definition — a single checklist item
// ---------------------------------------------------------------------------

/**
 * A single item in the validation preflight checklist.
 * Contains the check result, a human-readable label, and an
 * optional detail message explaining any issues.
 */
export interface PreflightCheck {
  /** Which check this is. */
  id: PreflightCheckId;

  /** Human-readable label displayed in the checklist. */
  label: string;

  /** Current status of this check. */
  status: PreflightCheckStatus;

  /** Optional detail message. Shown when status is fail or warn
   *  to explain what needs attention. */
  detail: string;
}

// ---------------------------------------------------------------------------
// Preflight state — the full checklist state
// ---------------------------------------------------------------------------

/**
 * Overall state of the validation preflight. Contains all check items
 * plus a computed summary of whether the resume is export-ready.
 */
export interface PreflightState {
  /** All preflight check items in display order. */
  checks: PreflightCheck[];

  /** Whether all checks pass (no failures). When true, the Export
   *  button is enabled. */
  allPassed: boolean;

  /** Whether any checks have warnings. Export is still allowed but
   *  the user should review the warnings. */
  hasWarnings: boolean;

  /** Whether any checks are still pending evaluation. */
  hasPending: boolean;

  /** Human-readable summary of the preflight result.
   *  "Ready to Export" / "X issues need attention" / "Checking..." */
  summaryLabel: string;
}

// ---------------------------------------------------------------------------
// Factory: build preflight checks from resume state
// ---------------------------------------------------------------------------

/**
 * Build the set of preflight checks from resume analysis data.
 * Each parameter maps to one check's pass/fail determination.
 *
 * This is a deterministic computation — no side effects, no async.
 * In the future, a real analysis engine may compute these values;
 * for now, the builder derives them from local resume state.
 */
export function buildPreflightChecks(params: {
  pageCount: number;
  pageLimit: number;
  requiredSectionsPresent: boolean;
  federalDetailsComplete: boolean;
  evidenceCoverageAcceptable: boolean;
  criticalIssueCount: number;
}): PreflightCheck[] {
  const checks: PreflightCheck[] = [];

  /* 1. Page length check */
  const pageStatus: PreflightCheckStatus = params.pageCount <= params.pageLimit ? 'pass' : 'fail';
  checks.push({
    id: 'page-length',
    label: 'Page length within ' + params.pageLimit + '-page limit',
    status: pageStatus,
    detail: pageStatus === 'pass'
      ? params.pageCount + ' of ' + params.pageLimit + ' pages used'
      : 'Resume is ' + params.pageCount + ' pages — exceeds the ' + params.pageLimit + '-page limit',
  });

  /* 2. Required sections check */
  checks.push({
    id: 'required-sections',
    label: 'All required sections present',
    status: params.requiredSectionsPresent ? 'pass' : 'fail',
    detail: params.requiredSectionsPresent
      ? 'All required sections are present and non-empty'
      : 'One or more required sections are missing or empty',
  });

  /* 3. Federal details check */
  checks.push({
    id: 'federal-details',
    label: 'Federal details complete',
    status: params.federalDetailsComplete ? 'pass' : 'warn',
    detail: params.federalDetailsComplete
      ? 'Federal-specific fields are complete'
      : 'Some federal employment details may be incomplete',
  });

  /* 4. Evidence coverage check */
  checks.push({
    id: 'evidence-coverage',
    label: 'Target job evidence coverage acceptable',
    status: params.evidenceCoverageAcceptable ? 'pass' : 'warn',
    detail: params.evidenceCoverageAcceptable
      ? 'Evidence coverage meets minimum threshold for target job'
      : 'Evidence coverage could be stronger for the target job requirements',
  });

  /* 5. No critical issues check */
  const criticalStatus: PreflightCheckStatus = params.criticalIssueCount === 0 ? 'pass' : 'fail';
  checks.push({
    id: 'no-critical',
    label: 'No critical issues blocking export',
    status: criticalStatus,
    detail: criticalStatus === 'pass'
      ? 'No blocking issues found'
      : params.criticalIssueCount + ' critical issue' + (params.criticalIssueCount === 1 ? '' : 's') + ' must be resolved before export',
  });

  return checks;
}

/**
 * Build the complete PreflightState from a set of checks.
 * Computes the summary fields from the individual check statuses.
 */
export function buildPreflightState(checks: PreflightCheck[]): PreflightState {
  let allPassed = true;
  let hasWarnings = false;
  let hasPending = false;
  let failCount = 0;

  for (let i = 0; i < checks.length; i++) {
    const status = checks[i].status;
    if (status === 'fail') {
      allPassed = false;
      failCount = failCount + 1;
    }
    if (status === 'warn') {
      hasWarnings = true;
    }
    if (status === 'pending') {
      hasPending = true;
      allPassed = false;
    }
  }

  let summaryLabel = 'Ready to Export';
  if (hasPending) {
    summaryLabel = 'Checking...';
  } else if (failCount > 0) {
    summaryLabel = failCount + ' issue' + (failCount === 1 ? '' : 's') + ' need' + (failCount === 1 ? 's' : '') + ' attention';
  } else if (hasWarnings) {
    summaryLabel = 'Ready to Export (review warnings)';
  }

  return {
    checks: checks,
    allPassed: allPassed,
    hasWarnings: hasWarnings,
    hasPending: hasPending,
    summaryLabel: summaryLabel,
  };
}
