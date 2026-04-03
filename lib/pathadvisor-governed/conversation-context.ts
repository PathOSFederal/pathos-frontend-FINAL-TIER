/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION CONTEXT
 * ============================================================================
 *
 * PURPOSE:
 * Build the bounded structured context that a future conversational PathAdvisor
 * endpoint can consume safely.
 *
 * WHY THIS FILE EXISTS:
 * The shared dashboard rail now has two layers:
 * 1. a conversational shell the user can type into
 * 2. a governed evidence surface backed by the PathAdvisor response contract
 *
 * The conversational shell must not scrape strings back out of rendered UI.
 * Instead, it needs a deterministic context object built from authoritative
 * state only:
 * - the bounded governed request draft
 * - the explicit governed response object
 * - the current trust state
 * - lightweight route or selection metadata already available in scope
 *
 * This keeps the future LLM handoff honest. The UI can stay conversational
 * without turning rendered prose into a shadow source of truth.
 *
 * IMPORTANT BOUNDARY:
 * This file now assembles request context only. It no longer generates local
 * conversational replies. Once the shared dashboard composer is wired to the
 * backend conversation endpoint, the frontend should not act like a second
 * reasoning engine.
 */

import type {
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedResultState,
  PathAdvisorGovernedResponseState,
  PathAdvisorShapedResponse,
} from '@pathos/ui';

export interface PathAdvisorConversationEntityContext {
  entityType: 'job' | 'dashboard' | 'unknown';
  entityId: string | null;
  entityLabel: string | null;
}

export interface PathAdvisorGovernedConversationContext {
  currentView: string;
  requestDomain: PathAdvisorGovernedDraft['domain'];
  trustState: PathAdvisorGovernedResponseState | 'loading' | 'idle' | 'error' | 'empty';
  boundedRequest: {
    qualification: {
      yearsExperience: string;
      targetRoles: string;
      skills: string;
      authorizedToWork: boolean;
    };
    fehb: {
      enrollmentType: string;
      coverageType: string;
      expectedUtilization: string;
      householdSize: string;
      planPreferences: string;
      comparisonTargets: string;
    };
  };
  selectedEntity: PathAdvisorConversationEntityContext;
  governedResponse: {
    domain: PathAdvisorShapedResponse['domain'];
    responseState: PathAdvisorShapedResponse['responseState'];
    grounded: boolean;
    summary: string;
    explanation: string;
    keyFactors: Array<{
      factorType: string;
      label: string;
      detail: string;
      code: string | null;
      severity: string | null;
    }>;
    missingInputs: string[];
    nextSteps: string[];
    refusalReason: string | null;
    packVersionId: string | null;
    freshnessState: string | null;
  } | null;
}

export interface BuildPathAdvisorConversationContextArgs {
  currentView: string;
  draft: PathAdvisorGovernedDraft;
  result: PathAdvisorGovernedResultState;
  selectedEntity?: PathAdvisorConversationEntityContext | null;
}

/**
 * Normalize the current governed shell state into a future-safe conversation
 * context payload.
 *
 * Step by step:
 * 1. Copy the bounded request values exactly as the user entered them.
 * 2. Copy the current explicit trust state from the governed result.
 * 3. If a governed response exists, copy only authoritative backend fields.
 * 4. Never look at rendered UI strings, DOM text, or presentation labels.
 *
 * Why the explanation field is still allowed here:
 * The explanation text is part of the backend shaped contract. It is still an
 * authoritative field. What we must avoid is re-reading presentation strings
 * that the frontend invented around that contract.
 */
export function buildPathAdvisorConversationContext(
  args: BuildPathAdvisorConversationContextArgs
): PathAdvisorGovernedConversationContext {
  const selectedEntity: PathAdvisorConversationEntityContext =
    args.selectedEntity !== undefined && args.selectedEntity !== null
      ? {
          entityType: args.selectedEntity.entityType,
          entityId: args.selectedEntity.entityId,
          entityLabel: args.selectedEntity.entityLabel,
        }
      : {
          entityType: 'dashboard',
          entityId: null,
          entityLabel: null,
        };

  let trustState: PathAdvisorGovernedConversationContext['trustState'] =
    args.result.status === 'success' ? 'idle' : args.result.status;
  let governedResponse: PathAdvisorGovernedConversationContext['governedResponse'] = null;

  if (args.result.response !== null) {
    trustState = args.result.response.responseState;
    governedResponse = {
      domain: args.result.response.domain,
      responseState: args.result.response.responseState,
      grounded: args.result.response.grounded,
      summary: args.result.response.summary,
      explanation: args.result.response.explanation,
      keyFactors: args.result.response.keyFactors.map(function (item) {
        return {
          factorType: item.factorType,
          label: item.label,
          detail: item.detail,
          code: item.code,
          severity: item.severity,
        };
      }),
      missingInputs: args.result.response.missingInputs.map(function (item) {
        return item;
      }),
      nextSteps: args.result.response.nextSteps.map(function (item) {
        return item;
      }),
      refusalReason: args.result.response.refusalReason,
      packVersionId: args.result.response.packVersionId,
      freshnessState: args.result.response.freshnessState,
    };
  }

  return {
    currentView: args.currentView,
    requestDomain: args.draft.domain,
    trustState: trustState,
    boundedRequest: {
      qualification: {
        yearsExperience: args.draft.qualification.yearsExperience,
        targetRoles: args.draft.qualification.targetRoles,
        skills: args.draft.qualification.skills,
        authorizedToWork: args.draft.qualification.authorizedToWork,
      },
      fehb: {
        enrollmentType: args.draft.fehb.enrollmentType,
        coverageType: args.draft.fehb.coverageType,
        expectedUtilization: args.draft.fehb.expectedUtilization,
        householdSize: args.draft.fehb.householdSize,
        planPreferences: args.draft.fehb.planPreferences,
        comparisonTargets: args.draft.fehb.comparisonTargets,
      },
    },
    selectedEntity: selectedEntity,
    governedResponse: governedResponse,
  };
}
