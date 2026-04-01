/**
 * ============================================================================
 * RESUME BUILDER MODULE — Barrel exports for the live canvas architecture
 * ============================================================================
 *
 * This barrel file exports all types, components, and hooks from the
 * resume-builder module. Import from '@pathos/ui/resume-builder' or
 * from this file directly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  BuilderStage,
  TopBarSlotId,
  TopBarSlotConfig,
  TopBarState,
  StageTabDef,
  PrimaryCtaConfig,
} from './types/stage-types';
export {
  buildDefaultTopBarState,
  buildStageTabDefs,
  buildPrimaryCtaConfig,
} from './types/stage-types';

export type {
  AnchorKind,
  AnnotationType,
  AnchorSectionId,
  AnchorDef,
  AnchorMap,
  AnchorRegistration,
  CalloutData,
} from './types/anchor-types';

export type {
  TailoringAnnotationClass,
  EvidenceSubType,
  AlignmentSubType,
  CompressionSubType,
  AnnotationSubType,
  TailoringAnnotation,
  AnnotationDisplayConfig,
  SectionAnnotationSet,
} from './types/annotation-types';
export {
  ANNOTATION_DISPLAY_CONFIGS,
  countUnresolvedByClass,
  buildSectionAnnotationSet,
} from './types/annotation-types';

export type {
  SeverityState,
  SectionProgress,
  SectionProgressList,
} from './types/section-progress-types';
export {
  severityToColor,
  severityToLabel,
  deriveSeverity,
  deriveSectionHealth,
  buildSectionProgress,
  completionLabel,
  fitLabel,
  combinedStatusLabel,
  issueCountLabel,
  deriveOverallReadiness,
} from './types/section-progress-types';

export type {
  PreflightCheckStatus,
  PreflightCheckId,
  PreflightCheck,
  PreflightState,
} from './types/validation-types';
export {
  buildPreflightChecks,
  buildPreflightState,
} from './types/validation-types';

export type {
  CalloutLineAnchor,
  CalloutLineDef,
  CalloutLineGeometry,
  CalloutLineState,
  CalloutLineOverlayConfig,
} from './types/callout-line-types';
export {
  buildDefaultCalloutLineConfig,
} from './types/callout-line-types';

export type {
  CanonicalCalloutTarget,
  SectionCalloutConfig,
  CanonicalCalloutRegistry,
} from './types/canonical-callout-defs';
export {
  buildCanonicalCalloutRegistry,
  getCanonicalTargetsForSection,
  getCanonicalCoverageSections,
  getOverviewCalloutTargets,
  getEvidenceInformedOverviewTargets,
  filterCanonicalTargetsForContent,
} from './types/canonical-callout-defs';

export type {
  RequirementLevel,
  ScoringMode,
  FederalSectionId,
  FederalSectionMeta,
  FederalFieldExpectation,
} from './types/federal-section-meta';
export {
  buildFederalSectionMeta,
  getFederalSectionMeta,
  getUISupportedSections,
  getFederalSectionOrder,
  getCanonicalUIOrder,
  getScoringMode,
  getExperienceFieldExpectations,
  requirementLevelLabel,
  requirementLevelColor,
} from './types/federal-section-meta';

// ---------------------------------------------------------------------------
// PathAdvisor context — grounded context for on-demand explanations
// ---------------------------------------------------------------------------

export type {
  PathAdvisorTriggerIntent,
  PathAdvisorResumeContext,
} from './types/pathadvisor-context';
export {
  buildPathAdvisorPrompt,
  getTriggerLabel,
} from './types/pathadvisor-context';

// ---------------------------------------------------------------------------
// Issue categories — typed issue classification for scoring and guidance
// ---------------------------------------------------------------------------

export type {
  IssueCategory,
  IssueSeverityLevel,
  SectionIssue,
  IssueCategoryMeta,
} from './types/issue-categories';
export {
  ISSUE_CATEGORY_META,
  issueCategoryLabel,
  issueCategoryScoringWeight,
  issueCategoryPriorityTier,
  sortIssuesByPriority,
  countUnresolvedByCategory,
  computeWeightedPenalty,
} from './types/issue-categories';

// ---------------------------------------------------------------------------
// Evidence-based scoring engine
// ---------------------------------------------------------------------------

export type {
  ScoringDimensions,
  SectionEvidenceScore,
} from './utils/evidence-scoring';
export {
  detectSectionIssues,
  scoreSection,
  scoreAllSections,
  deriveEvidenceBasedReadiness,
} from './utils/evidence-scoring';

// ---------------------------------------------------------------------------
// Completion color utilities
// ---------------------------------------------------------------------------

export type {
  CompletionBand,
  ColorIntensity,
  IssueSeverity,
} from './utils/completion-colors';
export {
  deriveCompletionBand,
  completionBandColor,
  completionPctColor,
  completionBandLabel,
  completionPctLabel,
  completionBandColorAtIntensity,
  severityStateToCompletionBand,
  severityStateColor,
  preflightStatusColor,
  issueSeverityToCompletionBand,
  issueSeverityColor,
  COMPLETION_BAND_STRONG,
  COMPLETION_BAND_GOOD,
  COMPLETION_BAND_FAIR,
  COMPLETION_BAND_POOR,
} from './utils/completion-colors';

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export { ResumeBuilderTopBar } from './components/ResumeBuilderTopBar';
export type { ResumeBuilderTopBarProps, DropdownItem } from './components/ResumeBuilderTopBar';

export { StageTabs } from './components/StageTabs';
export type { StageTabsProps } from './components/StageTabs';

export { PageBudgetIndicator } from './components/PageBudgetIndicator';
export type { PageBudgetIndicatorProps } from './components/PageBudgetIndicator';

export { SectionProgressBadge } from './components/SectionProgressBadge';
export type { SectionProgressBadgeProps } from './components/SectionProgressBadge';

export { ResumeSectionRail, RESUME_OVERVIEW_ID } from './components/ResumeSectionRail';
export type { ResumeSectionRailProps } from './components/ResumeSectionRail';

export { LiveResumeCanvas } from './components/LiveResumeCanvas';
export type { LiveResumeCanvasProps, EditingField, EditingFieldType } from './components/LiveResumeCanvas';

export { PathOSCalloutCard } from './components/PathOSCalloutCard';
export type { PathOSCalloutCardProps } from './components/PathOSCalloutCard';

export { ResumeCalloutLayer } from './components/ResumeCalloutLayer';
export type { ResumeCalloutLayerProps } from './components/ResumeCalloutLayer';

export { ValidationChecklist } from './components/ValidationChecklist';
export type { ValidationChecklistProps } from './components/ValidationChecklist';

export { CalloutLineOverlay } from './components/CalloutLineOverlay';
export type { CalloutLineOverlayProps } from './components/CalloutLineOverlay';

export { PathAdvisorExplainTrigger } from './components/PathAdvisorExplainTrigger';
export type { PathAdvisorExplainTriggerProps } from './components/PathAdvisorExplainTrigger';

export { TopFixBanner } from './components/TopFixBanner';
export type { TopFixBannerProps } from './components/TopFixBanner';

export { ResumeBuilderPathAdvisorModal } from './components/ResumeBuilderPathAdvisorModal';
export type { ResumeBuilderPathAdvisorModalProps } from './components/ResumeBuilderPathAdvisorModal';

export { ConversationThread } from './components/ConversationThread';
export type { ConversationThreadProps } from './components/ConversationThread';

export { ConversationComposer } from './components/ConversationComposer';
export type { ConversationComposerProps } from './components/ConversationComposer';

// ---------------------------------------------------------------------------
// Explanation formatter — deterministic context-to-modal-section mapper
// ---------------------------------------------------------------------------

export type { FormattedExplanation } from './utils/explanation-formatter';
export {
  formatExplanation,
  buildModalContextLabel,
} from './utils/explanation-formatter';

// ---------------------------------------------------------------------------
// Conversation types — message model for PathAdvisor modal thread
// ---------------------------------------------------------------------------

export type {
  ConversationRole,
  ConversationMessageKind,
  ConversationActionType,
  ConversationAction,
  ConversationMessage,
  ConversationRequestStatus,
  ConversationState,
  ConversationSendPayload,
} from './types/conversation-types';
export {
  generateMessageId,
  createUserMessage,
  createAssistantMessage,
  createErrorMessage,
  buildInitialConversationState,
} from './types/conversation-types';

// ---------------------------------------------------------------------------
// Conversation adapter — request building and response mapping
// ---------------------------------------------------------------------------

export {
  sendConversationRequest,
  buildComposerPlaceholder,
} from './utils/conversation-adapter';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export { useAnchorMap } from './hooks/useAnchorMap';
export type { UseAnchorMapReturn } from './hooks/useAnchorMap';

export { useSectionProgress, getMissingContactFields, buildContactGuidanceLabel } from './hooks/useSectionProgress';
export type { UseSectionProgressReturn } from './hooks/useSectionProgress';

export { useCalloutLines } from './hooks/useCalloutLines';
export type { UseCalloutLinesReturn } from './hooks/useCalloutLines';
