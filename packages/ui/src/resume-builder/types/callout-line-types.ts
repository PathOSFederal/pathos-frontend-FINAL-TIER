/**
 * ============================================================================
 * CALLOUT LINE TYPES — Precision overlay line model for resume annotations
 * ============================================================================
 *
 * PURPOSE: Defines the data model for callout lines that visually connect
 * specific content INSIDE the resume document to endpoint circles OUTSIDE
 * the document boundary. These lines form a precision UX overlay — not a
 * diagram system, but a real product annotation layer.
 *
 * DESIGN RULES:
 *   1. Lines START from a real content point inside the resume document.
 *   2. Lines EXTEND outward across the document boundary.
 *   3. Lines END outside the document in a small white-filled circle.
 *   4. The circle is always the final endpoint — no floating circles,
 *      no lines ending inside the document, no lines past the circle.
 *
 * VISIBILITY MODEL:
 *   Callout lines appear only when context justifies them:
 *     - A section is selected in the canvas
 *     - The builder stage is 'tailoring' (target job active)
 *   Lines are NOT always-on clutter — they are focused, contextual overlays.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Callout line anchor — a point inside the resume that a line originates from
// ---------------------------------------------------------------------------

/**
 * Identifies a specific content region inside the resume document that
 * serves as the origin point for a callout line. The anchor is resolved
 * to a DOM element at render time using data-callout-anchor attributes.
 *
 *   anchorId:   unique key matching a data-callout-anchor attribute on
 *               a DOM element inside the resume document panel.
 *   sectionId:  which resume section owns this anchor (for filtering).
 *   label:      human-readable label describing what content this points at.
 */
export interface CalloutLineAnchor {
  /** Unique anchor identifier. Matches data-callout-anchor on the DOM element. */
  anchorId: string;

  /** Which resume section owns this anchor. Used to filter lines to
   *  the currently selected section only. */
  sectionId: string;

  /** Human-readable label for what this anchor points at. Used for
   *  accessible descriptions of the endpoint circle. */
  label: string;

  /** The annotation class this callout relates to. Drives the line color.
   *    evidence:    amber / warning tones
   *    alignment:   red / danger tones
   *    compression: blue / accent tones */
  annotationClass: 'evidence' | 'alignment' | 'compression';
}

// ---------------------------------------------------------------------------
// Callout line definition — the full spec for one callout line
// ---------------------------------------------------------------------------

/**
 * Full definition for a single callout line in the overlay. Combines
 * the anchor (source inside resume) with guidance metadata (what the
 * callout communicates).
 *
 * The endpoint position is computed at render time from the anchor's
 * DOM position relative to the document panel. The endpoint circle
 * always renders to the RIGHT of the document, outside its boundary.
 */
export interface CalloutLineDef {
  /** Unique ID for this callout line. Used as React key and for
   *  highlight state tracking. */
  id: string;

  /** The anchor inside the resume document where the line starts. */
  anchor: CalloutLineAnchor;

  /** Short guidance headline displayed near the endpoint circle on hover. */
  headline: string;

  /** Brief guidance description (1-2 sentences). Shown in tooltip or
   *  connected callout card when the endpoint is active. */
  description: string;

  /** Severity level for priority ordering and visual emphasis.
   *  high = always show first, medium = show if space allows, low = show last. */
  severity: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Callout line computed geometry — resolved positions for SVG rendering
// ---------------------------------------------------------------------------

/**
 * Resolved pixel geometry for one callout line, computed from DOM
 * measurements at render time. The overlay component uses these
 * coordinates to draw the SVG path and position the endpoint circle.
 *
 * Coordinate system: relative to the overlay SVG viewport, which
 * is absolutely positioned over the entire canvas + margin area.
 *
 *   sourceX/sourceY:  point on the right edge of the anchor element
 *   endpointX/endpointY: center of the white endpoint circle, placed
 *                         outside the document panel's right boundary
 */
export interface CalloutLineGeometry {
  /** Which callout line this geometry belongs to. */
  lineId: string;

  /** X coordinate of the line source (edge of anchor element nearest the chosen side). */
  sourceX: number;

  /** Y coordinate of the line source (vertical center of anchor element). */
  sourceY: number;

  /** X coordinate of the endpoint circle center (outside document). */
  endpointX: number;

  /** Y coordinate of the endpoint circle center (aligned with source). */
  endpointY: number;

  /** Whether the geometry was successfully resolved. False if the
   *  anchor DOM element was not found or not measured. */
  resolved: boolean;

  /** Which side of the document the line routes to. Side-aware routing
   *  picks the nearest clean edge so lines do not cross the resume body.
   *   'right' = endpoint is to the right of the document (default)
   *   'left'  = endpoint is to the left of the document */
  side: 'left' | 'right';
}

// ---------------------------------------------------------------------------
// Callout line visual state — hover, focus, and active tracking
// ---------------------------------------------------------------------------

/**
 * Visual interaction state for a single callout line. Used by the
 * overlay component to apply subtle highlight effects.
 *
 * Only one line can be highlighted at a time. Highlighting happens when:
 *   - The user hovers the endpoint circle → line + source highlight
 *   - The user hovers the source element → line + endpoint highlight
 *   - The user focuses the endpoint via keyboard → same as hover
 */
export interface CalloutLineState {
  /** Which callout line this state belongs to. */
  lineId: string;

  /** Whether the source anchor element is currently hovered. */
  sourceHovered: boolean;

  /** Whether the endpoint circle is currently hovered or focused. */
  endpointHovered: boolean;

  /** Whether this line is the currently highlighted / active one.
   *  True when either source or endpoint is hovered/focused, OR
   *  when the line's endpoint was clicked to activate its guidance card. */
  isHighlighted: boolean;

  /** Whether this line's endpoint was clicked to open its guidance card.
   *  Active state persists until another endpoint is clicked or the
   *  section changes. Stronger visual treatment than hover alone. */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Callout line overlay config — controls visibility behavior
// ---------------------------------------------------------------------------

/**
 * Configuration for when and how callout lines appear. Passed to the
 * overlay component to control the visibility rule.
 */
export interface CalloutLineOverlayConfig {
  /** Whether the callout line overlay is enabled at all. When false,
   *  no lines are rendered regardless of other state. */
  enabled: boolean;

  /** Maximum number of callout lines to show simultaneously. Prevents
   *  the overlay from becoming visually noisy. Default: 4. */
  maxLines: number;

  /** Whether to show lines only for the selected section. When true
   *  (the default), only lines whose anchor belongs to the currently
   *  selected section are rendered. */
  filterToSelectedSection: boolean;
}

/**
 * Build the default overlay config. Lines are enabled, filtered to
 * the selected section, and limited to 4 visible at a time.
 */
export function buildDefaultCalloutLineConfig(): CalloutLineOverlayConfig {
  return {
    enabled: true,
    maxLines: 4,
    filterToSelectedSection: true,
  };
}
