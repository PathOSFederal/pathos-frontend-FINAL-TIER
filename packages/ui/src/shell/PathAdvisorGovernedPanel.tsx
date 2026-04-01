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

function domainLabel(domain: PathAdvisorGovernedDomain): string {
  if (domain === 'qualification') {
    return 'Qualification';
  }
  if (domain === 'fehb') {
    return 'FEHB';
  }
  return 'Cross-domain';
}

function responseStateLabel(state: string): string {
  if (state === 'grounded') {
    return 'Grounded';
  }
  if (state === 'partial') {
    return 'Partial';
  }
  if (state === 'refused') {
    return 'Refused';
  }
  return state;
}

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

function buildStatusSummary(response: PathAdvisorShapedResponse): string {
  if (response.responseState === 'grounded') {
    return 'This answer is grounded in the current governed pack.';
  }
  if (response.responseState === 'partial') {
    return 'This answer is grounded, but missing inputs limit how complete it can be.';
  }
  return 'PathAdvisor could not answer safely from governed inputs for this request.';
}

function renderStringList(title: string, items: string[], emptyLabel: string): React.ReactNode {
  if (items.length === 0) {
    return (
      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          {title}
        </p>
        <p className="text-[12px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--p-radius)] border px-3 py-3"
      style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
    >
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map(function (item, index) {
          return (
            <li key={title + '-' + String(index)} className="text-[12px]" style={{ color: 'var(--p-text)' }}>
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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

function PathAdvisorGovernedResponseView(props: { response: PathAdvisorShapedResponse }) {
  const response = props.response;

  return (
    <div className="space-y-3" data-testid="pathadvisor-governed-success">
      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
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
        <p className="text-[12px] mt-3" style={{ color: 'var(--p-text-muted)' }}>
          {buildStatusSummary(response)}
        </p>
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
          <p className="text-[12px] mt-2" style={{ color: 'var(--p-text)' }}>
            {response.refusalReason}
          </p>
        </div>
      ) : null}

      {response.missingInputs.length > 0
        ? renderStringList('Missing inputs', response.missingInputs, 'No missing inputs were returned.')
        : null}

      {response.nextSteps.length > 0
        ? renderStringList('Next steps', response.nextSteps, 'No next steps were returned.')
        : null}

      <div
        className="rounded-[var(--p-radius)] border px-3 py-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Grounding and status
        </p>
        <div className="grid grid-cols-1 gap-2 mt-2">
          <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
            Domain: {domainLabel(response.domain)}
          </p>
          <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
            Response state: {responseStateLabel(response.responseState)}
          </p>
          <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
            Grounded: {response.grounded ? 'true' : 'false'}
          </p>
          <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
            Pack version: {response.packVersionId !== null && response.packVersionId !== '' ? response.packVersionId : 'unavailable'}
          </p>
          <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
            Freshness: {freshnessLabel(response.freshnessState)}
          </p>
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
              Loading governed response
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
              PathAdvisor is requesting a governed {domainLabel(props.draft.domain).toLowerCase()} explanation.
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

      {props.result.status === 'success' && props.result.response !== null ? (
        <PathAdvisorGovernedResponseView response={props.result.response} />
      ) : null}
    </div>
  );
}
