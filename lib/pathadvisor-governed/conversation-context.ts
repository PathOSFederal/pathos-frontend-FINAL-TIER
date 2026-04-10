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
  PathAdvisorApplicationConfidenceContext,
  PathAdvisorContextEntry,
  PathAdvisorIntelligenceContext,
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedResultState,
  PathAdvisorGovernedResponseState,
  PathAdvisorShapedResponse,
  UnifiedCareerResumeIntelligenceState,
} from '@pathos/ui';
import { getAnchorKeysForScreen, getEntriesForAnchor } from '@pathos/ui';

export interface PathAdvisorConversationEntityContext {
  entityType: 'job' | 'dashboard' | 'unknown';
  entityId: string | null;
  entityLabel: string | null;
}

export interface PathAdvisorConversationCarryForwardContext {
  sourceKind: 'immediately_previous_user_turn';
  transformKind: 'same_thing_but' | 'modifier_follow_up';
  baseUserMessage: string;
  priorUserMessage: string;
  originalUserMessage: string;
  effectiveUserMessage: string;
  modifiers: Array<{
    kind: 'grade' | 'series' | 'location' | 'work_arrangement' | 'freeform';
    value: string;
  }>;
  modifierChanges: Array<{
    kind: 'grade' | 'series' | 'location' | 'work_arrangement' | 'freeform';
    operation: 'add' | 'replace' | 'remove';
    value: string | null;
    previousValue: string | null;
  }>;
}

export interface PathAdvisorEntryContext {
  intelligenceContext: PathAdvisorIntelligenceContext | null;
  currentTargetLabel: string | null;
  routeTargetLabel: string | null;
  routeAnchorLabel: string | null;
  routeScreenId: string | null;
}

export interface PathAdvisorConversationTargetScope {
  sourceKind:
    | 'career_readiness'
    | 'resume_readiness'
    | 'workspace_resume'
    | 'qualification_draft'
    | 'route_anchor';
  rawLabel: string;
  normalizedTitle: string | null;
  seriesCode: string | null;
  grade: string | null;
  familyTags: string[];
}

export interface PathAdvisorGovernedConversationContext {
  currentView: string;
  requestDomain: PathAdvisorShapedResponse['domain'];
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
  intelligenceContext?: PathAdvisorIntelligenceContext;
  carryForwardContext?: PathAdvisorConversationCarryForwardContext;
  currentTargetScope?: PathAdvisorConversationTargetScope;
  routeContext?: PathAdvisorRouteConversationContext;
  /**
   * Optional bounded conversation hints for the backend conversation contract.
   *
   * IMPORTANT:
   * These are not raw domain drafts. They are the only optional list-shaped
   * `draft_inputs` fields the backend accepts for this route.
   */
  conversationDraftInputs?: {
    focusTopics: string[];
    selectedMissingInputs: string[];
    selectedNextSteps: string[];
  };
  selectedEntity: PathAdvisorConversationEntityContext;
  governedResponse: {
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
    grounding: {
      domain: PathAdvisorShapedResponse['grounding']['domain'];
      responseState: PathAdvisorShapedResponse['grounding']['responseState'];
      grounded: boolean;
      partial: boolean;
      missingInputs: string[];
      packId: string | null;
      packKey: string | null;
      versionId: string | null;
      version: number | null;
      freshnessState: string | null;
      freshnessReason: string | null;
      servingEligible: boolean;
      conversationProvider: string;
      providerUsed: boolean;
      entryPlanning?: PathAdvisorShapedResponse['grounding']['entryPlanning'];
    };
  } | null;
}

export interface BuildPathAdvisorConversationContextArgs {
  currentView: string;
  draft: PathAdvisorGovernedDraft;
  result: PathAdvisorGovernedResultState;
  selectedEntity?: PathAdvisorConversationEntityContext | null;
  intelligence?: UnifiedCareerResumeIntelligenceState | null;
  routeContext?: PathAdvisorRouteConversationContext | null;
  carryForwardContext?: PathAdvisorConversationCarryForwardContext | null;
}

export interface PathAdvisorRouteConversationContextSection {
  title: string | null;
  lines: string[];
  bullets: string[];
  meta?: Record<string, string>;
}

export interface PathAdvisorRouteConversationContextEntry {
  title: string;
  subtitle: string | null;
  sections: PathAdvisorRouteConversationContextSection[];
}

export interface PathAdvisorRouteConversationContext {
  screenId: string;
  activeAnchor: {
    anchorType: 'job' | 'resume' | 'card' | 'screen' | 'other';
    anchorId: string;
    anchorLabel: string;
  };
  targetScope?: PathAdvisorConversationTargetScope;
  recentEntries: PathAdvisorRouteConversationContextEntry[];
}

export interface BuildPathAdvisorRouteContextOptions {
  allowActiveAnchorFallback?: boolean;
}

const TARGET_SCOPE_GENERIC_LABELS = new Set([
  'this job',
  'this role',
  'this position',
  'this posting',
  'the current job',
  'the current role',
  'the current position',
]);

const TARGET_SCOPE_FAMILY_PATTERNS: Array<{
  tag: string;
  patterns: string[];
}> = [
  {
    tag: 'law_enforcement',
    patterns: [
      'law enforcement',
      'criminal investigator',
      'special agent',
      'police',
      'border patrol',
      'marshal',
      'sheriff',
      'correctional officer',
      'corrections officer',
    ],
  },
  {
    tag: 'analysis',
    patterns: ['analyst', 'analysis', 'intelligence', 'program analysis'],
  },
  {
    tag: 'information_technology',
    patterns: ['it specialist', 'information technology', 'cyber', 'software', 'devops'],
  },
  {
    tag: 'human_resources',
    patterns: ['human resources', 'hr specialist', 'personnel'],
  },
  {
    tag: 'financial',
    patterns: ['budget', 'accounting', 'accountant', 'financial'],
  },
  {
    tag: 'engineering',
    patterns: ['engineer', 'engineering'],
  },
  {
    tag: 'contracting',
    patterns: ['contract specialist', 'contracting officer', 'contracting'],
  },
];

const TARGET_SCOPE_SERIES_FAMILY_TAGS: Record<string, string[]> = {
  '0132': ['analysis'],
  '0201': ['human_resources'],
  '0212': ['human_resources'],
  '0301': ['administration'],
  '0343': ['analysis'],
  '0510': ['financial'],
  '0560': ['financial'],
  '0801': ['engineering'],
  '0830': ['engineering'],
  '0855': ['engineering'],
  '1101': ['analysis'],
  '1102': ['contracting', 'analysis'],
  '1550': ['information_technology'],
  '1811': ['law_enforcement'],
  '2210': ['information_technology'],
  '2220': ['information_technology'],
};

function clampStringList(values: string[] | undefined, maxItems: number): string[] {
  if (values === undefined || values.length === 0) {
    return [];
  }

  const output: string[] = [];
  for (let i = 0; i < values.length && output.length < maxItems; i++) {
    if (values[i].trim() !== '') {
      output.push(values[i]);
    }
  }
  return output;
}

function summarizeRouteContextEntry(
  entry: PathAdvisorContextEntry
): PathAdvisorRouteConversationContextEntry {
  const sections: PathAdvisorRouteConversationContextSection[] = [];

  for (let i = 0; i < entry.sections.length && sections.length < 6; i++) {
    const section = entry.sections[i];
    const lines = clampStringList(section.lines, 4);
    const bullets = clampStringList(section.bullets, 4);

    if (lines.length === 0 && bullets.length === 0) {
      continue;
    }

    const summarizedSection: PathAdvisorRouteConversationContextSection = {
      title:
        section.title !== undefined && section.title.trim() !== ''
          ? section.title
          : null,
      lines: lines,
      bullets: bullets,
    };
    if (section.meta !== undefined) {
      summarizedSection.meta = section.meta;
    }
    sections.push(summarizedSection);
  }

  return {
    title: entry.title,
    subtitle:
      entry.subtitle !== undefined && entry.subtitle.trim() !== ''
        ? entry.subtitle
        : null,
    sections: sections,
  };
}

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function extractSeriesCode(rawLabel: string): string | null {
  const match = rawLabel.match(/(?:^|[^0-9])(\d{4})(?:[^0-9]|$)/);
  return match !== null && match[1] !== undefined ? match[1] : null;
}

function extractGrade(rawLabel: string): string | null {
  const match = rawLabel.match(/\bGS[\s-]?(\d{1,2})\b/i);
  if (match === null || match[1] === undefined) {
    return null;
  }

  return 'GS-' + match[1];
}

function normalizeTargetTitle(rawLabel: string): string | null {
  let normalized = rawLabel.toLowerCase().trim();
  normalized = normalized.replace(/\bgs[\s-]?\d{1,2}\b/gi, ' ');
  normalized = normalized.replace(/\bseries\s+\d{4}\b/gi, ' ');
  normalized = normalized.replace(/\(\s*\d{4}\s*\)/g, ' ');
  normalized = normalized.replace(/\b\d{4}\b/g, ' ');
  normalized = normalized.replace(/[^a-z0-9/&+\s-]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(
    /\b(job|jobs|role|roles|position|positions|career|careers)\b$/i,
    ''
  );
  normalized = normalized.replace(/\s+/g, ' ').trim();

  if (normalized === '' || TARGET_SCOPE_GENERIC_LABELS.has(normalized)) {
    return null;
  }

  return normalized
    .split(' ')
    .map(function (token) {
      return token.length > 0 ? token[0].toUpperCase() + token.slice(1) : token;
    })
    .join(' ');
}

function buildFamilyTags(
  rawLabel: string,
  normalizedTitle: string | null,
  seriesCode: string | null
): string[] {
  const normalizedHaystack = [rawLabel.toLowerCase(), normalizedTitle?.toLowerCase() ?? ''].join(' ');
  const tags: string[] = [];

  if (seriesCode !== null) {
    const seriesTags = TARGET_SCOPE_SERIES_FAMILY_TAGS[seriesCode];
    if (seriesTags !== undefined) {
      for (let i = 0; i < seriesTags.length; i++) {
        if (tags.indexOf(seriesTags[i]) === -1) {
          tags.push(seriesTags[i]);
        }
      }
    }
  }

  for (let i = 0; i < TARGET_SCOPE_FAMILY_PATTERNS.length; i++) {
    const familyRule = TARGET_SCOPE_FAMILY_PATTERNS[i];
    for (let j = 0; j < familyRule.patterns.length; j++) {
      if (normalizedHaystack.indexOf(familyRule.patterns[j]) !== -1) {
        if (tags.indexOf(familyRule.tag) === -1) {
          tags.push(familyRule.tag);
        }
        break;
      }
    }
  }

  return tags;
}

function buildTargetScope(
  rawLabel: string | null | undefined,
  sourceKind: PathAdvisorConversationTargetScope['sourceKind']
): PathAdvisorConversationTargetScope | undefined {
  const resolvedRawLabel = trimToNull(rawLabel);
  if (resolvedRawLabel === null) {
    return undefined;
  }

  const normalizedTitle = normalizeTargetTitle(resolvedRawLabel);
  const seriesCode = extractSeriesCode(resolvedRawLabel);
  const grade = extractGrade(resolvedRawLabel);

  if (normalizedTitle === null && seriesCode === null) {
    return undefined;
  }

  return {
    sourceKind: sourceKind,
    rawLabel: resolvedRawLabel,
    normalizedTitle: normalizedTitle,
    seriesCode: seriesCode,
    grade: grade,
    familyTags: buildFamilyTags(resolvedRawLabel, normalizedTitle, seriesCode),
  };
}

function buildCurrentTargetScope(
  draft: PathAdvisorGovernedDraft,
  intelligence: UnifiedCareerResumeIntelligenceState | null | undefined
): PathAdvisorConversationTargetScope | undefined {
  if (intelligence !== undefined && intelligence !== null) {
    if (intelligence.careerReadiness !== null) {
      const careerScope = buildTargetScope(
        intelligence.careerReadiness.target_role,
        'career_readiness'
      );
      if (careerScope !== undefined) {
        return careerScope;
      }
    }

    if (intelligence.resumeReadiness !== null) {
      const resumeScope = buildTargetScope(
        intelligence.resumeReadiness.target_role,
        'resume_readiness'
      );
      if (resumeScope !== undefined) {
        return resumeScope;
      }
    }

    if (intelligence.workspaceResume !== null) {
      const workspaceScope = buildTargetScope(
        intelligence.workspaceResume.targetRoleTitle,
        'workspace_resume'
      );
      if (workspaceScope !== undefined) {
        return workspaceScope;
      }
    }
  }

  return buildTargetScope(draft.qualification.targetRoles, 'qualification_draft');
}

export function buildPathAdvisorRouteContext(
  screenId: string,
  entriesByAnchor: Record<string, PathAdvisorContextEntry[]>,
  activeAnchorKey: string | undefined,
  options?: BuildPathAdvisorRouteContextOptions
): PathAdvisorRouteConversationContext | undefined {
  let anchorKeys = getAnchorKeysForScreen(entriesByAnchor, screenId);
  let resolvedScreenId = screenId;

  if (anchorKeys.length === 0) {
    const allowActiveAnchorFallback =
      options !== undefined && options.allowActiveAnchorFallback === true;

    if (
      !allowActiveAnchorFallback ||
      activeAnchorKey === undefined ||
      entriesByAnchor[activeAnchorKey] === undefined
    ) {
      return undefined;
    }

    const activeEntries = getEntriesForAnchor(entriesByAnchor, activeAnchorKey);
    if (activeEntries.length === 0) {
      return undefined;
    }

    anchorKeys = [activeAnchorKey];
    resolvedScreenId = activeEntries[0].screen;
  }

  const resolvedActiveAnchorKey =
    activeAnchorKey !== undefined &&
    activeAnchorKey.indexOf(resolvedScreenId + ':') === 0
      ? activeAnchorKey
      : anchorKeys[0];
  const entries = getEntriesForAnchor(entriesByAnchor, resolvedActiveAnchorKey);

  if (entries.length === 0) {
    return undefined;
  }

  const anchor = entries[0].anchor;
  const recentEntries: PathAdvisorRouteConversationContextEntry[] = [];
  const startIndex = entries.length > 3 ? entries.length - 3 : 0;

  for (let i = startIndex; i < entries.length; i++) {
    recentEntries.push(summarizeRouteContextEntry(entries[i]));
  }

  const targetScope =
    anchor.type === 'job'
      ? buildTargetScope(anchor.label, 'route_anchor')
      : undefined;
  const routeContext: PathAdvisorRouteConversationContext = {
    screenId: resolvedScreenId,
    activeAnchor: {
      anchorType: anchor.type,
      anchorId: anchor.id,
      anchorLabel: anchor.label,
    },
    recentEntries: recentEntries,
  };

  if (targetScope !== undefined) {
    routeContext.targetScope = targetScope;
  }

  return routeContext;
}

function copyScoreMap(values: Record<string, number>): Record<string, number> {
  const copied: Record<string, number> = {};
  const keys = Object.keys(values);

  for (let i = 0; i < keys.length; i++) {
    copied[keys[i]] = values[keys[i]];
  }

  return copied;
}

function buildPathAdvisorIntelligenceContext(
  intelligence: UnifiedCareerResumeIntelligenceState
): PathAdvisorIntelligenceContext {
  return {
    source: intelligence.source,
    workspaceResume:
      intelligence.workspaceResume === null
        ? null
        : {
            id: intelligence.workspaceResume.id,
            name: intelligence.workspaceResume.name,
            mode: intelligence.workspaceResume.mode,
            updatedAt: intelligence.workspaceResume.updatedAt,
            targetRoleTitle: intelligence.workspaceResume.targetRoleTitle,
          },
    careerReadiness:
      intelligence.careerReadiness === null
        ? null
        : {
            snapshotId: intelligence.careerReadiness.meta.snapshot_id,
            generatedAt: intelligence.careerReadiness.meta.generated_at,
            overallScore: intelligence.careerReadiness.overall_score,
            label: intelligence.careerReadiness.label,
            targetRole: intelligence.careerReadiness.target_role,
            spokes: copyScoreMap(intelligence.careerReadiness.spokes),
            topGaps: intelligence.careerReadiness.top_gaps.map(function (item) {
              return item.title;
            }),
            nextActions: intelligence.careerReadiness.action_plan.map(function (item) {
              return item.title;
            }),
            missingEvidence: intelligence.careerReadiness.missing_evidence.map(function (item) {
              return item.label;
            }),
          },
    resumeReadiness:
      intelligence.resumeReadiness === null
        ? null
        : {
            snapshotId: intelligence.resumeReadiness.meta.snapshot_id,
            generatedAt: intelligence.resumeReadiness.meta.generated_at,
            overallScore: intelligence.resumeReadiness.overall_score,
            targetRole: intelligence.resumeReadiness.target_role,
            categories: copyScoreMap(intelligence.resumeReadiness.categories),
            suggestions: intelligence.resumeReadiness.suggestions.map(function (item) {
              return item.title;
            }),
            missingEvidence: intelligence.resumeReadiness.missing_evidence.map(function (item) {
              return item.label;
            }),
          },
    applicationConfidence: null,
  };
}

function parseMetaNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function parseMetaStringList(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const output: string[] = [];
    for (let i = 0; i < parsed.length; i++) {
      if (typeof parsed[i] === 'string' && parsed[i].trim() !== '') {
        output.push(parsed[i].trim());
      }
    }
    return output;
  } catch {
    return [];
  }
}

function buildApplicationConfidenceContext(
  routeContext: PathAdvisorRouteConversationContext | undefined
): PathAdvisorApplicationConfidenceContext | null {
  if (routeContext === undefined) {
    return null;
  }

  for (let entryIndex = routeContext.recentEntries.length - 1; entryIndex >= 0; entryIndex--) {
    const entry = routeContext.recentEntries[entryIndex];
    for (let sectionIndex = 0; sectionIndex < entry.sections.length; sectionIndex++) {
      const section = entry.sections[sectionIndex];
      const meta = section.meta;
      if (
        meta === undefined ||
        meta.pathadvisor_context_kind !== 'application_confidence'
      ) {
        continue;
      }

      const overallScore = parseMetaNumber(meta.overall_score);
      const targetRole = trimToNull(meta.target_role);
      const jobId = trimToNull(meta.job_id);
      const jobTitle = trimToNull(meta.job_title);
      if (
        overallScore === null ||
        targetRole === null ||
        jobId === null ||
        jobTitle === null
      ) {
        continue;
      }

      return {
        source:
          meta.source === 'fallback' ||
          meta.source === 'partial_live' ||
          meta.source === 'live'
            ? meta.source
            : 'live',
        screenId: routeContext.screenId,
        jobId: jobId,
        jobTitle: jobTitle,
        targetRole: targetRole,
        overallScore: overallScore,
        recommendation: trimToNull(meta.recommendation) ?? 'consider',
        decisionBand:
          trimToNull(meta.decision_band) ??
          trimToNull(meta.recommendation) ??
          'consider',
        confidenceBand: trimToNull(meta.confidence_band) ?? 'medium',
        rationaleSummary:
          trimToNull(meta.rationale_summary) ??
          'The current selected-job application evaluation is available.',
        priorityLevel: trimToNull(meta.priority_level),
        alertImportance: trimToNull(meta.alert_importance),
        blockingIssues: parseMetaStringList(meta.blocking_issues),
        missingEvidence: parseMetaStringList(meta.missing_evidence),
        nextActions: parseMetaStringList(meta.next_actions),
        decisionVersion: trimToNull(meta.decision_version),
      };
    }
  }

  return null;
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
      : args.routeContext !== undefined &&
          args.routeContext !== null &&
          args.routeContext.activeAnchor.anchorType === 'job'
        ? {
            entityType: 'job',
            entityId: args.routeContext.activeAnchor.anchorId,
            entityLabel: args.routeContext.activeAnchor.anchorLabel,
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
      grounding: {
        domain: args.result.response.grounding.domain,
        responseState: args.result.response.grounding.responseState,
        grounded: args.result.response.grounding.grounded,
        partial: args.result.response.grounding.partial,
        missingInputs: args.result.response.grounding.missingInputs.map(function (item) {
          return item;
        }),
        packId: args.result.response.grounding.packId,
        packKey: args.result.response.grounding.packKey,
        versionId: args.result.response.grounding.versionId,
        version: args.result.response.grounding.version,
        freshnessState: args.result.response.grounding.freshnessState,
        freshnessReason: args.result.response.grounding.freshnessReason,
        servingEligible: args.result.response.grounding.servingEligible,
        conversationProvider: args.result.response.grounding.conversationProvider,
        providerUsed: args.result.response.grounding.providerUsed,
        entryPlanning: args.result.response.grounding.entryPlanning ?? null,
      },
    };
  }

  const routeContext: PathAdvisorRouteConversationContext | undefined =
    args.routeContext !== undefined && args.routeContext !== null
      ? {
          screenId: args.routeContext.screenId,
          activeAnchor: {
            anchorType: args.routeContext.activeAnchor.anchorType,
            anchorId: args.routeContext.activeAnchor.anchorId,
            anchorLabel: args.routeContext.activeAnchor.anchorLabel,
          },
          recentEntries: args.routeContext.recentEntries.map(function (entry) {
            return {
              title: entry.title,
              subtitle: entry.subtitle,
              sections: entry.sections.map(function (section) {
                const sectionContext: PathAdvisorRouteConversationContextSection = {
                  title: section.title,
                  lines: section.lines.map(function (item) {
                    return item;
                  }),
                  bullets: section.bullets.map(function (item) {
                    return item;
                  }),
                };
                if (section.meta !== undefined) {
                  sectionContext.meta = section.meta;
                }
                return sectionContext;
              }),
            };
          }),
        }
      : undefined;

  if (
    routeContext !== undefined &&
    args.routeContext !== undefined &&
    args.routeContext !== null &&
    args.routeContext.targetScope !== undefined
  ) {
    routeContext.targetScope = args.routeContext.targetScope;
  }

  const applicationConfidenceContext = buildApplicationConfidenceContext(
    routeContext
  );
  let intelligenceContext: PathAdvisorIntelligenceContext | undefined;
  if (args.intelligence !== undefined && args.intelligence !== null) {
    intelligenceContext = buildPathAdvisorIntelligenceContext(args.intelligence);
  } else if (applicationConfidenceContext !== null) {
    intelligenceContext = {
      source: applicationConfidenceContext.source,
      workspaceResume: null,
      careerReadiness: null,
      resumeReadiness: null,
      applicationConfidence: applicationConfidenceContext,
    };
  }

  if (
    intelligenceContext !== undefined &&
    applicationConfidenceContext !== null
  ) {
    intelligenceContext.applicationConfidence = applicationConfidenceContext;
  }

  return {
    currentView: args.currentView,
    requestDomain:
      args.result.response !== null ? args.result.response.domain : args.draft.domain,
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
    intelligenceContext: intelligenceContext,
    carryForwardContext:
      args.carryForwardContext !== undefined && args.carryForwardContext !== null
        ? {
            sourceKind: args.carryForwardContext.sourceKind,
            transformKind: args.carryForwardContext.transformKind,
            baseUserMessage: args.carryForwardContext.baseUserMessage,
            priorUserMessage: args.carryForwardContext.priorUserMessage,
            originalUserMessage: args.carryForwardContext.originalUserMessage,
            effectiveUserMessage: args.carryForwardContext.effectiveUserMessage,
            modifiers: args.carryForwardContext.modifiers.map(function (item) {
              return {
                kind: item.kind,
                value: item.value,
              };
            }),
            modifierChanges: args.carryForwardContext.modifierChanges.map(function (item) {
              return {
                kind: item.kind,
                operation: item.operation,
                value: item.value,
                previousValue: item.previousValue,
              };
            }),
          }
        : undefined,
    currentTargetScope: buildCurrentTargetScope(args.draft, args.intelligence),
    routeContext: routeContext,
    /**
     * Safe default:
     * The centered dashboard conversation flow does not synthesize
     * conversation-hint lists from raw drafts. If a future surface has
     * authoritative hint lists, it can provide them explicitly.
     */
    selectedEntity: selectedEntity,
    governedResponse: governedResponse,
  };
}

export function buildPathAdvisorEntryContext(
  args: BuildPathAdvisorConversationContextArgs
): PathAdvisorEntryContext {
  const conversationContext = buildPathAdvisorConversationContext(args);
  return {
    intelligenceContext:
      conversationContext.intelligenceContext !== undefined
      ? conversationContext.intelligenceContext
      : null,
    currentTargetLabel:
      conversationContext.currentTargetScope !== undefined
        ? conversationContext.currentTargetScope.rawLabel
        : null,
    routeTargetLabel:
      conversationContext.routeContext !== undefined &&
      conversationContext.routeContext.targetScope !== undefined
        ? conversationContext.routeContext.targetScope.rawLabel
        : null,
    routeAnchorLabel:
      conversationContext.routeContext !== undefined
        ? conversationContext.routeContext.activeAnchor.anchorLabel
        : null,
    routeScreenId:
      conversationContext.routeContext !== undefined
        ? conversationContext.routeContext.screenId
        : null,
  };
}
