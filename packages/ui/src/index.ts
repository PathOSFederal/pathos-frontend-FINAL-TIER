/**
 * @pathos/ui — Shared AppShell, screens, and components.
 *
 * BOUNDARY RULE: This package MUST NOT import from next/* or electron/*.
 * Run `pnpm check:boundaries` to verify.
 */

// Shared components
export { ModuleCard, type ModuleCardProps } from './components/ModuleCard';
export {
  AskPathAdvisorButton,
  type AskPathAdvisorButtonProps,
} from './components/AskPathAdvisorButton';

// Shell components
export { SharedAppShell, type AppShellProps, type Platform, type ThemeVariant } from './shell/AppShell';
export { Sidebar, type SidebarProps } from './shell/Sidebar';
export { TopBar, type TopBarProps } from './shell/TopBar';
export { PathAdvisorCard, type PathAdvisorCardProps, type PathAdvisorMessage } from './shell/PathAdvisorCard';
export { PathAdvisorRail, type PathAdvisorRailProps, type PathAdvisorAnchorContext } from './shell/PathAdvisorRail';
export { PathAdvisorGovernedPanel, type PathAdvisorGovernedPanelProps } from './shell/PathAdvisorGovernedPanel';
export type {
  PathAdvisorGovernedDomain,
  PathAdvisorGovernedResponseState,
  PathAdvisorFreshnessState,
  PathAdvisorKeyFactor,
  PathAdvisorDomainGroundingRecord,
  PathAdvisorGroundingMetadata,
  PathAdvisorShapedResponse,
  PathAdvisorQualificationDraft,
  PathAdvisorFehbDraft,
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedResultState,
  PathAdvisorConversationResponse,
  PathAdvisorConversationRequestState,
} from './shell/pathadvisor-governed-types';
export {
  usePathAdvisorBriefingStore,
  type PathAdvisorBriefing,
  type BriefingSection,
} from './stores/pathAdvisorBriefingStore';
export {
  usePathAdvisorScreenOverridesStore,
  type PathAdvisorScreenOverrides,
  type PathAdvisorRailContent,
} from './stores/pathAdvisorScreenOverridesStore';
export {
  usePathAdvisorContextLogStore,
  buildAnchorKey,
  getAnchorKeysForScreen,
  getEntriesForAnchor,
  type PathAdvisorAnchorType,
  type PathAdvisorAnchor,
  type PathAdvisorContextSection,
  type PathAdvisorContextCta,
  type PathAdvisorContextTag,
  type PathAdvisorContextEntry,
} from './stores/pathAdvisorContextLogStore';
export {
  usePathAdvisorThreadStore,
  generateThreadTitle,
  type AdvisorThread,
  type AdvisorThreadMessage,
} from './stores/pathAdvisorThreadStore';
export { THREAD_LIST_MAX_HEIGHT_PX } from './shell/Sidebar';

// Screens
export {
  DashboardScreen,
  type DashboardConversationExchange,
  type DashboardScreenProps,
  type DashboardData,
  type ThreadMessage,
  type GovernedResponseData,
  buildGovernedResponseDataFromShapedResponse,
  type CompactSummary,
} from './screens/DashboardScreen';
export { CareerReadinessScreen } from './screens/CareerReadinessScreen';
export { CareerScreen, type CareerScreenProps } from './screens/CareerScreen';
export { SettingsScreen, type SettingsScreenProps } from './screens/SettingsScreen';
export { GuidedApplyScreen, type GuidedApplyScreenProps } from './screens/GuidedApplyScreen';
export {
  JobSearchScreen,
  type JobSearchScreenProps,
  type JobSearchLiveAdvisorIntegration,
  type JobSearchLiveSearchIntegration,
} from './screens/JobSearchScreen';
export {
  SavedJobsScreen,
  type SavedJobsScreenProps,
  type SavedJobsLiveAdvisorIntegration,
} from './screens/SavedJobsScreen';
export { ResumeBuilderScreen, type ResumeBuilderScreenProps } from './screens/ResumeBuilderScreen';
export { ResumeWorkspaceScreen, type ResumeWorkspaceScreenProps } from './screens/ResumeWorkspaceScreen';
export { PlaceholderScreen, type PlaceholderScreenProps } from './screens/PlaceholderScreen';
export {
  SavedJobsLiveAdvisorPanel,
  type SavedJobsLiveStoredJob,
  type SavedJobsLiveEvidenceRef,
  type SavedJobsLiveReasonLikeItem,
  type SavedJobsLiveNextAction,
  type SavedJobsLiveBlockingIssue,
  type SavedJobsLiveApplicationDecision,
  type SavedJobsLiveEvaluation,
  type SavedJobsLiveEvaluationState,
} from './screens/_components/SavedJobsLiveAdvisorPanel';
export type {
  CanonicalIntelligenceSummary,
  ScreenNextAction,
  CanonicalMatchProjectionDimension,
  CanonicalJobMatchProjection,
  DashboardIntelligencePayload,
  ResumeBuilderIntelligencePayload,
  ScreenIntelligenceEnvelope,
} from './types/pathadvisorIntelligence';
export { mockDashboardData } from './screens/dashboard/mockDashboardData';
export type { DashboardViewModel, FocusItem, ActiveTrack, SignalItem } from './screens/dashboard/dashboardModel';
export { buildDashboardViewModel } from './screens/dashboard/buildDashboardViewModel';
export { useDashboardSnapshot } from './screens/dashboard/useDashboardSnapshot';
export type { DashboardChanges, DashboardSnapshot } from './screens/dashboard/useDashboardSnapshot';
export {
  ApplicationConfidenceCenterScreen,
  type ApplicationConfidenceCenterScreenProps,
  type ApplicationConfidenceAnchorContext,
} from './screens/ApplicationConfidenceCenterScreen';
export type {
  IntelligenceActionPlanItem,
  IntelligenceEvidenceRef,
  IntelligenceMissingEvidence,
  IntelligenceReasonItem,
  IntelligenceSnapshotMeta,
  IntelligenceTopGapItem,
  CareerReadinessSnapshot,
  PathAdvisorApplicationConfidenceContext,
  PathAdvisorCareerReadinessContext,
  PathAdvisorIntelligenceContext,
  PathAdvisorResumeReadinessContext,
  ResumeReadinessSnapshot,
  ResumeSuggestionItem,
  UnifiedCareerResumeIntelligenceSource,
  UnifiedCareerResumeIntelligenceState,
  UnifiedCareerResumeWorkspaceSource,
} from './intelligence/careerResumeIntelligence';
export {
  useResumeWorkspaceStore,
  type ResumeDraftSummary,
} from './stores/resumeWorkspaceStore';
export { buildResumeDiagnosticsRequest } from './resume-workspace/resumeDiagnostics';
