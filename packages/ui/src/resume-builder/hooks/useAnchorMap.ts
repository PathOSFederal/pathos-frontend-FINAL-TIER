/**
 * ============================================================================
 * USE ANCHOR MAP — Hook for managing the annotation anchor registry
 * ============================================================================
 *
 * PURPOSE: Provides a React hook for registering, updating, and querying
 * the anchor map that the callout layer uses to position callout cards
 * on the resume canvas.
 *
 * ARCHITECTURE:
 *   - Canvas section components call `registerAnchor` as they mount.
 *   - The hook maintains a stable map of all registered anchors.
 *   - `getAnchorsForSection` returns only anchors for the given section.
 *   - `getVisibleCallouts` returns the top-N priority callouts for the
 *     selected section based on annotation data.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { AnchorDef, AnchorMap, AnchorRegistration, AnchorSectionId, CalloutData } from '../types/anchor-types';
import type { TailoringAnnotation } from '../types/annotation-types';

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseAnchorMapReturn {
  /** The current anchor map — all registered anchors keyed by ID. */
  anchorMap: AnchorMap;

  /** Register a new anchor or update an existing one.
   *  Called by canvas section components as they render. */
  registerAnchor: (registration: AnchorRegistration, ref: React.RefObject<HTMLElement | null>) => void;

  /** Remove an anchor from the map (called on unmount). */
  unregisterAnchor: (anchorId: string) => void;

  /** Get all anchors for a specific section. */
  getAnchorsForSection: (sectionId: AnchorSectionId) => AnchorDef[];

  /** Update the selected section — marks anchors in that section as
   *  selected and others as not selected. */
  updateSelectedSection: (sectionId: AnchorSectionId | null) => void;

  /** Get the top-N callout data items for the selected section,
   *  derived from the anchor map and the annotation list. */
  getVisibleCallouts: (annotations: TailoringAnnotation[], maxVisible: number) => CalloutData[];
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * useAnchorMap manages the annotation anchor registry for the resume
 * canvas. It provides functions to register/unregister anchors, query
 * section-specific anchors, and compute visible callouts.
 *
 * Uses React state for the map so that it is safe to read during render
 * (avoids the React Compiler error about reading refs during render).
 */
export function useAnchorMap(): UseAnchorMapReturn {
  /**
   * The anchor map is stored in state. Updates happen through setter
   * functions that produce new map objects.
   */
  const [anchorMap, setAnchorMap] = useState<AnchorMap>({});

  /**
   * Currently selected section ID. Tracked in state so all consumers
   * see consistent selection state.
   */
  const [selectedSection, setSelectedSection] = useState<AnchorSectionId | null>(null);

  /**
   * Register a new anchor or update an existing one in the map.
   * This is called by canvas section components via effects.
   */
  const registerAnchor = useCallback(function (
    registration: AnchorRegistration,
    ref: React.RefObject<HTMLElement | null>
  ) {
    setAnchorMap(function (prev) {
      const anchor: AnchorDef = {
        id: registration.id,
        kind: registration.kind,
        owningSection: registration.owningSection,
        domRef: ref,
        allowedAnnotations: registration.allowedAnnotations,
        priority: registration.priority,
        isSelected: false,
        isVisible: false,
      };
      const next = Object.assign({}, prev);
      next[registration.id] = anchor;
      return next;
    });
  }, []);

  /**
   * Remove an anchor from the map. Called when a section component unmounts.
   */
  const unregisterAnchor = useCallback(function (anchorId: string) {
    setAnchorMap(function (prev) {
      const next = Object.assign({}, prev);
      delete next[anchorId];
      return next;
    });
  }, []);

  /**
   * Get all anchors belonging to a specific section.
   */
  const getAnchorsForSection = useCallback(function (sectionId: AnchorSectionId): AnchorDef[] {
    const result: AnchorDef[] = [];
    const keys = Object.keys(anchorMap);
    for (let i = 0; i < keys.length; i++) {
      const anchor = anchorMap[keys[i]];
      if (anchor.owningSection === sectionId) {
        result.push(anchor);
      }
    }
    result.sort(function (a, b) { return a.priority - b.priority; });
    return result;
  }, [anchorMap]);

  /**
   * Update which section is selected. Updates state so re-render
   * propagates the change to all consumers.
   */
  const updateSelectedSection = useCallback(function (sectionId: AnchorSectionId | null) {
    setSelectedSection(sectionId);
  }, []);

  /**
   * Get the top-N visible callout data items for the currently selected
   * section. Matches annotations to anchors and returns only the highest-
   * priority unresolved items.
   */
  const getVisibleCallouts = useCallback(function (
    annotations: TailoringAnnotation[],
    maxVisible: number
  ): CalloutData[] {
    if (!selectedSection) return [];

    const sectionAnchors = getAnchorsForSection(selectedSection);
    const anchorIdSet: Record<string, boolean> = {};
    for (let i = 0; i < sectionAnchors.length; i++) {
      anchorIdSet[sectionAnchors[i].id] = true;
    }

    const matching: TailoringAnnotation[] = [];
    for (let i = 0; i < annotations.length; i++) {
      if (anchorIdSet[annotations[i].anchorId] && !annotations[i].resolved) {
        matching.push(annotations[i]);
      }
    }

    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    matching.sort(function (a, b) {
      const aOrder = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 2;
      const bOrder = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 2;
      return aOrder - bOrder;
    });

    const result: CalloutData[] = [];
    const limit = maxVisible < matching.length ? maxVisible : matching.length;
    for (let i = 0; i < limit; i++) {
      const ann = matching[i];
      result.push({
        anchorId: ann.anchorId,
        annotationType: ann.annotationClass,
        headline: ann.label,
        description: ann.description,
        priority: i,
        isActive: true,
      });
    }

    return result;
  }, [selectedSection, getAnchorsForSection]);

  return {
    anchorMap: anchorMap,
    registerAnchor: registerAnchor,
    unregisterAnchor: unregisterAnchor,
    getAnchorsForSection: getAnchorsForSection,
    updateSelectedSection: updateSelectedSection,
    getVisibleCallouts: getVisibleCallouts,
  };
}
