/**
 * ============================================================================
 * PATHADVISOR GOVERNED PANEL
 * ============================================================================
 *
 * PURPOSE:
 * Render the compact bounded-input form and the structured governed response
 * surface for the shared PathAdvisor rail.
 *
 * DESIGN INTENT:
 * - calm and trust-first
 * - explicit about grounded / partial / refused
 * - structured enough that users do not need to parse a wall of text
 * - low-noise trust metadata footer
 *
 * WHY THIS FILE MATTERS TO THE GOVERNED ARCHITECTURE:
 * This panel is where the shared dashboard rail turns a deterministic backend
 * contract into a user-facing experience. The backend decides whether a result
 * is grounded, partial, or refused. This file must not reinterpret that truth.
 * It only renders the shaped fields the backend already provided, and it keeps
 * refusal separate from technical failure so the trust boundary stays honest.
 */

'use client';

import type React from 'react';
import { LoaderCircle, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import type {
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedDomain,
  PathAdvisorGovernedResultState,
  PathAdvisorShapedResponse,
} from './pathadvisor-governed-types';

export interface PathAdvisorGovernedPanelProps {
  draft: PathAdvisorGovernedDraft;
  result: PathAdvisorGovernedResultState;
  onDraftChange: (draft: PathAdvisorGovernedDraft) => void;
  onSubmit: () => void;
}

/**
 * Clone the bounded request draft before editing.
 *
 * Why this exists:
 * The panel makes small controlled updates to nested qualification and FEHB
 * inputs. Cloning keeps those updates explicit and predictable, which matters
 * because stale or accidental mutation could make the governed request state
 * difficult to reason about.
 */
function cloneDraft(draft: PathAdvisorGovernedDraft): PathAdvisorGovernedDraft {
  return {
    domain: draft.domain,
    qualification: {
      yearsExperience: draft.qualification.yearsExperience,
      targetRoles: draft.qualification.targetRoles,
      skills: draft.qualification.skills,
      authorizedToWork: draft.qualification.authorizedToWork,
    },
    fehb: {
      enrollmentType: draft.fehb.enrollmentType,
      coverageType: draft.fehb.coverageType,
      expectedUtilization: draft.fehb.expectedUtilization,
      householdSize: draft.fehb.householdSize,
      planPreferences: draft.fehb.planPreferences,
      comparisonTargets: draft.fehb.comparisonTargets,
    },
  };
}

/**
 * Convert backend domain codes into the calm labels used in the rail.
 *
 * Why this exists:
 * The backend uses canonical transport/domain names. The UI needs readable
 * labels without inventing new semantics.
 */
function domainLabel(domain: PathAdvisorGovernedDomain): string {
  if (domain === 'qualification') {
    return 'Qualification';
  }
  if (domain === 'fehb') {
    return 'FEHB';
  }
  if (domain === 'job_search') {
    return 'Job Search';
  }
  if (domain === 'application_confidence') {
    return 'Application Confidence';
  }
  if (domain === 'resume_readiness') {
    return 'Resume Readiness';
  }
  return 'Cross-domain';
}

/**
 * Translate response-state codes into the exact trust labels shown to users.
 *
 * Why this exists:
 * "partial" is technically correct but can still read as final. The UX goal in
 * this slice is to make that state clearly incomplete, while still preserving
 * the backend truth state.
 */
function responseStateLabel(state: string): string {
  if (state === 'grounded') {
    return 'Grounded';
  }
  if (state === 'partial') {
    return 'Incomplete';
  }
  if (state === 'refused') {
    return 'Refused';
  }
  return state;
}

/**
 * Keep freshness labels human-readable without hiding the backend value.
 */
function freshnessLabel(value: string | null): string {
  if (value === null || value === '') {
    return 'unknown';
  }
  if (value === 'fresh') {
    return 'Fresh';
  }
  if (value === 'aging') {
    return 'Aging';
  }
  if (value === 'stale') {
    return 'Stale';
  }
  if (value === 'expired') {
    return 'Expired';
  }
  return value;
}

/**
 * Keep entry-planning basis labels readable in the trust footer.
 */
function planningBasisLabel(value: string): string {
  if (value === 'explicit_intent') {
    return 'explicit intent';
  }
  if (value === 'capability_fallback') {
    return 'capability fallback';
  }
  if (value === 'default_fallback') {
    return 'default fallback';
  }
  if (value === 'mixed') {
    return 'mixed planning';
  }
  return value;
}

/**
 * Render one compact planning detail for a selected bounded domain.
 */
function planningDomainDetail(response: PathAdvisorShapedResponse): string[] {
  const entryPlanning = response.grounding.entryPlanning ?? null;
  if (entryPlanning === null) {
    return [];
  }

  return entryPlanning.plannedDomains.map(function (item) {
    let capabilitySummary = 'no bounded context required';
    if (item.capabilityState === 'available') {
      capabilitySummary = 'bounded context available';
    } else if (item.capabilityState === 'unavailable') {
      capabilitySummary = 'bounded context unavailable';
    }

    return (
      domainLabel(item.domain) +
      ' via ' +
      planningBasisLabel(item.selectionBasis) +
      ' (' +
      capabilitySummary +
      ')'
    );
  });
}

/**
 * Provide one sentence of framing for the top trust-state banner.
 *
 * Why this exists:
 * The backend already tells us whether the answer is grounded, partial, or
 * refused. This helper turns that explicit state into short UX copy so users do
 * not need to infer trust from the longer explanation body.
 */
function buildStatusSummary(response: PathAdvisorShapedResponse): string {
  const domainCount = response.grounding.domains.length;
  const hasMixedJobSearchAndQualification =
    response.domain === 'cross_domain' &&
    domainCount === 2 &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'job_search';
    }) &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'qualification';
    });
  const hasMixedApplicationConfidenceAndQualification =
    response.domain === 'cross_domain' &&
    domainCount === 2 &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'application_confidence';
    }) &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'qualification';
    });
  const hasMixedResumeAndQualification =
    response.domain === 'cross_domain' &&
    domainCount === 2 &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'resume_readiness';
    }) &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'qualification';
    });
  const hasMixedApplicationConfidenceAndResume =
    response.domain === 'cross_domain' &&
    domainCount === 2 &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'application_confidence';
    }) &&
    response.grounding.domains.some(function (item) {
      return item.domain === 'resume_readiness';
    });

  if (hasMixedJobSearchAndQualification) {
    if (response.responseState === 'grounded') {
      return 'This answer combines live federal job search and governed qualification guidance.';
    }
    if (response.responseState === 'partial') {
      return 'This answer combines live federal job search and governed qualification guidance, but one part of the answer is still limited.';
    }
    return 'PathAdvisor is intentionally holding this combined answer until job search and qualification boundaries support it safely.';
  }
  if (hasMixedApplicationConfidenceAndQualification) {
    if (response.responseState === 'grounded') {
      return 'This answer combines current selected-job application confidence and governed qualification guidance.';
    }
    if (response.responseState === 'partial') {
      return 'This answer combines current selected-job application confidence and governed qualification guidance, but one part of the answer is still limited.';
    }
    return 'PathAdvisor is intentionally holding this combined answer until selected-job application context and qualification boundaries support it safely.';
  }
  if (hasMixedResumeAndQualification) {
    if (response.responseState === 'grounded') {
      return 'This answer combines current resume readiness and governed qualification guidance.';
    }
    if (response.responseState === 'partial') {
      return 'This answer combines current resume readiness and governed qualification guidance, but one part of the answer is still limited.';
    }
    return 'PathAdvisor is intentionally holding this combined answer until resume-readiness context and qualification boundaries support it safely.';
  }
  if (hasMixedApplicationConfidenceAndResume) {
    if (response.responseState === 'grounded') {
      return 'This answer combines current selected-job application confidence and current resume readiness.';
    }
    if (response.responseState === 'partial') {
      return 'This answer combines current selected-job application confidence and current resume readiness, but one part of the answer is still limited.';
    }
    return 'PathAdvisor is intentionally holding this combined answer until selected-job application context and resume-readiness context support it safely.';
  }
  if (response.domain === 'cross_domain') {
    if (response.responseState === 'grounded') {
      return 'This answer combines multiple bounded PathAdvisor domains.';
    }
    if (response.responseState === 'partial') {
      return 'This answer combines multiple bounded PathAdvisor domains, but one or more parts are still limited.';
    }
    return 'PathAdvisor is intentionally holding this combined answer until the required bounded domains support it safely.';
  }

  if (response.domain === 'job_search') {
    if (response.responseState === 'grounded') {
      return 'This answer is grounded in the current live federal job search result.';
    }
    if (response.responseState === 'partial') {
      return 'This answer uses live federal job search, but the search scope is still incomplete.';
    }
    return 'PathAdvisor is intentionally holding this answer until live federal job search or search scope supports it safely.';
  }
  if (response.domain === 'application_confidence') {
    if (response.responseState === 'grounded') {
      return 'This answer is grounded in the current selected-job application-confidence context.';
    }
    if (response.responseState === 'partial') {
      return 'This answer uses the current selected-job application-confidence context, but application evidence is still incomplete.';
    }
    return 'PathAdvisor is intentionally holding this answer until a current selected-job application context and target alignment support it safely.';
  }
  if (response.domain === 'resume_readiness') {
    if (response.responseState === 'grounded') {
      return 'This answer is grounded in the current live resume-readiness snapshot.';
    }
    if (response.responseState === 'partial') {
      return 'This answer uses the current live resume-readiness snapshot, but resume evidence is still incomplete.';
    }
    return 'PathAdvisor is intentionally holding this answer until a live resume snapshot and target alignment support it safely.';
  }
  if (response.responseState === 'grounded') {
    return 'This answer is grounded in the current governed pack.';
  }
  if (response.responseState === 'partial') {
    return 'This answer is incomplete because governed inputs are still missing.';
  }
  return 'PathAdvisor is intentionally holding this answer until governed coverage or inputs support it safely.';
}

interface PathAdvisorMissingInputDescriptor {
  key: string;
  label: string;
  detail: string;
  domain:
    | 'qualification'
    | 'fehb'
    | 'application_confidence'
    | 'resume_readiness'
    | 'cross_domain';
}

/**
 * Turn backend missing-input identifiers into scan-friendly cards.
 *
 * Why this exists:
 * The backend already returns the structured missing input keys. The UI should
 * make those keys understandable without guessing from explanation text. This
 * helper is intentionally small and conservative: it only rewrites known keys
 * into clearer labels and leaves unknown values visible instead of inventing a
 * new model.
 */
function describeMissingInput(input: string): PathAdvisorMissingInputDescriptor {
  if (input === 'years_experience' || input === 'qualification.years_experience') {
    return {
      key: input,
      label: 'Years of experience',
      detail: 'Needed to explain qualification guidance with the right experience range.',
      domain: 'qualification',
    };
  }
  if (input === 'target_roles' || input === 'qualification.target_roles') {
    return {
      key: input,
      label: 'Target roles',
      detail: 'Needed so PathAdvisor can explain governed guidance for the right role target.',
      domain: 'qualification',
    };
  }
  if (input === 'skills' || input === 'qualification.skills') {
    return {
      key: input,
      label: 'Skills',
      detail: 'Needed so the governed explanation can align your background to the request.',
      domain: 'qualification',
    };
  }
  if (input === 'authorized_to_work' || input === 'qualification.authorized_to_work') {
    return {
      key: input,
      label: 'Authorization to work',
      detail: 'Needed when the governed qualification path depends on work authorization.',
      domain: 'qualification',
    };
  }
  if (input === 'coverage_type' || input === 'fehb.coverage_type') {
    return {
      key: input,
      label: 'Coverage type',
      detail: 'Needed to explain FEHB guidance for the right household coverage path.',
      domain: 'fehb',
    };
  }
  if (input === 'expected_utilization' || input === 'fehb.expected_utilization') {
    return {
      key: input,
      label: 'Expected utilization',
      detail: 'Needed so FEHB guidance can reflect expected care usage instead of broad assumptions.',
      domain: 'fehb',
    };
  }
  if (input === 'plan_preferences' || input === 'fehb.plan_preferences') {
    return {
      key: input,
      label: 'Plan preferences',
      detail: 'Needed when the governed answer depends on what tradeoffs matter most to you.',
      domain: 'fehb',
    };
  }
  if (input === 'comparison_targets' || input === 'fehb.comparison_targets') {
    return {
      key: input,
      label: 'Comparison targets',
      detail: 'Needed when PathAdvisor is expected to compare specific FEHB options.',
      domain: 'fehb',
    };
  }
  if (input === 'job_search.keyword' || input === 'job_search_target_keyword') {
    return {
      key: input,
      label: 'Target role or keyword',
      detail: 'Needed so PathAdvisor can search for the right type of federal jobs.',
      domain: 'cross_domain',
    };
  }
  if (input === 'job_search_live_search') {
    return {
      key: input,
      label: 'Live job search availability',
      detail: 'Needed when PathAdvisor must use live USAJOBS-backed search to answer availability questions safely.',
      domain: 'cross_domain',
    };
  }
  if (input === 'application_confidence_context') {
    return {
      key: input,
      label: 'Selected job application context',
      detail: 'Needed before PathAdvisor can explain whether you should apply for the current selected job safely.',
      domain: 'application_confidence',
    };
  }
  if (input === 'application_target_role_alignment') {
    return {
      key: input,
      label: 'Selected job target alignment',
      detail: 'Needed when the current selected-job application context does not match the target role in the question.',
      domain: 'application_confidence',
    };
  }
  if (input === 'application_skills_evidence') {
    return {
      key: input,
      label: 'Skills evidence',
      detail: 'Needed because the current selected-job evaluation is still missing skills evidence for a stronger apply-or-hold answer.',
      domain: 'application_confidence',
    };
  }
  if (input === 'application_employment_dates') {
    return {
      key: input,
      label: 'Employment dates',
      detail: 'Needed because the current selected-job evaluation is still missing dated experience evidence.',
      domain: 'application_confidence',
    };
  }
  if (input === 'application_hours_per_week') {
    return {
      key: input,
      label: 'Hours per week',
      detail: 'Needed because the current selected-job evaluation is still missing workload evidence.',
      domain: 'application_confidence',
    };
  }
  if (input === 'application_transcript_evidence') {
    return {
      key: input,
      label: 'Transcript evidence',
      detail: 'Needed when the current selected-job application path still depends on transcript-backed evidence.',
      domain: 'application_confidence',
    };
  }
  if (input === 'application_missing_evidence') {
    return {
      key: input,
      label: 'Application evidence',
      detail: 'Needed because the current selected-job evaluation still has unresolved evidence gaps.',
      domain: 'application_confidence',
    };
  }
  if (input === 'resume_readiness_snapshot') {
    return {
      key: input,
      label: 'Resume readiness snapshot',
      detail: 'Needed before PathAdvisor can explain resume readiness from the current live application intelligence state.',
      domain: 'resume_readiness',
    };
  }
  if (input === 'resume_target_role_alignment') {
    return {
      key: input,
      label: 'Resume target alignment',
      detail: 'Needed when the current live resume snapshot does not match the target role or selected job in the question.',
      domain: 'resume_readiness',
    };
  }
  if (input === 'resume_employment_dates') {
    return {
      key: input,
      label: 'Employment dates',
      detail: 'Needed because federal resume review depends on dated experience evidence.',
      domain: 'resume_readiness',
    };
  }
  if (input === 'resume_hours_per_week') {
    return {
      key: input,
      label: 'Hours per week',
      detail: 'Needed when federal resume evidence must show workload or time basis clearly.',
      domain: 'resume_readiness',
    };
  }
  if (input === 'resume_transcript_evidence') {
    return {
      key: input,
      label: 'Transcript evidence',
      detail: 'Needed when the current resume or qualification path depends on transcript-backed evidence.',
      domain: 'resume_readiness',
    };
  }
  if (input === 'resume_missing_evidence') {
    return {
      key: input,
      label: 'Resume evidence',
      detail: 'Needed because the current live resume snapshot still has unresolved evidence gaps.',
      domain: 'resume_readiness',
    };
  }

  return {
    key: input,
    label: input.replace(/[_\.]/g, ' '),
    detail: 'This backend-provided input is still needed before the governed answer can be completed.',
    domain: 'cross_domain',
  };
}

/**
 * Keep action copy tied to the bounded inputs already on the page.
 *
 * Why this exists:
 * Missing-input affordances should help users navigate the current bounded form,
 * not launch a larger wizard or infer hidden workflow.
 */
function missingInputActionLabel(
  domain:
    | 'qualification'
    | 'fehb'
    | 'application_confidence'
    | 'resume_readiness'
    | 'cross_domain'
): string {
  if (domain === 'qualification') {
    return 'Review qualification inputs';
  }
  if (domain === 'fehb') {
    return 'Review FEHB inputs';
  }
  if (domain === 'application_confidence') {
    return 'Open job details';
  }
  if (domain === 'resume_readiness') {
    return 'Open resume workspace';
  }
  return 'Review request inputs';
}

/**
 * Render the current backend truth state as a compact badge.
 *
 * Why this exists:
 * The badge is the fastest trust signal in the rail. It intentionally mirrors
 * the backend response_state rather than inferring tone from the explanation.
 */
function StatusBadge(props: { response: PathAdvisorShapedResponse }) {
  let icon = <ShieldCheck className="w-3.5 h-3.5" aria-hidden />;
  let tint = 'var(--p-success)';

  if (props.response.responseState === 'partial') {
    icon = <ShieldAlert className="w-3.5 h-3.5" aria-hidden />;
    tint = 'var(--p-warning, #eab308)';
  } else if (props.response.responseState === 'refused') {
    icon = <ShieldX className="w-3.5 h-3.5" aria-hidden />;
    tint = 'var(--p-danger, #ef4444)';
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1"
      style={{
        background: 'color-mix(in srgb, ' + tint + ' 14%, var(--p-surface))',
        border: '1px solid color-mix(in srgb, ' + tint + ' 28%, var(--p-border))',
        color: tint,
      }}
    >
      {icon}
      <span className="text-[11px] font-semibold">
        {responseStateLabel(props.response.responseState)}
      </span>
    </div>
  );
}

/**
 * Shared text input for the bounded governed request form.
 *
 * Why this exists:
 * The governed request surface is intentionally small. This wrapper keeps focus,
 * hover, and base styling consistent across every bounded input.
 */
function DraftField(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium" style={{ color: 'var(--p-text-muted)' }}>
        {props.label}
      </span>
      <input
        type={props.type !== undefined ? props.type : 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={function (event) {
          props.onChange(event.target.value);
        }}
        className="h-10 rounded-[var(--p-radius)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
        style={{
          background: 'var(--p-surface2)',
          border: '1px solid var(--p-border)',
          color: 'var(--p-text)',
        }}
      />
    </label>
  );
}

/**
 * Shared select input for bounded governed fields with finite options.
 */
function DraftSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium" style={{ color: 'var(--p-text-muted)' }}>
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={function (event) {
          props.onChange(event.target.value);
        }}
        className="h-10 rounded-[var(--p-radius)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
        style={{
          background: 'var(--p-surface2)',
          border: '1px solid var(--p-border)',
          color: 'var(--p-text)',
        }}
      >
        {props.options.map(function (option) {
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

/**
 * Render the bounded request form that collects only the minimum frontend facts
 * needed to exercise the governed PathAdvisor endpoints.
 *
 * Why this exists:
 * This form is intentionally not a full workflow. It only captures a small,
 * explicit set of user-provided facts so the backend can produce a governed
 * response. Keeping the form bounded preserves determinism and avoids implying
 * that the frontend is synthesizing hidden context.
 */
function PathAdvisorGovernedRequestForm(props: {
  draft: PathAdvisorGovernedDraft;
  isLoading: boolean;
  onDraftChange: (draft: PathAdvisorGovernedDraft) => void;
  onSubmit: () => void;
}) {
  function updateDomain(nextDomain: PathAdvisorGovernedDomain): void {
    const nextDraft = cloneDraft(props.draft);
    nextDraft.domain = nextDomain;
    props.onDraftChange(nextDraft);
  }

  function updateQualificationField(
    key: 'yearsExperience' | 'targetRoles' | 'skills',
    value: string
  ): void {
    const nextDraft = cloneDraft(props.draft);
    nextDraft.qualification[key] = value;
    props.onDraftChange(nextDraft);
  }

  function updateAuthorizedToWork(value: boolean): void {
    const nextDraft = cloneDraft(props.draft);
    nextDraft.qualification.authorizedToWork = value;
    props.onDraftChange(nextDraft);
  }

  function updateFehbField(
    key: 'enrollmentType' | 'coverageType' | 'expectedUtilization' | 'householdSize' | 'planPreferences' | 'comparisonTargets',
    value: string
  ): void {
    const nextDraft = cloneDraft(props.draft);
    nextDraft.fehb[key] = value;
    props.onDraftChange(nextDraft);
  }

  const qualificationVisible =
    props.draft.domain === 'qualification' || props.draft.domain === 'cross_domain';
  const fehbVisible =
    props.draft.domain === 'fehb' || props.draft.domain === 'cross_domain';

  return (
    <div
      className="rounded-[var(--p-radius)] border px-3 py-3 space-y-3"
      style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      data-testid="pathadvisor-governed-form"
    >
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Governed request
        </p>
        <div className="grid grid-cols-1 gap-2">
          {(['qualification', 'fehb', 'cross_domain'] as PathAdvisorGovernedDomain[]).map(function (domain) {
            const isSelected = props.draft.domain === domain;
            return (
              <button
                key={domain}
                type="button"
                onClick={function () {
                  updateDomain(domain);
                }}
                className="rounded-[var(--p-radius)] px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] transition-colors"
                style={{
                  background: isSelected
                    ? 'color-mix(in srgb, var(--p-accent) 12%, var(--p-surface2))'
                    : 'var(--p-surface2)',
                  border: isSelected
                    ? '1px solid var(--p-accent)'
                    : '1px solid var(--p-border)',
                  color: 'var(--p-text)',
                }}
                aria-pressed={isSelected}
              >
                <span className="text-[12px] font-semibold">{domainLabel(domain)}</span>
                <span className="block text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
                  {domain === 'qualification'
                    ? 'Explain governed qualification guidance from bounded user facts.'
                    : domain === 'fehb'
                      ? 'Explain governed FEHB guidance from bounded coverage inputs.'
                      : 'Explain qualification and FEHB together without inventing certainty.'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {qualificationVisible ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Qualification inputs
          </p>
          <div className="grid grid-cols-1 gap-2">
            <DraftField
              label="Years of experience"
              type="number"
              value={props.draft.qualification.yearsExperience}
              placeholder="e.g. 5"
              onChange={function (value) {
                updateQualificationField('yearsExperience', value);
              }}
            />
            <DraftField
              label="Target roles"
              value={props.draft.qualification.targetRoles}
              placeholder="Program Analyst, IT Specialist"
              onChange={function (value) {
                updateQualificationField('targetRoles', value);
              }}
            />
            <DraftField
              label="Skills"
              value={props.draft.qualification.skills}
              placeholder="analysis, writing, stakeholder management"
              onChange={function (value) {
                updateQualificationField('skills', value);
              }}
            />
            <label
              className="flex items-center gap-2 rounded-[var(--p-radius)] px-3 py-2"
              style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
            >
              <input
                type="checkbox"
                checked={props.draft.qualification.authorizedToWork}
                onChange={function (event) {
                  updateAuthorizedToWork(event.target.checked);
                }}
              />
              <span className="text-[12px]" style={{ color: 'var(--p-text)' }}>
                Authorized to work
              </span>
            </label>
          </div>
        </div>
      ) : null}

      {fehbVisible ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            FEHB inputs
          </p>
          <div className="grid grid-cols-1 gap-2">
            <DraftSelect
              label="Coverage type"
              value={props.draft.fehb.coverageType}
              onChange={function (value) {
                updateFehbField('coverageType', value);
              }}
              options={[
                { label: 'Select coverage type', value: '' },
                { label: 'Self only', value: 'self_only' },
                { label: 'Self plus one', value: 'self_plus_one' },
                { label: 'Family', value: 'family' },
              ]}
            />
            <DraftSelect
              label="Expected utilization"
              value={props.draft.fehb.expectedUtilization}
              onChange={function (value) {
                updateFehbField('expectedUtilization', value);
              }}
              options={[
                { label: 'Select utilization', value: '' },
                { label: 'Low', value: 'low' },
                { label: 'Moderate', value: 'moderate' },
                { label: 'High', value: 'high' },
              ]}
            />
            <DraftField
              label="Plan preferences"
              value={props.draft.fehb.planPreferences}
              placeholder="low deductible, broad network"
              onChange={function (value) {
                updateFehbField('planPreferences', value);
              }}
            />
            <DraftField
              label="Comparison targets"
              value={props.draft.fehb.comparisonTargets}
              placeholder="GEHA HDHP, BCBS Basic"
              onChange={function (value) {
                updateFehbField('comparisonTargets', value);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3 rounded-[var(--p-radius)] px-3 py-2" style={{ background: 'var(--p-surface2)' }}>
        <div>
          <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
            PathAdvisor explains governed results.
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
            It does not create truth outside the currently served governed pack.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.isLoading}
          className="min-h-10 rounded-[var(--p-radius)] px-3 py-2 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] transition-colors"
          style={{
            background: props.isLoading ? 'var(--p-surface)' : 'var(--p-accent)',
            color: props.isLoading ? 'var(--p-text-muted)' : 'var(--p-bg)',
            border: props.isLoading ? '1px solid var(--p-border)' : '1px solid var(--p-accent)',
          }}
        >
          {props.isLoading ? 'Loading…' : 'Get governed guidance'}
        </button>
      </div>
    </div>
  );
}

/**
 * Render the backend-provided missing inputs as actionable but still bounded UI.
 *
 * Why this exists:
 * Missing inputs are the clearest explanation for why a result is incomplete or
 * refused. This view turns the backend list into readable cards and offers a
 * lightweight navigation action back to the existing request form.
 */
function MissingInputsSection(props: {
  draft: PathAdvisorGovernedDraft;
  missingInputs: string[];
  onDraftChange: (draft: PathAdvisorGovernedDraft) => void;
}) {
  const items = props.missingInputs.map(function (item) {
    return describeMissingInput(item);
  });

  return (
    <div
      className="rounded-[var(--p-radius)] border px-3 py-3"
      style={{
        background: 'color-mix(in srgb, var(--p-warning, #eab308) 7%, var(--p-surface))',
        borderColor: 'color-mix(in srgb, var(--p-warning, #eab308) 18%, var(--p-border))',
      }}
      data-testid="pathadvisor-missing-inputs"
    >
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
        Missing inputs
      </p>
      <p className="text-[12px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
        These backend-provided inputs are the reason this governed answer is not complete yet.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map(function (item, index) {
          return (
            <li
              key={item.key + '-' + String(index)}
              className="rounded-[var(--p-radius)] border px-3 py-3"
              style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
                    {item.label}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
                    {item.detail}
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--p-text-dim)' }}>
                    Provide this in the {item.domain === 'qualification' ? 'qualification' : item.domain === 'fehb' ? 'FEHB' : item.domain === 'application_confidence' ? 'current job details' : item.domain === 'resume_readiness' ? 'resume workspace' : 'request'} inputs above.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={function () {
                    const nextDraft = cloneDraft(props.draft);
                    if (
                      props.draft.domain !== 'cross_domain' &&
                      item.domain !== 'cross_domain' &&
                      item.domain !== 'application_confidence'
                    ) {
                      nextDraft.domain = item.domain;
                    }
                    props.onDraftChange(nextDraft);
                  }}
                  className="min-h-9 rounded-[var(--p-radius)] px-3 py-2 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] transition-colors"
                  style={{
                    background: 'var(--p-surface2)',
                    border: '1px solid var(--p-border)',
                    color: 'var(--p-text)',
                  }}
                  data-testid={'pathadvisor-missing-input-action-' + String(index)}
                >
                  {missingInputActionLabel(item.domain)}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Render the structured governed response.
 *
 * Why this exists:
 * This is the main trust-preserving view for governed PathAdvisor responses. It
 * renders explicit backend sections in a stable order so users can quickly tell:
 * - what the answer is
 * - whether it is complete
 * - what is missing
 * - what to do next
 * - which governed pack state served it
 *
 * The component does not derive hidden certainty from prose. Every trust signal
 * comes from explicit backend fields.
 */
function PathAdvisorGovernedResponseView(props: {
  draft: PathAdvisorGovernedDraft;
  response: PathAdvisorShapedResponse;
  isRefreshing: boolean;
  onDraftChange: (draft: PathAdvisorGovernedDraft) => void;
}) {
  const response = props.response;
  const isPartial = response.responseState === 'partial';
  const isRefused = response.responseState === 'refused';
  const statusBackground = isRefused
    ? 'color-mix(in srgb, var(--p-danger, #ef4444) 8%, var(--p-surface))'
    : isPartial
      ? 'color-mix(in srgb, var(--p-warning, #eab308) 8%, var(--p-surface))'
      : 'var(--p-surface)';
  const statusBorder = isRefused
    ? 'color-mix(in srgb, var(--p-danger, #ef4444) 20%, var(--p-border))'
    : isPartial
      ? 'color-mix(in srgb, var(--p-warning, #eab308) 20%, var(--p-border))'
      : 'var(--p-border)';
  const nextStepsTitle =
    isPartial || isRefused ? 'Path to completion' : 'Next steps';

  return (
    <div className="space-y-3" data-testid="pathadvisor-governed-success">
      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: statusBackground, borderColor: statusBorder }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge response={response} />
          <span
            className="rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}
          >
            Domain: {domainLabel(response.domain)}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}
          >
            Grounded: {response.grounded ? 'Yes' : 'No'}
          </span>
        </div>
        {props.isRefreshing ? (
          <p className="text-[11px] mt-3" style={{ color: 'var(--p-text-dim)' }}>
            Refreshing the governed answer. The last response stays visible until the updated request returns.
          </p>
        ) : null}
        <p className="text-[12px] mt-3" style={{ color: 'var(--p-text-muted)' }}>
          {buildStatusSummary(response)}
        </p>
        {isPartial ? (
          <p className="text-[12px] mt-2 font-medium" style={{ color: 'var(--p-text)' }} data-testid="pathadvisor-partial-signal">
            Missing inputs below explain why this answer is incomplete.
          </p>
        ) : null}
        {isRefused ? (
          <p className="text-[12px] mt-2 font-medium" style={{ color: 'var(--p-text)' }} data-testid="pathadvisor-refused-signal">
            This is an intentional trust boundary, not a technical failure.
          </p>
        ) : null}
      </div>

      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Summary
        </p>
        <p className="text-[15px] font-semibold mt-2" style={{ color: 'var(--p-text)' }}>
          {response.summary}
        </p>
      </div>

      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Explanation
        </p>
        <p className="text-[12px] mt-2 leading-6" style={{ color: 'var(--p-text)' }}>
          {response.explanation}
        </p>
      </div>

      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Key factors
        </p>
        {response.keyFactors.length === 0 ? (
          <p className="text-[12px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
            No structured factors were returned.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {response.keyFactors.map(function (factor, index) {
              return (
                <li
                  key={'factor-' + String(index)}
                  className="rounded-[var(--p-radius)] px-3 py-2"
                  style={{ background: 'var(--p-surface2)' }}
                >
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
                    {factor.label}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
                    {factor.detail}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--p-text-dim)' }}>
                    Type: {factor.factorType}
                    {factor.severity !== null ? ' • Severity: ' + factor.severity : ''}
                    {factor.code !== null ? ' • Code: ' + factor.code : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {response.refusalReason !== null && response.refusalReason !== '' ? (
        <div
          className="rounded-[var(--p-radius)] border px-3 py-3"
          style={{
            background: 'color-mix(in srgb, var(--p-danger, #ef4444) 8%, var(--p-surface))',
            borderColor: 'color-mix(in srgb, var(--p-danger, #ef4444) 22%, var(--p-border))',
          }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Refusal boundary
          </p>
          <p className="text-[12px] mt-2 font-semibold" style={{ color: 'var(--p-text)' }}>
            PathAdvisor is intentionally not answering this request yet.
          </p>
          <p className="text-[12px] mt-2" style={{ color: 'var(--p-text)' }}>
            {response.refusalReason}
          </p>
        </div>
      ) : null}

      {response.missingInputs.length > 0
        ? <MissingInputsSection
            draft={props.draft}
            missingInputs={response.missingInputs}
            onDraftChange={props.onDraftChange}
          />
        : null}

      {response.nextSteps.length > 0
        ? (
          <div
            className="rounded-[var(--p-radius)] border px-3 py-3"
            style={{
              background: isPartial || isRefused
                ? 'color-mix(in srgb, var(--p-accent) 6%, var(--p-surface))'
                : 'var(--p-surface)',
              borderColor: isPartial || isRefused
                ? 'color-mix(in srgb, var(--p-accent) 18%, var(--p-border))'
                : 'var(--p-border)',
            }}
            data-testid="pathadvisor-next-steps"
          >
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
              {nextStepsTitle}
            </p>
            <p className="text-[12px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
              {isPartial
                ? 'These are the next bounded steps to complete the governed answer.'
                : isRefused
                  ? 'These are the next bounded steps before PathAdvisor can answer safely.'
                  : 'These backend-provided steps support follow-through on the governed answer.'}
            </p>
            <ul className="mt-3 space-y-2">
              {response.nextSteps.map(function (item, index) {
                return (
                  <li key={'next-step-' + String(index)} className="text-[12px]" style={{ color: 'var(--p-text)' }}>
                    {item}
                  </li>
                );
              })}
            </ul>
          </div>
        )
        : null}

      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        data-testid="pathadvisor-trust-footer"
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Grounding and status
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
            Domain: {domainLabel(response.domain)}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
            State: {responseStateLabel(response.responseState)}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
            Grounded: {response.grounded ? 'true' : 'false'}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
            Pack: {response.packVersionId !== null && response.packVersionId !== '' ? response.packVersionId : 'unavailable'}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
            Freshness: {freshnessLabel(response.freshnessState)}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 mt-3">
          {response.grounding.entryPlanning != null ? (
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              Entry planning: {response.grounding.entryPlanning.planningSummary}
            </p>
          ) : null}
          {response.grounding.entryPlanning != null &&
          response.grounding.entryPlanning.plannedDomains.length > 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              Planning detail: {planningDomainDetail(response).join(' • ')}
            </p>
          ) : null}
          {response.grounding.domains.length > 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              Domain grounding: {response.grounding.domains.map(function (item) {
                return domainLabel(item.domain) + ' ' + responseStateLabel(item.responseState);
              }).join(' • ')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Orchestrate the governed request form plus whichever trust state is currently
 * active.
 *
 * Why this exists:
 * The parent shell owns transport and result state, but this panel owns the UX
 * distinction between idle, loading, empty, technical failure, and governed
 * success. That distinction is central to PathAdvisor's trust-first behavior.
 */
export function PathAdvisorGovernedPanel(props: PathAdvisorGovernedPanelProps) {
  return (
    <div className="px-3 pt-2 pb-3 space-y-3" data-testid="pathadvisor-governed-panel">
      <PathAdvisorGovernedRequestForm
        draft={props.draft}
        isLoading={props.result.status === 'loading'}
        onDraftChange={props.onDraftChange}
        onSubmit={props.onSubmit}
      />

      {props.result.status === 'loading' ? (
        <div
          className="rounded-[var(--p-radius)] border px-3 py-4 flex items-center gap-3"
          data-testid="pathadvisor-governed-loading"
          style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        >
          <LoaderCircle className="w-4 h-4 animate-spin" style={{ color: 'var(--p-accent)' }} />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
              {props.result.response !== null ? 'Refreshing governed response' : 'Loading governed response'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
              {props.result.response !== null
                ? 'PathAdvisor is refreshing the governed ' + domainLabel(props.draft.domain).toLowerCase() + ' explanation without hiding the prior answer.'
                : 'PathAdvisor is requesting a governed ' + domainLabel(props.draft.domain).toLowerCase() + ' explanation.'}
            </p>
          </div>
        </div>
      ) : null}

      {props.result.status === 'error' ? (
        <div
          className="rounded-[var(--p-radius)] border px-3 py-4"
          data-testid="pathadvisor-governed-error"
          style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
            Technical request failure
          </p>
          <p className="text-[11px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
            {props.result.errorMessage !== null && props.result.errorMessage !== ''
              ? props.result.errorMessage
              : 'PathAdvisor could not reach the governed API.'}
          </p>
        </div>
      ) : null}

      {props.result.status === 'empty' ? (
        <div
          className="rounded-[var(--p-radius)] border px-3 py-4"
          data-testid="pathadvisor-governed-empty"
          style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
            No governed response was returned
          </p>
          <p className="text-[11px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
            PathAdvisor did not receive a shaped response for this request.
          </p>
        </div>
      ) : null}

      {props.result.status === 'idle' ? (
        <div
          className="rounded-[var(--p-radius)] border px-3 py-4"
          data-testid="pathadvisor-governed-idle"
          style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
            Governed PathAdvisor is ready
          </p>
          <p className="text-[11px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
            Choose a bounded domain, provide the minimum inputs, and PathAdvisor will explain the governed result without inventing certainty.
          </p>
        </div>
      ) : null}

      {(props.result.status === 'success' || props.result.status === 'loading') && props.result.response !== null ? (
        <PathAdvisorGovernedResponseView
          draft={props.draft}
          response={props.result.response}
          isRefreshing={props.result.status === 'loading'}
          onDraftChange={props.onDraftChange}
        />
      ) : null}
    </div>
  );
}
