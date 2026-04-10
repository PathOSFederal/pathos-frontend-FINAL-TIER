/**
 * Bounded PathAdvisor intelligence payloads shared across dashboard surfaces.
 *
 * These types mirror backend-owned canonical context and screen-specific
 * projections. The UI treats them as opaque display payloads and must not
 * compute new matching meaning from local state.
 */

export interface CanonicalIntelligenceSummary {
  targetRoleClusters: string[];
  preferredLocations: string[];
  readinessState: string;
  fitLanes: string[];
  blockers: string[];
  topMissingItems: string[];
  nextBestActions: string[];
  activeThreads: string[];
  profileCompleteness: number;
  freshnessBand: 'fresh' | 'aging' | 'stale' | 'unknown';
  confidenceBand: 'low' | 'medium' | 'high';
  recentMeaningfulChanges: string[];
  activitySignals: string[];
  updatedAt: string;
}

export interface ScreenNextAction {
  actionId: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  reason: string;
}

export interface CanonicalMatchProjectionDimension {
  dimensionId: string;
  label: string;
  score: number;
  status: 'strong' | 'building' | 'weak';
  explanation: string;
}

export interface CanonicalJobMatchProjection {
  overallScore: number;
  confidenceBand: 'low' | 'medium' | 'high';
  blockerSeverity: 'low' | 'medium' | 'high';
  explanationSummary: string;
  dimensions: CanonicalMatchProjectionDimension[];
  nextActions: string[];
  blockers: string[];
  warnings: string[];
}

export interface DashboardIntelligencePayload {
  screen: 'dashboard';
  pathadvisorMode: 'strategy_summary';
  context: CanonicalIntelligenceSummary;
  summary: string;
  strongestCurrentFitLanes: string[];
  activeBlockers: string[];
  topMissingItems: string[];
  nextBestAction: ScreenNextAction;
  confidenceSummary: string;
}

export interface ResumeBuilderIntelligencePayload {
  screen: 'resume_builder';
  pathadvisorMode: 'readiness_evidence';
  context: CanonicalIntelligenceSummary;
  summary: string;
  targetAlignmentWarnings: string[];
  evidenceGaps: string[];
  suggestedBuilderFocus: string[];
  nextBestAction: ScreenNextAction;
}

export interface ScreenIntelligenceEnvelope {
  screen: 'job_search' | 'saved_jobs';
  pathadvisorMode: 'search_refinement' | 'decision_risk';
  context: CanonicalIntelligenceSummary;
  summary: string;
  nextBestAction: ScreenNextAction;
  jobMatchProjection: CanonicalJobMatchProjection;
  refinementSuggestions?: string[];
  decisionGuidance?: string[];
}
