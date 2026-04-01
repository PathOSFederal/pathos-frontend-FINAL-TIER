/**
 * ============================================================================
 * CALLOUT LINE OVERLAY — SVG precision overlay for resume-to-guidance lines
 * ============================================================================
 *
 * PURPOSE: Renders an SVG overlay layer containing precision callout lines
 * that visually connect specific content INSIDE the resume document to
 * small white-filled endpoint circles OUTSIDE the document boundary.
 *
 * DESIGN:
 *   - The overlay is absolutely positioned over the canvas + right margin area.
 *   - Each line is a thin path originating from a resume content anchor,
 *     extending rightward past the document edge, and terminating in a
 *     white-filled circle with a subtle border/shadow.
 *   - Only resolved lines (where the anchor DOM was found) are rendered.
 *   - Visual style is restrained and product-grade: thin gray lines,
 *     small circles, quiet color shifts on highlight.
 *
 * LINE PATH MODEL:
 *   Each line follows a gentle L-route:
 *     1. Horizontal segment from the source anchor's right edge
 *     2. Small curved elbow turn (or straight diagonal for minimal geometry)
 *     3. Horizontal segment to the endpoint circle center
 *   The path uses SVG <path> with a smooth cubic Bézier for the curve.
 *
 * INTERACTION:
 *   - Hovering an endpoint circle highlights the connected line and
 *     signals the parent to highlight the source anchor.
 *   - Endpoint circles are keyboard-focusable for accessibility.
 *   - Focus-visible shows the same highlight as hover.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState } from 'react';
import type {
  CalloutLineDef,
  CalloutLineGeometry,
  CalloutLineState,
} from '../types/callout-line-types';
import {
  completionBandColorAtIntensity,
  issueSeverityToCompletionBand,
} from '../utils/completion-colors';
import type { IssueSeverity } from '../utils/completion-colors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CalloutLineOverlayProps {
  /** Callout line definitions — the data model for what to draw. */
  lines: CalloutLineDef[];

  /** Resolved geometry for each line (computed by useCalloutLines). */
  geometries: CalloutLineGeometry[];

  /** Visual state per line (hover/focus/highlight). */
  lineStates: Record<string, CalloutLineState>;

  /** Callback when the user hovers/un-hovers an endpoint circle. */
  onEndpointHover: (lineId: string, hovered: boolean) => void;

  /** Callback when the user hovers/un-hovers a source anchor (via
   *  the line itself — the parent wires source hover separately). */
  onSourceHover?: (lineId: string, hovered: boolean) => void;

  /** Callback when the user clicks an endpoint circle. Optional —
   *  can be used to activate the callout card for this annotation. */
  onEndpointClick?: (lineId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants — visual styling
// ---------------------------------------------------------------------------

/** Default line stroke color: cool gray matching the theme's text-dim */
const LINE_COLOR_DEFAULT = 'var(--p-text-dim, #64748b)';

/** Highlighted line stroke color: slightly brighter, with accent influence */
const LINE_COLOR_HIGHLIGHT = 'var(--p-accent-text, #60a5fa)';

/** Default line opacity: subtle and non-intrusive */
const LINE_OPACITY_DEFAULT = 0.35;

/** Highlighted line opacity: prominent enough to track visually */
const LINE_OPACITY_HIGHLIGHT = 0.7;

/** Line stroke width in pixels */
const LINE_STROKE_WIDTH = 1.25;

/** Highlighted line stroke width — very slightly thicker */
const LINE_STROKE_WIDTH_HIGHLIGHT = 1.5;

/** Endpoint circle radius */
const ENDPOINT_RADIUS = 5;

/** Endpoint circle fill color: white for contrast against dark theme */
const ENDPOINT_FILL = '#ffffff';

/** Endpoint circle stroke (border) — subtle gray outline for definition */
const ENDPOINT_STROKE_DEFAULT = 'var(--p-text-dim, #64748b)';

/** Endpoint circle stroke when highlighted */
const ENDPOINT_STROKE_HIGHLIGHT = 'var(--p-accent, #2563eb)';

/** Endpoint stroke width */
const ENDPOINT_STROKE_WIDTH = 1.25;

/** Drop shadow filter ID for endpoint circles */
const ENDPOINT_SHADOW_FILTER_ID = 'callout-endpoint-shadow';

// ---------------------------------------------------------------------------
// Severity-to-color mapping for endpoint circles
// ---------------------------------------------------------------------------

/**
 * Get the severity-informed endpoint circle fill color. Uses the SHARED
 * issueSeverityToCompletionBand from completion-colors.ts — the same
 * mapping that guidance cards use — so endpoints and cards always agree.
 *
 * Uses 'subdued' intensity so the circles carry semantic color without
 * being overly flashy in the overlay layer.
 */
function getEndpointSeverityFill(severity: string): string {
  const band = issueSeverityToCompletionBand(severity as IssueSeverity);
  return completionBandColorAtIntensity(band, 'subdued');
}

/**
 * Get the severity-informed endpoint circle stroke color. Uses the SHARED
 * issueSeverityToCompletionBand at 'strong' intensity for the border so
 * the semantic meaning is clear and matches the guidance card accent.
 */
function getEndpointSeverityStroke(severity: string): string {
  const band = issueSeverityToCompletionBand(severity as IssueSeverity);
  return completionBandColorAtIntensity(band, 'strong');
}

// ---------------------------------------------------------------------------
// Path builder — constructs SVG path data for a callout line
// ---------------------------------------------------------------------------

/**
 * Build an SVG path string for a callout line from source to endpoint.
 * Uses a smooth cubic Bézier curve to create a gentle elbow route:
 *
 *   source ──── horizontal ──── gentle curve ──── horizontal ──── endpoint
 *
 * SIDE-AWARE: The path handles both right-side and left-side routing.
 * For right-side lines, the curve extends rightward from the source.
 * For left-side lines, the curve extends leftward. The control points
 * create the same organic S-curve shape regardless of direction.
 */
function buildLinePath(geo: CalloutLineGeometry): string {
  const sx = geo.sourceX;
  const sy = geo.sourceY;
  const ex = geo.endpointX;
  const ey = geo.endpointY;

  /* Horizontal midpoint for the curve's control points. Works for both
   * left-side (ex < sx) and right-side (ex > sx) routing because the
   * midpoint formula naturally adapts to the direction. */
  const midX = sx + (ex - sx) * 0.5;

  /* Bézier control points: create a gentle S-curve that transitions
   * smoothly from the source's Y to the endpoint's Y. The first
   * control point stays at source Y, the second at endpoint Y. */
  return (
    'M ' + sx + ' ' + sy +
    ' C ' + midX + ' ' + sy + ', ' + midX + ' ' + ey + ', ' + ex + ' ' + ey
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CalloutLineOverlay renders the SVG callout lines and endpoint circles.
 * It is positioned as an absolutely placed overlay and uses pointer-events
 * selectively: the SVG background is non-interactive (pointer-events: none)
 * but endpoint circles capture hover and click events.
 */
export function CalloutLineOverlay(props: CalloutLineOverlayProps) {
  /* Build a quick-lookup map from lineId → lineDef for label access */
  const lineDefMap: Record<string, CalloutLineDef> = {};
  for (let i = 0; i < props.lines.length; i++) {
    lineDefMap[props.lines[i].id] = props.lines[i];
  }

  /* Only render lines with resolved geometry */
  const resolvedGeos: CalloutLineGeometry[] = [];
  for (let i = 0; i < props.geometries.length; i++) {
    if (props.geometries[i].resolved) {
      resolvedGeos.push(props.geometries[i]);
    }
  }

  /* If nothing to render, return null for clean DOM */
  if (resolvedGeos.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      data-testid="callout-line-overlay-svg"
      aria-hidden="true"
    >
      {/* Drop shadow filter for endpoint circles — provides subtle
       * elevation so circles are visible against any background. */}
      <defs>
        <filter id={ENDPOINT_SHADOW_FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Render each resolved callout line */}
      {resolvedGeos.map(function (geo) {
        const lineDef = lineDefMap[geo.lineId];
        if (!lineDef) return null;

        const state = props.lineStates[geo.lineId];
        const isHighlighted = state ? state.isHighlighted : false;
        const isActive = state ? state.isActive : false;

        /* Select visual properties based on highlight/active state.
         * Active (endpoint clicked) gets the strongest treatment —
         * higher opacity and accent color. Highlighted (hover/focus)
         * is intermediate. Default uses severity-informed colors from
         * the shared completion color system. */
        const strokeColor = (isHighlighted || isActive) ? LINE_COLOR_HIGHLIGHT : LINE_COLOR_DEFAULT;
        const strokeOpacity = isActive ? 0.85 : (isHighlighted ? LINE_OPACITY_HIGHLIGHT : LINE_OPACITY_DEFAULT);
        const strokeWidth = (isHighlighted || isActive) ? LINE_STROKE_WIDTH_HIGHLIGHT : LINE_STROKE_WIDTH;

        /* Endpoint stroke uses severity-informed color from the shared
         * completion color system. When highlighted/active, use accent
         * for consistency with the interaction model. */
        const severityStroke = getEndpointSeverityStroke(lineDef.severity);
        const endpointStroke = (isHighlighted || isActive) ? ENDPOINT_STROKE_HIGHLIGHT : severityStroke;

        /* Endpoint fill uses severity-informed subdued color instead of
         * plain white, so the circles carry semantic meaning. When
         * highlighted/active, revert to white for contrast. */
        const endpointFill = (isHighlighted || isActive) ? ENDPOINT_FILL : getEndpointSeverityFill(lineDef.severity);

        const pathData = buildLinePath(geo);

        return (
          <g key={geo.lineId} data-testid={'callout-line-group-' + geo.lineId}>
            {/* The line path — from source to endpoint */}
            <path
              d={pathData}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={strokeOpacity}
              style={{
                transition: 'stroke 0.2s ease, opacity 0.2s ease, stroke-width 0.15s ease',
              }}
              data-testid={'callout-line-path-' + geo.lineId}
            />

            {/* Small source indicator dot — marks where the line
             * originates on the resume content. Very small and subtle. */}
            <circle
              cx={geo.sourceX}
              cy={geo.sourceY}
              r={2.5}
              fill={strokeColor}
              opacity={isHighlighted ? 0.6 : 0.3}
              style={{
                transition: 'fill 0.2s ease, opacity 0.2s ease',
              }}
              data-testid={'callout-source-dot-' + geo.lineId}
            />

            {/* Endpoint circle — the white-filled terminal point
             * outside the document. This is the primary interactive
             * element of the overlay. Has pointer-events enabled for
             * hover and click interaction. */}
            <CalloutEndpointCircle
              geo={geo}
              lineDef={lineDef}
              endpointStroke={endpointStroke}
              endpointFill={endpointFill}
              isHighlighted={isHighlighted}
              onHover={props.onEndpointHover}
              onClick={props.onEndpointClick}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Endpoint circle with hover/focus behavior
// ---------------------------------------------------------------------------

/**
 * The endpoint circle is the white-filled terminal point of a callout
 * line. It sits outside the document boundary and serves as the visual
 * "landing pad" for the guidance annotation.
 *
 * INTERACTION:
 *   - Hovering shows the line highlight and a subtle tooltip with the
 *     guidance headline.
 *   - Clicking can activate the associated callout card.
 *   - Focus-visible (keyboard) provides the same highlight as hover.
 *
 * The circle uses pointer-events: auto so it captures mouse events
 * even though the parent SVG has pointer-events: none.
 */
function CalloutEndpointCircle(props: {
  geo: CalloutLineGeometry;
  lineDef: CalloutLineDef;
  endpointStroke: string;
  endpointFill: string;
  isHighlighted: boolean;
  onHover: (lineId: string, hovered: boolean) => void;
  onClick?: (lineId: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  const lineId = props.geo.lineId;
  const isActive = props.isHighlighted || isFocused;

  return (
    <g
      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      onMouseEnter={function () { props.onHover(lineId, true); }}
      onMouseLeave={function () { props.onHover(lineId, false); }}
      onFocus={function () {
        setIsFocused(true);
        props.onHover(lineId, true);
      }}
      onBlur={function () {
        setIsFocused(false);
        props.onHover(lineId, false);
      }}
      onClick={function () {
        if (props.onClick) {
          props.onClick(lineId);
        }
      }}
      onKeyDown={function (e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (props.onClick) {
            props.onClick(lineId);
          }
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={props.lineDef.anchor.label + ': ' + props.lineDef.headline}
      data-testid={'callout-endpoint-' + lineId}
    >
      {/* Outer hit area — larger invisible circle for easier targeting */}
      <circle
        cx={props.geo.endpointX}
        cy={props.geo.endpointY}
        r={ENDPOINT_RADIUS + 6}
        fill="transparent"
        stroke="none"
      />

      {/* Shadow/glow layer — subtle elevation effect */}
      <circle
        cx={props.geo.endpointX}
        cy={props.geo.endpointY}
        r={ENDPOINT_RADIUS}
        fill="none"
        filter={'url(#' + ENDPOINT_SHADOW_FILTER_ID + ')'}
        opacity={isActive ? 0.9 : 0.6}
      />

      {/* Main circle — severity-informed fill with themed stroke.
       * The fill color uses the shared completion color system at
       * subdued intensity so circles carry semantic meaning:
       *   high severity → reddish tint
       *   medium severity → amber tint
       *   low severity → greenish tint
       * When highlighted/active, reverts to white for contrast. */}
      <circle
        cx={props.geo.endpointX}
        cy={props.geo.endpointY}
        r={ENDPOINT_RADIUS}
        fill={props.endpointFill}
        stroke={props.endpointStroke}
        strokeWidth={ENDPOINT_STROKE_WIDTH}
        opacity={isActive ? 1 : 0.85}
        style={{
          transition: 'stroke 0.2s ease, fill 0.2s ease, opacity 0.2s ease',
        }}
      />

      {/* Focus ring — visible only on keyboard focus for accessibility.
       * Slightly larger circle with accent stroke. */}
      {isFocused && (
        <circle
          cx={props.geo.endpointX}
          cy={props.geo.endpointY}
          r={ENDPOINT_RADIUS + 3}
          fill="none"
          stroke="var(--p-accent, #2563eb)"
          strokeWidth={2}
          opacity={0.8}
        />
      )}

      {/* Tiny inner dot — provides a subtle center mark when highlighted.
       * Uses the annotation class color for instant classification. */}
      {isActive && (
        <circle
          cx={props.geo.endpointX}
          cy={props.geo.endpointY}
          r={1.5}
          fill={props.endpointStroke}
          opacity={0.5}
        />
      )}
    </g>
  );
}
