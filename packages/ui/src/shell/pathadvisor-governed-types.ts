/**
 * ============================================================================
 * PATHADVISOR GOVERNED TYPES
 * ============================================================================
 *
 * PURPOSE:
 * Keep the frontend PathAdvisor governed-response contract in one shared place
 * so the app layer, the shared rail UI, and tests all speak the same shape.
 *
 * WHY THIS LIVES IN @pathos/ui:
 * The shared PathAdvisor rail is rendered from the UI package. The app shell
 * should own transport, but the UI package needs to understand the explicit
 * response contract it is rendering.
 *
 * WHY CONVERSATION TYPES ALSO LIVE HERE:
 * The shared rail now has both a governed evidence panel and a conversation
 * shell layered on top of it. The conversation shell still needs explicit
 * state, but it must stay bounded to governed truth. Keeping the shared
 * conversation request and response types here lets the UI package render that
 * state without owning transport logic or inventing hidden semantics.
 */

export type PathAdvisorGovernedDomain =
  | 'qualification'
  | 'fehb'
  | 'cross_domain';

export type PathAdvisorGovernedResponseState =
  | 'grounded'
  | 'partial'
  | 'refused';

export type PathAdvisorFreshnessState =
  | 'fresh'
  | 'aging'
  | 'stale'
  | 'expired';

export interface PathAdvisorKeyFactor {
  factorType: 'finding' | 'recommendation' | 'warning' | 'missing_input' | 'status';
  label: string;
  detail: string;
  code: string | null;
  severity: 'low' | 'medium' | 'high' | null;
}

export interface PathAdvisorDomainGroundingRecord {
  domain: 'qualification' | 'fehb';
  responseState: PathAdvisorGovernedResponseState;
  grounded: boolean;
  partial: boolean;
  refusalReason: string | null;
  missingInputs: string[];
  packId: string | null;
  packKey: string | null;
  versionId: string | null;
  version: number | null;
  freshnessState: PathAdvisorFreshnessState | null;
  freshnessReason: string | null;
}

export interface PathAdvisorGroundingMetadata {
  domain: PathAdvisorGovernedDomain;
  responseState: PathAdvisorGovernedResponseState;
  grounded: boolean;
  partial: boolean;
  refusalReason: string | null;
  missingInputs: string[];
  packId: string | null;
  packKey: string | null;
  versionId: string | null;
  version: number | null;
  freshnessState: PathAdvisorFreshnessState | null;
  freshnessReason: string | null;
  effectiveAt: string | null;
  reviewedAt: string | null;
  reviewBy: string | null;
  expiresAt: string | null;
  servingEligible: boolean;
  sourceSummary: {
    sourceType?: string | null;
    sourceLabel?: string | null;
    sourceCount?: number | null;
    latestPublishedAt?: string | null;
  } | null;
  conversationProvider: string;
  providerUsed: boolean;
  refusalDomain: 'qualification' | 'fehb' | null;
  domains: PathAdvisorDomainGroundingRecord[];
}

export interface PathAdvisorShapedResponse {
  domain: PathAdvisorGovernedDomain;
  responseState: PathAdvisorGovernedResponseState;
  grounded: boolean;
  summary: string;
  explanation: string;
  keyFactors: PathAdvisorKeyFactor[];
  missingInputs: string[];
  nextSteps: string[];
  refusalReason: string | null;
  packVersionId: string | null;
  freshnessState: PathAdvisorFreshnessState | null;
  grounding: PathAdvisorGroundingMetadata;
  servedAt: string;
}

export interface PathAdvisorQualificationDraft {
  yearsExperience: string;
  targetRoles: string;
  skills: string;
  authorizedToWork: boolean;
}

export interface PathAdvisorFehbDraft {
  enrollmentType: string;
  coverageType: string;
  expectedUtilization: string;
  householdSize: string;
  planPreferences: string;
  comparisonTargets: string;
}

export interface PathAdvisorGovernedDraft {
  domain: PathAdvisorGovernedDomain;
  qualification: PathAdvisorQualificationDraft;
  fehb: PathAdvisorFehbDraft;
}

export interface PathAdvisorGovernedResultState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'empty';
  response: PathAdvisorShapedResponse | null;
  errorMessage: string | null;
}

export interface PathAdvisorConversationResponse {
  reply: string;
  responseState: PathAdvisorGovernedResponseState;
  grounded: boolean;
  refusalReason: string | null;
}

export interface PathAdvisorConversationRequestState {
  status: 'idle' | 'loading' | 'error';
  errorMessage: string | null;
}
