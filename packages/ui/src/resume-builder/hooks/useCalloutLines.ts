/**
 * ============================================================================
 * USE CALLOUT LINES — Hook for computing precision callout line geometry
 * ============================================================================
 *
 * PURPOSE: Measures anchor DOM elements inside the resume document and
 * computes the resolved pixel geometry for callout lines that extend
 * from those anchors to endpoint circles outside the document panel.
 *
 * ARCHITECTURE:
 *   1. The hook accepts a list of CalloutLineDef items and refs to the
 *      document panel and the overlay container.
 *   2. On each measurement cycle it reads getBoundingClientRect() for
 *      each anchor (found via data-callout-anchor attribute) and the
 *      document panel.
 *   3. It computes source and endpoint coordinates relative to the
 *      overlay container so the SVG paths render correctly.
 *   4. The endpoint X is always placed a fixed distance OUTSIDE the
 *      right edge of the document panel.
 *
 * MEASUREMENT TIMING:
 *   - Measurements run on mount, when the line list changes, when the
 *     selected section changes, and on window resize.
 *   - Uses requestAnimationFrame to batch DOM reads and avoid layout thrash.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CalloutLineDef,
  CalloutLineGeometry,
  CalloutLineState,
  CalloutLineOverlayConfig,
} from '../types/callout-line-types';

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseCalloutLinesReturn {
  /** Resolved geometry for each visible callout line. Only includes
   *  lines whose anchor element was found and measured. */
  geometries: CalloutLineGeometry[];

  /** Visual state for each visible line (hover/focus/highlight/active). */
  lineStates: Record<string, CalloutLineState>;

  /** Set the hovered state for a source anchor by line ID. */
  setSourceHovered: (lineId: string, hovered: boolean) => void;

  /** Set the hovered state for an endpoint circle by line ID. */
  setEndpointHovered: (lineId: string, hovered: boolean) => void;

  /** Set which line is "active" (endpoint was clicked, guidance card
   *  is open). Pass null to clear all active states. */
  setActiveLineId: (lineId: string | null) => void;

  /** Trigger a re-measurement of all line positions. Call this after
   *  layout changes like scrolling or section selection. */
  remeasure: () => void;
}

// ---------------------------------------------------------------------------
// Constants — endpoint positioning
// ---------------------------------------------------------------------------

/**
 * How far beyond the document panel's edge the endpoint circle center
 * is placed. Measured in pixels from the panel's boundary (right or left).
 */
const ENDPOINT_OFFSET_PX = 48;

/**
 * Vertical stagger between endpoints when multiple lines have similar
 * Y positions. Prevents endpoint circles from overlapping.
 */
const MIN_VERTICAL_GAP_PX = 28;

/**
 * Side-awareness threshold. When the anchor's horizontal center is
 * within this fraction of the document width from the left edge,
 * the line routes left instead of right. For example, 0.35 means
 * if the anchor center is in the left 35% of the document, route left.
 *
 * This prevents lines from cutting across the full width of the
 * resume when the anchor is on the left side of the document.
 */
const LEFT_SIDE_THRESHOLD = 0.35;

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * useCalloutLines computes callout line geometry from anchor DOM positions.
 * It observes the document panel and overlay container to produce stable
 * pixel coordinates for the SVG overlay.
 *
 * @param lines              - Callout line definitions to render
 * @param config             - Visibility and filtering configuration
 * @param documentPanelRef   - Ref to the resume document panel DOM element
 * @param overlayRef         - Ref to the SVG overlay container DOM element
 * @param selectedSection    - Currently selected section ID (for filtering)
 * @param scrollContainerRef - Optional ref to the scroll container for scroll-attached remeasurement
 */
export function useCalloutLines(
  lines: CalloutLineDef[],
  config: CalloutLineOverlayConfig,
  documentPanelRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
  selectedSection: string | null,
  scrollContainerRef?: React.RefObject<HTMLElement | null>
): UseCalloutLinesReturn {

  /* Geometry state — resolved positions for all visible lines */
  const [geometries, setGeometries] = useState<CalloutLineGeometry[]>([]);

  /* Interaction state — hover/focus tracking per line */
  const [lineStates, setLineStates] = useState<Record<string, CalloutLineState>>({});

  /* Animation frame handle for batched DOM reads */
  const rafRef = useRef<number | null>(null);

  // -------------------------------------------------------------------------
  // Filter lines to the active set based on config and selection
  // -------------------------------------------------------------------------

  /**
   * Compute which lines are eligible for rendering. Applies the section
   * filter and max-lines limit. Uses explicit loops per house rules.
   */
  const getVisibleLines = useCallback(function (): CalloutLineDef[] {
    if (!config.enabled) return [];

    let filtered: CalloutLineDef[] = [];

    /* Apply section filter if enabled */
    if (config.filterToSelectedSection && selectedSection) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].anchor.sectionId === selectedSection) {
          filtered.push(lines[i]);
        }
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        filtered.push(lines[i]);
      }
    }

    /* Sort by severity: high first, then medium, then low */
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    filtered.sort(function (a, b) {
      const aVal = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 2;
      const bVal = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 2;
      return aVal - bVal;
    });

    /* Trim to max visible count */
    const maxLines = config.maxLines > 0 ? config.maxLines : 4;
    if (filtered.length > maxLines) {
      filtered = filtered.slice(0, maxLines);
    }

    return filtered;
  }, [lines, config, selectedSection]);

  // -------------------------------------------------------------------------
  // DOM measurement — reads anchor positions and computes geometry
  // -------------------------------------------------------------------------

  /**
   * Measure all visible anchor elements and compute line geometry.
   * Runs inside requestAnimationFrame to batch DOM reads.
   *
   * Coordinate system: all positions are relative to the overlay
   * container's top-left corner. We convert from viewport coordinates
   * using the overlay's own bounding rect as the origin.
   */
  const measure = useCallback(function () {
    const docPanel = documentPanelRef.current;
    const overlay = overlayRef.current;
    if (!docPanel || !overlay) {
      setGeometries([]);
      return;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const docRect = docPanel.getBoundingClientRect();

    /* Document edges in overlay-relative coordinates */
    const docRightX = docRect.right - overlayRect.left;
    const docLeftX = docRect.left - overlayRect.left;
    const docWidth = docRect.width;

    /* Endpoint positions on each side */
    const endpointXRight = docRightX + ENDPOINT_OFFSET_PX;
    const endpointXLeft = docLeftX - ENDPOINT_OFFSET_PX;

    const visibleLines = getVisibleLines();
    const newGeometries: CalloutLineGeometry[] = [];

    for (let i = 0; i < visibleLines.length; i++) {
      const lineDef = visibleLines[i];
      const anchorId = lineDef.anchor.anchorId;

      /* Find the anchor DOM element using data-callout-anchor attribute */
      const anchorEl = docPanel.querySelector('[data-callout-anchor="' + anchorId + '"]');
      if (!anchorEl) {
        /* Anchor element not found — mark as unresolved */
        newGeometries.push({
          lineId: lineDef.id,
          sourceX: 0,
          sourceY: 0,
          endpointX: 0,
          endpointY: 0,
          resolved: false,
          side: 'right',
        });
        continue;
      }

      const anchorRect = anchorEl.getBoundingClientRect();
      const anchorCenterX = anchorRect.left + (anchorRect.width / 2);

      /* SIDE-AWARE ROUTING: Determine which side the line should route to.
       * If the anchor's horizontal center is in the left portion of the
       * document (within LEFT_SIDE_THRESHOLD), route left. Otherwise route
       * right. This prevents lines from cutting across the entire resume
       * body when the anchor sits on the left side. */
      const anchorRelativeX = anchorCenterX - docRect.left;
      const routeLeft = docWidth > 0 && (anchorRelativeX / docWidth) < LEFT_SIDE_THRESHOLD;

      let sourceX: number;
      let endpointX: number;
      let side: 'left' | 'right';

      if (routeLeft && endpointXLeft > 0) {
        /* Route to the left: source from anchor's LEFT edge */
        sourceX = anchorRect.left - overlayRect.left;
        endpointX = endpointXLeft;
        side = 'left';
      } else {
        /* Route to the right: source from anchor's RIGHT edge (default) */
        sourceX = anchorRect.right - overlayRect.left;
        endpointX = endpointXRight;
        side = 'right';
      }

      const sourceY = anchorRect.top + (anchorRect.height / 2) - overlayRect.top;

      /* Endpoint Y: aligned with source Y, then staggered if needed */
      let endpointY = sourceY;

      newGeometries.push({
        lineId: lineDef.id,
        sourceX: sourceX,
        sourceY: sourceY,
        endpointX: endpointX,
        endpointY: endpointY,
        resolved: true,
        side: side,
      });
    }

    /* De-overlap endpoint Y positions: ensure MIN_VERTICAL_GAP between
     * adjacent endpoints. Only adjusts resolved geometries. */
    const resolvedGeometries: CalloutLineGeometry[] = [];
    for (let i = 0; i < newGeometries.length; i++) {
      if (newGeometries[i].resolved) {
        resolvedGeometries.push(newGeometries[i]);
      }
    }
    resolvedGeometries.sort(function (a, b) { return a.endpointY - b.endpointY; });

    for (let i = 1; i < resolvedGeometries.length; i++) {
      const gap = resolvedGeometries[i].endpointY - resolvedGeometries[i - 1].endpointY;
      if (gap < MIN_VERTICAL_GAP_PX) {
        resolvedGeometries[i].endpointY = resolvedGeometries[i - 1].endpointY + MIN_VERTICAL_GAP_PX;
      }
    }

    setGeometries(newGeometries);
  }, [documentPanelRef, overlayRef, getVisibleLines]);

  // -------------------------------------------------------------------------
  // Remeasure trigger — public API for the parent to request re-layout
  // -------------------------------------------------------------------------

  const remeasure = useCallback(function () {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(function () {
      measure();
      rafRef.current = null;
    });
  }, [measure]);

  // -------------------------------------------------------------------------
  // Auto-measure on mount, line changes, section changes, and resize
  // -------------------------------------------------------------------------

  useEffect(function () {
    /* Initial measurement after a paint cycle so DOM is ready */
    const handle = requestAnimationFrame(function () {
      measure();
    });

    /**
     * Throttled remeasure handler used for resize and scroll events.
     * Uses requestAnimationFrame to batch DOM reads and avoid layout
     * thrash during rapid scroll/resize sequences.
     */
    function handleRemeasure() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(function () {
        measure();
        rafRef.current = null;
      });
    }

    /* Re-measure on window resize */
    window.addEventListener('resize', handleRemeasure);

    /**
     * SCROLL ATTACHMENT: Listen for scroll events on the canvas scroll
     * container so callout lines stay visually attached to their source
     * anchors as the user scrolls the resume. Without this, lines drift
     * away from their anchors because the overlay measures viewport-
     * relative positions that change on scroll.
     */
    const scrollContainer = scrollContainerRef ? scrollContainerRef.current : null;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleRemeasure, { passive: true });
    }

    return function () {
      cancelAnimationFrame(handle);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', handleRemeasure);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleRemeasure);
      }
    };
  }, [measure, scrollContainerRef]);

  /* Re-measure whenever lines or selection changes */
  useEffect(function () {
    /* Small delay to let DOM updates settle before measuring */
    const timeoutId = setTimeout(function () {
      measure();
    }, 50);
    return function () { clearTimeout(timeoutId); };
  }, [lines, selectedSection, config, measure]);

  // -------------------------------------------------------------------------
  // Hover/focus state management
  // -------------------------------------------------------------------------

  /**
   * Set the hover state for a source anchor element. When a source is
   * hovered, the corresponding line and endpoint become highlighted.
   */
  const setSourceHovered = useCallback(function (lineId: string, hovered: boolean) {
    setLineStates(function (prev) {
      const next = Object.assign({}, prev);
      const existing = next[lineId];
      const isActive = existing ? existing.isActive : false;
      if (existing) {
        next[lineId] = {
          lineId: lineId,
          sourceHovered: hovered,
          endpointHovered: existing.endpointHovered,
          isHighlighted: hovered || existing.endpointHovered || isActive,
          isActive: isActive,
        };
      } else {
        next[lineId] = {
          lineId: lineId,
          sourceHovered: hovered,
          endpointHovered: false,
          isHighlighted: hovered,
          isActive: false,
        };
      }
      return next;
    });
  }, []);

  /**
   * Set the hover state for an endpoint circle. When an endpoint is
   * hovered, the corresponding line and source become highlighted.
   */
  const setEndpointHovered = useCallback(function (lineId: string, hovered: boolean) {
    setLineStates(function (prev) {
      const next = Object.assign({}, prev);
      const existing = next[lineId];
      const isActive = existing ? existing.isActive : false;
      if (existing) {
        next[lineId] = {
          lineId: lineId,
          sourceHovered: existing.sourceHovered,
          endpointHovered: hovered,
          isHighlighted: existing.sourceHovered || hovered || isActive,
          isActive: isActive,
        };
      } else {
        next[lineId] = {
          lineId: lineId,
          sourceHovered: false,
          endpointHovered: hovered,
          isHighlighted: hovered,
          isActive: false,
        };
      }
      return next;
    });
  }, []);

  /**
   * Set the active line ID. When an endpoint is clicked, the parent
   * calls this to mark that line as "active" — which gives it a
   * persistent highlight and triggers the guidance card to open.
   * Passing null clears the active state from all lines.
   */
  const setActiveLineId = useCallback(function (activeId: string | null) {
    setLineStates(function (prev) {
      const next: Record<string, CalloutLineState> = {};
      const keys = Object.keys(prev);
      for (let i = 0; i < keys.length; i++) {
        const existing = prev[keys[i]];
        const nowActive = keys[i] === activeId;
        next[keys[i]] = {
          lineId: existing.lineId,
          sourceHovered: existing.sourceHovered,
          endpointHovered: existing.endpointHovered,
          isHighlighted: existing.sourceHovered || existing.endpointHovered || nowActive,
          isActive: nowActive,
        };
      }
      return next;
    });
  }, []);

  return {
    geometries: geometries,
    lineStates: lineStates,
    setSourceHovered: setSourceHovered,
    setEndpointHovered: setEndpointHovered,
    setActiveLineId: setActiveLineId,
    remeasure: remeasure,
  };
}
