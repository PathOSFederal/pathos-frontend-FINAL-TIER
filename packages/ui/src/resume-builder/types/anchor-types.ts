/**
 * ============================================================================
 * ANNOTATION ANCHOR TYPES — Stable anchor model for resume callout regions
 * ============================================================================
 *
 * PURPOSE: Defines the typed model for all callout-capable regions on the
 * resume document canvas. Each anchor represents a DOM region that can
 * receive annotations, callout cards, or connector lines from the guidance
 * layer.
 *
 * DESIGN: Anchors are data-driven. Instead of ad-hoc UI conditionals that
 * decide where callouts appear, the anchor map provides a declarative
 * registry of all possible callout attachment points. The callout layer
 * reads from this map to render guidance for the selected section only.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import type React from 'react';

// ---------------------------------------------------------------------------
// Anchor kind — classifies the type of resume region an anchor represents
// ---------------------------------------------------------------------------

/**
 * Classification of an anchor's structural role in the resume document.
 * This determines how callouts attach visually and what annotation types
 * are allowed.
 *
 *   section:          Top-level section (e.g., "Work Experience" header)
 *   experience-entry: A single work experience block
 *   bullet:           An individual experience bullet point
 *   summary-block:    The professional summary paragraph
 *   header-field:     A field in the contact/header area (name, email, etc.)
 *   federal-field:    A federal-specific detail field
 *   education-entry:  A single education entry
 *   skill-item:       A skill tag or entry
 *   certification:    A certification entry
 */
export type AnchorKind =
  | 'section'
  | 'experience-entry'
  | 'bullet'
  | 'summary-block'
  | 'header-field'
  | 'federal-field'
  | 'education-entry'
  | 'skill-item'
  | 'certification';

// ---------------------------------------------------------------------------
// Annotation type — the kinds of annotations an anchor can receive
// ---------------------------------------------------------------------------

/**
 * The three tailoring annotation classes. These are the ONLY annotation
 * types the system uses — no generic badges or ad-hoc alert classes.
 *
 *   evidence:     The content needs stronger evidence, metrics, or
 *                 quantified outcomes to satisfy federal requirements.
 *
 *   alignment:    The content does not align with the target job
 *                 requirements — keywords, responsibilities, or
 *                 specialized experience are missing.
 *
 *   compression:  The content is too long, too low-priority, or
 *                 needs tightening to fit the 2-page federal limit.
 */
export type AnnotationType = 'evidence' | 'alignment' | 'compression';

// ---------------------------------------------------------------------------
// Section ID — which resume section owns the anchor
// ---------------------------------------------------------------------------

/**
 * Resume section identifiers. These match the section IDs used throughout
 * the Resume Builder. Each anchor belongs to exactly one owning section
 * so callouts can be filtered to the selected section.
 *
 * The set here includes all USAJOBS-informed federal resume sections.
 * Sections marked as not yet UI-supported in the federal-section-meta
 * registry are included for type-safety and future-readiness — they
 * allow the canonical callout registry and anchor map to reference
 * them without breaking when the UI adds support.
 */
export type AnchorSectionId =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'training'
  | 'language-skills'
  | 'publications'
  | 'federal-details'
  | 'supporting-evidence';

// ---------------------------------------------------------------------------
// Anchor definition — a single callout-capable region on the resume
// ---------------------------------------------------------------------------

/**
 * Full definition of a callout anchor point on the resume canvas.
 *
 * The anchor model supports:
 *   - Unique identification for lookup and keying
 *   - Structural classification via kind
 *   - Section ownership for scoped callout filtering
 *   - DOM ref for position calculation (connector lines)
 *   - Allowed annotation types for validation
 *   - Priority ordering for when multiple callouts compete
 *   - Selection/visibility state for UI rendering
 */
export interface AnchorDef {
  /** Unique identifier for this anchor. Format: "{sectionId}-{kind}-{index}"
   *  Examples: "experience-bullet-exp-1-b2", "summary-summary-block-0" */
  id: string;

  /** What kind of resume region this anchor represents. */
  kind: AnchorKind;

  /** Which resume section owns this anchor. Used to scope callouts
   *  to the selected section only. */
  owningSection: AnchorSectionId;

  /** React ref to the DOM element this anchor is attached to.
   *  Used for position calculation when drawing connector lines. */
  domRef: React.RefObject<HTMLElement | null>;

  /** Which annotation types are allowed on this anchor. Not every
   *  region supports every annotation class. For example, header-field
   *  anchors typically only allow 'alignment', not 'compression'. */
  allowedAnnotations: AnnotationType[];

  /** Priority for callout display ordering. Lower numbers = higher
   *  priority. When multiple callouts compete for screen space,
   *  higher-priority anchors are shown first. */
  priority: number;

  /** Whether this anchor's section is currently selected by the user.
   *  Only anchors in the selected section show callouts by default. */
  isSelected: boolean;

  /** Whether the callout for this anchor is currently visible.
   *  Even within the selected section, only the top 1-2 callouts
   *  are shown to avoid visual noise. */
  isVisible: boolean;
}

// ---------------------------------------------------------------------------
// Anchor map — the complete registry of all anchors on the canvas
// ---------------------------------------------------------------------------

/**
 * A map of all registered anchors on the live resume canvas.
 * Keyed by anchor ID for O(1) lookup. The callout layer reads this
 * map to determine which callouts to render and where to position them.
 */
export type AnchorMap = Record<string, AnchorDef>;

// ---------------------------------------------------------------------------
// Anchor registration — used by the useAnchorMap hook
// ---------------------------------------------------------------------------

/**
 * Minimal anchor registration data. Components call the registration
 * function with this data; the hook fills in domRef and computed state.
 */
export interface AnchorRegistration {
  /** Unique anchor ID. */
  id: string;

  /** Anchor kind. */
  kind: AnchorKind;

  /** Owning section. */
  owningSection: AnchorSectionId;

  /** Allowed annotation types. */
  allowedAnnotations: AnnotationType[];

  /** Display priority (lower = higher priority). */
  priority: number;
}

// ---------------------------------------------------------------------------
// Callout data — what to show on a callout card attached to an anchor
// ---------------------------------------------------------------------------

/**
 * Data for a single callout card displayed near an anchor point.
 * The callout layer uses this to render PathOS callout cards with
 * connector lines to the corresponding resume region.
 */
export interface CalloutData {
  /** ID of the anchor this callout is attached to. */
  anchorId: string;

  /** The annotation class driving this callout. */
  annotationType: AnnotationType;

  /** Short headline for the callout card. */
  headline: string;

  /** Brief explanation (1-2 sentences). */
  description: string;

  /** Priority for display ordering. Inherited from the anchor. */
  priority: number;

  /** Whether this callout is currently being shown. The system shows
   *  only the top 1-2 callouts for the selected section. */
  isActive: boolean;
}
