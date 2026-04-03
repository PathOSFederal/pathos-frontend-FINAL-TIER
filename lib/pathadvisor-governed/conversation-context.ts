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

function joinList(items: string[]): string {
  if (items.length === 0) {
    return '';
  }

  return items.join(', ');
}

/**
 * Build the temporary local conversational reply used by the restored composer
 * before a dedicated PathAdvisor conversation endpoint exists.
 *
 * Why this exists:
 * The user still needs a conversational entry point today, but this slice does
 * not add backend LLM integration. This helper keeps the reply honest by
 * summarizing the current governed state instead of inventing new truth.
 */
export function buildPathAdvisorLocalConversationReply(
  context: PathAdvisorGovernedConversationContext,
  userMessage: string
): string {
  if (context.trustState === 'loading') {
    return 'PathAdvisor is refreshing the current governed result. Once that response returns, I can explain it within the same trust boundary.';
  }

  if (context.trustState === 'error') {
    return 'The current PathAdvisor issue is technical, not governed. Try the request again once the governed API is reachable.';
  }

  if (context.trustState === 'empty' || context.trustState === 'idle' || context.governedResponse === null) {
    return 'Ask for governed guidance in the panel first, then I can explain that result without stepping outside the approved truth boundary.';
  }

  if (context.governedResponse.responseState === 'refused') {
    const nextSteps = joinList(context.governedResponse.nextSteps);
    return 'The current governed result is intentionally refused for this request. Reason: ' +
      (context.governedResponse.refusalReason !== null && context.governedResponse.refusalReason !== ''
        ? context.governedResponse.refusalReason
        : 'the backend did not provide a refusal reason.') +
      (nextSteps !== '' ? ' Next steps: ' + nextSteps + '.' : '');
  }

  if (context.governedResponse.responseState === 'partial') {
    const missingInputs = joinList(context.governedResponse.missingInputs);
    const nextSteps = joinList(context.governedResponse.nextSteps);
    return 'Here is the current incomplete governed answer for your ' +
      context.governedResponse.domain +
      ' request: ' +
      context.governedResponse.summary +
      (missingInputs !== '' ? ' Missing inputs: ' + missingInputs + '.' : '') +
      (nextSteps !== '' ? ' Next steps: ' + nextSteps + '.' : '') +
      ' I am staying inside the current governed result while answering "' + userMessage + '".';
  }

  return 'Here is the current governed answer for your ' +
    context.governedResponse.domain +
    ' request: ' +
    context.governedResponse.summary +
    ' Key factors: ' +
    (context.governedResponse.keyFactors.length > 0
      ? joinList(context.governedResponse.keyFactors.map(function (item) {
          return item.label;
        }))
      : 'none returned.') +
    ' I am answering from the current governed result rather than inventing new truth about "' + userMessage + '".';
}
