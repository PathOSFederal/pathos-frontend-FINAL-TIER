export type IntelligenceSnapshotKind =
  | 'career_readiness'
  | 'resume_readiness'
  | 'job_match'
  | 'application_confidence';

export interface IntelligenceSnapshotMeta {
  snapshot_id: string;
  generated_at: string;
  input_hash: string;
  rule_version: string;
  knowledge_pack_version: string;
  kind: IntelligenceSnapshotKind;
}

export interface IntelligenceEvidenceRef {
  key: string;
  label: string;
  evidence_kind?: 'known' | 'inferred' | 'missing' | null;
  source_type:
    | 'profile_field'
    | 'resume_section'
    | 'resume_bullet'
    | 'job_field'
    | 'system_rule';
  source_ref?: string | null;
}

export interface IntelligenceMissingEvidence {
  key: string;
  label: string;
  why_it_matters?: string | null;
}

export interface IntelligenceReasonItem {
  code: string;
  rule_id?: string | null;
  message: string;
  weight?: number | null;
}

export interface IntelligenceTopGapItem {
  key: string;
  title: string;
  impact_points: number;
  reason: string;
}

export interface IntelligenceActionPlanItem {
  key: string;
  title: string;
  impact_points: number;
  effort: 'S' | 'M' | 'L';
  helper: string;
}

export interface CareerReadinessSnapshot {
  meta: IntelligenceSnapshotMeta;
  overall_score: number;
  label: string;
  target_role: string;
  spokes: Record<string, number>;
  top_gaps: IntelligenceTopGapItem[];
  action_plan: IntelligenceActionPlanItem[];
  reasons: IntelligenceReasonItem[];
  evidence_used: IntelligenceEvidenceRef[];
  missing_evidence: IntelligenceMissingEvidence[];
}

export interface ResumeSuggestionItem {
  key: string;
  title: string;
  impact_points: number;
  example?: string | null;
}

export interface ResumeReadinessSnapshot {
  meta: IntelligenceSnapshotMeta;
  overall_score: number;
  target_role: string;
  categories: Record<string, number>;
  suggestions: ResumeSuggestionItem[];
  reasons: IntelligenceReasonItem[];
  evidence_used: IntelligenceEvidenceRef[];
  missing_evidence: IntelligenceMissingEvidence[];
}

export interface UnifiedCareerResumeWorkspaceSource {
  id: string;
  name: string;
  mode: 'master' | 'tailored';
  updatedAt: string;
  targetRoleTitle: string | null;
}

export type UnifiedCareerResumeIntelligenceSource =
  | 'fallback'
  | 'partial_live'
  | 'live';

export interface PathAdvisorCareerReadinessContext {
  snapshotId: string;
  generatedAt: string;
  overallScore: number;
  label: string;
  targetRole: string;
  spokes: Record<string, number>;
  topGaps: string[];
  nextActions: string[];
  missingEvidence: string[];
}

export interface PathAdvisorResumeReadinessContext {
  snapshotId: string;
  generatedAt: string;
  overallScore: number;
  targetRole: string;
  categories: Record<string, number>;
  suggestions: string[];
  missingEvidence: string[];
}

export interface PathAdvisorApplicationConfidenceContext {
  source: UnifiedCareerResumeIntelligenceSource;
  screenId: string;
  jobId: string;
  jobTitle: string;
  targetRole: string;
  overallScore: number;
  recommendation: string;
  decisionBand: string;
  confidenceBand: string;
  rationaleSummary: string;
  priorityLevel: string | null;
  alertImportance: string | null;
  blockingIssues: string[];
  missingEvidence: string[];
  nextActions: string[];
  decisionVersion: string | null;
}

export interface PathAdvisorIntelligenceContext {
  source: UnifiedCareerResumeIntelligenceSource;
  workspaceResume: UnifiedCareerResumeWorkspaceSource | null;
  careerReadiness: PathAdvisorCareerReadinessContext | null;
  resumeReadiness: PathAdvisorResumeReadinessContext | null;
  applicationConfidence: PathAdvisorApplicationConfidenceContext | null;
}

export interface UnifiedCareerResumeIntelligenceState {
  source: UnifiedCareerResumeIntelligenceSource;
  isRefreshing: boolean;
  lastUpdatedLabel: string | null;
  errorMessage: string | null;
  careerReadiness: CareerReadinessSnapshot | null;
  resumeReadiness: ResumeReadinessSnapshot | null;
  workspaceResume: UnifiedCareerResumeWorkspaceSource | null;
  refresh?: (() => void) | null;
}
