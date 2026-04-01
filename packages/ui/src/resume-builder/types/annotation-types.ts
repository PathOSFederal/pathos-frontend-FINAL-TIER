/**
 * ============================================================================
 * TAILORING ANNOTATION TYPES — evidence / alignment / compression model
 * ============================================================================
 *
 * PURPOSE: Defines the deterministic tailoring annotation system with
 * exactly 3 annotation classes. These annotations live on or next to
 * relevant resume document regions and provide structured, non-generic
 * guidance for federal resume improvement.
 *
 * DESIGN CONSTRAINT: The annotation system uses ONLY these 3 classes:
 *   1. evidence    — needs stronger proof, metrics, quantified outcomes
 *   2. alignment   — does not match target job requirements
 *   3. compression — too long, low priority, needs tightening
 *
 * No other annotation classes are permitted. This prevents the system
 * from devolving into generic alert badges everywhere.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Annotation class — the ONLY 3 classes allowed
// ---------------------------------------------------------------------------

/**
 * The three tailoring annotation classes used throughout the resume builder.
 * This type is the single source of truth for annotation classification.
 *
 *   evidence:     Content needs stronger proof. Examples: missing metrics,
 *                 weak evidence, unquantified claims, vague scope.
 *
 *   alignment:    Content does not align with target job. Examples:
 *                 requirement gap, missing keyword, skills mismatch.
 *
 *   compression:  Content needs tightening for page budget. Examples:
 *                 too long, low priority bullet, redundant phrasing.
 */
export type TailoringAnnotationClass = 'evidence' | 'alignment' | 'compression';

// ---------------------------------------------------------------------------
// Annotation sub-type — specific reason within each class
// ---------------------------------------------------------------------------

/**
 * Evidence sub-types: specific reasons content needs stronger proof.
 */
export type EvidenceSubType =
  | 'missing-metrics'
  | 'weak-evidence'
  | 'unquantified-claim'
  | 'vague-scope';

/**
 * Alignment sub-types: specific reasons content doesn't match the target.
 */
export type AlignmentSubType =
  | 'requirement-gap'
  | 'missing-keyword'
  | 'skills-mismatch'
  | 'experience-gap';

/**
 * Compression sub-types: specific reasons content needs tightening.
 */
export type CompressionSubType =
  | 'too-long'
  | 'low-priority'
  | 'redundant'
  | 'compress';

/**
 * Union of all sub-types for type-safe discrimination.
 */
export type AnnotationSubType = EvidenceSubType | AlignmentSubType | CompressionSubType;

// ---------------------------------------------------------------------------
// Tailoring annotation — a single annotation instance
// ---------------------------------------------------------------------------

/**
 * A single tailoring annotation attached to a resume region.
 * Each annotation belongs to exactly one of the 3 classes and
 * references a specific anchor point on the document.
 *
 * Annotations are deterministic and structured — they are computed
 * from resume content and target job requirements, not generated
 * by ad-hoc UI logic.
 */
export interface TailoringAnnotation {
  /** Unique identifier for this annotation. */
  id: string;

  /** Which of the 3 annotation classes this belongs to. */
  annotationClass: TailoringAnnotationClass;

  /** Specific sub-type within the class (for icon and label selection). */
  subType: AnnotationSubType;

  /** ID of the anchor this annotation is attached to. */
  anchorId: string;

  /** Short label for the annotation badge (e.g., "Missing metrics"). */
  label: string;

  /** Brief description explaining why this annotation was triggered. */
  description: string;

  /** How severe this annotation is. Higher severity annotations are
   *  shown with more prominent visual treatment. */
  severity: 'low' | 'medium' | 'high';

  /** Whether this annotation has been resolved by the user. */
  resolved: boolean;

  /** Optional suggested replacement text that can be applied to the
   *  document. When present, the guidance card shows "Apply" and
   *  "Edit First" actions that affect the document workflow directly
   *  instead of leaving the suggestion as passive advice. */
  suggestedText?: string;
}

// ---------------------------------------------------------------------------
// Annotation display config — visual treatment per class
// ---------------------------------------------------------------------------

/**
 * Visual configuration for each annotation class. Controls colors,
 * icons, and labels shown in the UI. Uses PathOS theme tokens.
 */
export interface AnnotationDisplayConfig {
  /** The annotation class this config applies to. */
  annotationClass: TailoringAnnotationClass;

  /** CSS color token for the annotation badge. */
  color: string;

  /** CSS background token for the annotation badge. */
  background: string;

  /** Human-readable label for the class. */
  classLabel: string;

  /** Short description of what this class means. */
  classDescription: string;
}

/**
 * Default visual configuration for the 3 annotation classes.
 * Uses PathOS theme tokens for consistency with the rest of the app.
 *
 * evidence:    amber/warning — content needs improvement but isn't wrong
 * alignment:   red/danger — content may cause screening rejection
 * compression: blue/info — content optimization for page budget
 */
export const ANNOTATION_DISPLAY_CONFIGS: Record<TailoringAnnotationClass, AnnotationDisplayConfig> = {
  evidence: {
    annotationClass: 'evidence',
    color: 'var(--p-warning, #eab308)',
    background: 'color-mix(in srgb, var(--p-warning, #eab308) 12%, transparent)',
    classLabel: 'Evidence',
    classDescription: 'Needs stronger proof, metrics, or quantified outcomes',
  },
  alignment: {
    annotationClass: 'alignment',
    color: 'var(--p-danger, #ef4444)',
    background: 'color-mix(in srgb, var(--p-danger, #ef4444) 12%, transparent)',
    classLabel: 'Alignment',
    classDescription: 'Does not match target job requirements',
  },
  compression: {
    annotationClass: 'compression',
    color: 'var(--p-accent)',
    background: 'color-mix(in srgb, var(--p-accent) 12%, transparent)',
    classLabel: 'Compression',
    classDescription: 'Needs tightening for page budget',
  },
};

// ---------------------------------------------------------------------------
// Annotation set — grouped annotations for a section
// ---------------------------------------------------------------------------

/**
 * All annotations for a single resume section. Used by the callout
 * layer to render section-scoped guidance.
 */
export interface SectionAnnotationSet {
  /** Which section these annotations belong to. */
  sectionId: string;

  /** All annotations for this section, sorted by severity descending. */
  annotations: TailoringAnnotation[];

  /** Count of unresolved annotations per class. */
  unresolvedCounts: Record<TailoringAnnotationClass, number>;

  /** Total unresolved annotation count. */
  totalUnresolved: number;
}

/**
 * Count unresolved annotations per class for a given annotation list.
 * Returns a record with counts for evidence, alignment, and compression.
 */
export function countUnresolvedByClass(
  annotations: TailoringAnnotation[]
): Record<TailoringAnnotationClass, number> {
  const counts: Record<TailoringAnnotationClass, number> = {
    evidence: 0,
    alignment: 0,
    compression: 0,
  };
  for (let i = 0; i < annotations.length; i++) {
    if (!annotations[i].resolved) {
      counts[annotations[i].annotationClass] = counts[annotations[i].annotationClass] + 1;
    }
  }
  return counts;
}

/**
 * Build a SectionAnnotationSet from a flat list of annotations
 * filtered to a specific section.
 */
export function buildSectionAnnotationSet(
  sectionId: string,
  annotations: TailoringAnnotation[]
): SectionAnnotationSet {
  /* Filter to this section's annotations */
  const sectionAnnotations: TailoringAnnotation[] = [];
  for (let i = 0; i < annotations.length; i++) {
    if (annotations[i].anchorId.startsWith(sectionId)) {
      sectionAnnotations.push(annotations[i]);
    }
  }

  /* Sort by severity: high first, then medium, then low.
   * Use explicit lookup to avoid the falsy-zero trap (0 || default === default). */
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  sectionAnnotations.sort(function (a, b) {
    const aOrder = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 2;
    const bOrder = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 2;
    return aOrder - bOrder;
  });

  const unresolvedCounts = countUnresolvedByClass(sectionAnnotations);

  let totalUnresolved = 0;
  totalUnresolved = totalUnresolved + unresolvedCounts.evidence;
  totalUnresolved = totalUnresolved + unresolvedCounts.alignment;
  totalUnresolved = totalUnresolved + unresolvedCounts.compression;

  return {
    sectionId: sectionId,
    annotations: sectionAnnotations,
    unresolvedCounts: unresolvedCounts,
    totalUnresolved: totalUnresolved,
  };
}
