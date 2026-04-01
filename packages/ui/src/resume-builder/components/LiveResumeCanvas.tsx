/**
 * ============================================================================
 * LIVE RESUME CANVAS — Central document workspace with inline editing
 * ============================================================================
 *
 * PURPOSE: The primary workspace surface for the Resume Builder. Renders
 * the full federal resume as a continuous, readable document with all
 * sections always visible. Supports direct in-place editing for:
 *   - Professional summary (click-to-edit textarea)
 *   - Work experience bullets (click-to-edit inline)
 *   - Skills block (click-to-edit inline)
 *   - Federal details fields (click-to-edit inline)
 *
 * ARCHITECTURE:
 *   - Each major section has a stable rendered region even if empty/sparse.
 *   - Selected section receives a highlight and action chips.
 *   - Editing is activated by clicking an editable region within the
 *     selected section — the static text is replaced with an input/textarea.
 *   - Each section registers anchor points for the callout layer.
 *
 * The canvas is wrapped in a constrained-width panel with document-like
 * styling (subtle border, shadow, surface background) so the resume
 * feels like a real document rather than loose UI elements.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import type React from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, Check, X, Sparkles, Shrink } from 'lucide-react';
import type { ResumeDraft, ResumeCertification, ResumeSupportingEvidence } from '@pathos/core';
import type { AnchorRegistration, AnchorSectionId, AnnotationType } from '../types/anchor-types';
import { INTERACTIVE_HOVER_CLASS } from '../../styles/interactiveHover';
import type { DocumentPage, PaginatedDocument } from '../types/document-block-types';
import {
  PAGE_HEIGHT_PX,
  PAGE_GAP_PX,
} from '../types/document-block-types';
import {
  paginateResume,
  groupBlocksBySectionId,
  getExperienceIdsFromBlocks,
  groupContainsFirstBlock,
} from '../utils/pagination-engine';
import type { BlockGroup } from '../utils/pagination-engine';

// ---------------------------------------------------------------------------
// Editing callback types — used by the parent screen to persist changes
// ---------------------------------------------------------------------------

/**
 * Describes which field is currently being edited. The parent screen
 * uses this to know what data to update when the user saves.
 *
 *   summary:           The professional summary paragraph.
 *   bullet:            A single experience bullet (experienceId + bulletIndex).
 *   skill:             The comma-separated skills text block.
 *   federal-field:     A specific federal details field (fieldName).
 *   contact-field:     A specific contact/header field (fieldName).
 *   experience-field:  A Work Experience subfield (title, employer, dates, hours).
 */
export type EditingFieldType =
  | 'summary'
  | 'bullet'
  | 'skill'
  | 'federal-field'
  | 'contact-field'
  | 'experience-field'
  | 'education-field'
  | 'certification'
  | 'supporting-evidence';

export interface EditingField {
  type: EditingFieldType;
  /** For bullets and experience-field: which experience entry. */
  experienceId?: string;
  /** For education-field: which education entry. */
  educationId?: string;
  /** For certification: which certification entry. */
  certificationId?: string;
  /** For supporting-evidence: which evidence entry. */
  evidenceId?: string;
  /** For bullets: which bullet index within the experience. */
  bulletIndex?: number;
  /** For federal/contact/experience fields: which specific field. */
  fieldName?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LiveResumeCanvasProps {
  /** The current resume draft to render. */
  draft: ResumeDraft;

  /** Which section is currently selected (for highlighting + callouts). */
  selectedSectionId: string | null;

  /** Callback when the user clicks a section to select it. */
  onSectionSelect: (sectionId: string) => void;

  /** Callback to register an anchor point for the callout layer.
   *  Called by each section block as it renders. */
  onAnchorRegister: (registration: AnchorRegistration, ref: React.RefObject<HTMLElement | null>) => void;

  /** Whether the canvas is in edit mode (click-to-edit enabled). */
  editMode: boolean;

  /** Federal details data (not yet in core model). */
  federalDetails: {
    securityClearance: string;
    veteranPreference: string;
    federalEmployee: boolean;
    highestGrade: string;
  } | null;

  /** Certifications from the draft (now in core model). */
  certifications: ResumeCertification[];

  /** Supporting evidence from the draft (now in core model). */
  supportingEvidence: ResumeSupportingEvidence[];

  /**
   * Callback when the user saves an inline edit. The parent screen
   * uses this to persist the change to the resume store.
   *
   *   field:    which field was edited (type + identifiers)
   *   newValue: the new text content after editing
   */
  onInlineEditSave?: (field: EditingField, newValue: string) => void;

  /**
   * Callback when a section action chip is clicked. The parent can
   * use this to trigger PathOS guidance, open deeper editors, etc.
   *
   *   sectionId: which section the chip belongs to
   *   action:    which action was requested
   */
  onSectionAction?: (sectionId: string, action: string) => void;

  /**
   * Callback to remove an individual item from the resume.
   * The parent screen handles the actual removal from the store.
   *
   *   sectionId: which section the item belongs to
   *   itemId:    the unique ID of the item to remove
   *   extra:     optional extra info (e.g. bulletIndex for bullets)
   */
  onRemoveItem?: (sectionId: string, itemId: string, extra?: { bulletIndex?: number }) => void;

  /**
   * Optional ref to attach to the resume document panel element.
   * The callout line overlay uses this to measure anchor positions
   * relative to the document boundary for precision line rendering.
   */
  documentPanelRef?: React.RefObject<HTMLDivElement | null>;

  /**
   * Set of callout anchor IDs that are currently highlighted (endpoint
   * hovered or focused). Used to add a subtle visual highlight on the
   * corresponding resume content element. Maps data-callout-anchor values
   * to boolean highlight state.
   */
  highlightedAnchors?: Record<string, boolean>;

  /**
   * Callback when a content anchor element is hovered. Allows the parent
   * screen to trigger line highlight state via the callout lines hook.
   *   anchorId: the data-callout-anchor value of the hovered element
   *   hovered:  true on mouseenter/focus, false on mouseleave/blur
   */
  onAnchorHover?: (anchorId: string, hovered: boolean) => void;

  /**
   * Optional ref to attach to the scroll container element (the outermost
   * div with overflow-y-auto). The parent uses this to listen for scroll
   * events and remeasure callout line overlay positions.
   */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;

  /**
   * Callback fired when the measured page count changes. Allows the
   * parent screen to use the canvas's real measurement-based page count
   * instead of heuristic estimates. The page count is derived from the
   * actual rendered content height divided by the US Letter page height.
   */
  onPageCountChange?: (pageCount: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LiveResumeCanvas renders the full resume as a continuous document.
 * All sections are always visible. The selected section receives a
 * subtle visual highlight plus action chips. Each section registers
 * anchor points for the callout system.
 *
 * Direct inline editing is supported: clicking an editable region
 * within the selected section replaces the static text with an
 * input/textarea, and saving persists via the onInlineEditSave callback.
 */
export function LiveResumeCanvas(props: LiveResumeCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  /**
   * PAGE-FIRST PAGINATION: Instead of rendering one continuous canvas
   * with absolute-positioned backgrounds and spacers, the document is
   * paginated BEFORE rendering. The pagination engine (pagination-engine.ts)
   * converts the draft into a PaginatedDocument with blocks assigned to
   * numbered pages. Each page renders as a real DOM container — selection
   * chrome, action bars, and callout anchors are page-local by construction.
   *
   * This replaces the old model where PAGE_HEIGHT_PX / PAGE_CONTENT_PX
   * were used post-hoc with a ResizeObserver to inject spacers. Now the
   * block pipeline is: build blocks → estimate heights → paginate → render.
   */
  const paginatedDoc: PaginatedDocument = paginateResume(
    props.draft,
    props.federalDetails,
    props.certifications,
    props.supportingEvidence
  );

  /**
   * Notify the parent screen of the current page count whenever the
   * paginated document changes. This drives the top bar page budget
   * indicator and preview page count display.
   */
  useEffect(function () {
    if (props.onPageCountChange) {
      props.onPageCountChange(paginatedDoc.totalPages);
    }
  }, [paginatedDoc.totalPages]); /* eslint-disable-line react-hooks/exhaustive-deps -- only fire when page count changes */

  /**
   * Internal editing state — tracks which field is currently being
   * edited within the canvas. Only one field can be edited at a time.
   * When null, no field is in edit mode.
   */
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [editingText, setEditingText] = useState('');

  /**
   * Handle saving an inline edit: call the parent callback and clear
   * the internal editing state. The save callback is captured from
   * props at this scope level to avoid compiler dependency issues.
   */
  const onInlineEditSave = props.onInlineEditSave;
  const handleEditSave = useCallback(function () {
    if (editingField && onInlineEditSave) {
      onInlineEditSave(editingField, editingText);
    }
    setEditingField(null);
    setEditingText('');
  }, [editingField, editingText, onInlineEditSave]);

  /**
   * Handle cancelling an inline edit: clear internal editing state
   * without persisting the change.
   */
  const handleEditCancel = useCallback(function () {
    setEditingField(null);
    setEditingText('');
  }, []);

  /**
   * Start editing a specific field. Sets the internal editing state
   * and pre-fills the editing text with the current value.
   */
  const startEditing = useCallback(function (field: EditingField, currentValue: string) {
    setEditingField(field);
    setEditingText(currentValue);
  }, []);

  /**
   * Handle section click — selects the section and notifies parent.
   * If clicking a different section while editing, cancel the edit first.
   */
  const onSectionSelect = props.onSectionSelect;
  function handleSectionClick(sectionId: string) {
    if (editingField) {
      handleEditCancel();
    }
    onSectionSelect(sectionId);
  }

  /**
   * Handle section action chip click — notifies the parent screen.
   * The action callback is captured from props at this scope level
   * to keep the dependency array explicit and compiler-friendly.
   */
  const onSectionAction = props.onSectionAction;
  const handleSectionAction = useCallback(function (sectionId: string, action: string) {
    if (onSectionAction) {
      onSectionAction(sectionId, action);
    }
  }, [onSectionAction]);

  /**
   * Handle removing an individual item. Delegates to the parent's
   * onRemoveItem callback. Stops propagation to avoid triggering
   * section-level click handlers.
   */
  const onRemoveItem = props.onRemoveItem;
  const handleRemoveItem = useCallback(function (sectionId: string, itemId: string, extra?: { bulletIndex?: number }) {
    if (onRemoveItem) {
      onRemoveItem(sectionId, itemId, extra);
    }
  }, [onRemoveItem]);

  /**
   * Delegated event handlers for callout anchor hover detection.
   * When the mouse enters an element with a data-callout-anchor attribute,
   * we notify the parent so the corresponding callout line highlights.
   * This avoids wiring hover logic into every individual section sub-component.
   */
  const onAnchorHover = props.onAnchorHover;
  const handleCanvasMouseOver = useCallback(function (e: React.MouseEvent) {
    if (!onAnchorHover) return;
    const target = e.target as HTMLElement;
    /* Walk up to find the nearest element with data-callout-anchor */
    let el: HTMLElement | null = target;
    while (el && el !== e.currentTarget) {
      const anchorId = el.getAttribute('data-callout-anchor');
      if (anchorId) {
        onAnchorHover(anchorId, true);
        return;
      }
      el = el.parentElement;
    }
  }, [onAnchorHover]);

  const handleCanvasMouseOut = useCallback(function (e: React.MouseEvent) {
    if (!onAnchorHover) return;
    const target = e.target as HTMLElement;
    let el: HTMLElement | null = target;
    while (el && el !== e.currentTarget) {
      const anchorId = el.getAttribute('data-callout-anchor');
      if (anchorId) {
        onAnchorHover(anchorId, false);
        return;
      }
      el = el.parentElement;
    }
  }, [onAnchorHover]);

  /**
   * Compute the set of highlighted anchor IDs from props for applying
   * a subtle visual tint to resume content elements whose endpoint
   * circles are being hovered.
   */
  const highlightedAnchors = props.highlightedAnchors;

  /**
   * Effect: apply/remove highlight styling on anchored elements.
   * When an endpoint circle is hovered, the corresponding anchor in
   * the document gets a subtle accent outline to show the connection.
   */
  useEffect(function () {
    if (!highlightedAnchors) return;
    const panel = canvasRef.current;
    if (!panel) return;

    const keys = Object.keys(highlightedAnchors);
    for (let i = 0; i < keys.length; i++) {
      const anchorId = keys[i];
      const el = panel.querySelector('[data-callout-anchor="' + anchorId + '"]') as HTMLElement | null;
      if (!el) continue;

      if (highlightedAnchors[anchorId]) {
        el.style.boxShadow = '0 0 0 1.5px var(--p-accent, #2563eb)';
        el.style.borderRadius = '2px';
        el.style.transition = 'box-shadow 0.2s ease';
      } else {
        el.style.boxShadow = '';
        el.style.borderRadius = '';
      }
    }

    /* Cleanup: remove highlight from all anchors when effect tears down */
    return function () {
      for (let i = 0; i < keys.length; i++) {
        const anchorId = keys[i];
        const el = panel.querySelector('[data-callout-anchor="' + anchorId + '"]') as HTMLElement | null;
        if (el) {
          el.style.boxShadow = '';
          el.style.borderRadius = '';
        }
      }
    };
  }, [highlightedAnchors]);

  /* The old ResizeObserver-based measurement effect has been removed.
   * Pagination is now deterministic: the paginateResume() call above
   * computes page assignments from content data, not DOM measurements.
   * The parent is notified of page count via the useEffect above. */

  /**
   * Merge the internal canvasRef with the optional scrollContainerRef
   * from props so both references point to the same scroll container.
   * This allows the parent to listen for scroll events while the
   * internal logic still has its own ref for DOM queries.
   */
  const scrollRefCallback = useCallback(function (node: HTMLDivElement | null) {
    /* Assign to internal ref */
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    /* Assign to parent-provided scroll container ref if present */
    if (props.scrollContainerRef) {
      (props.scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [props.scrollContainerRef]);

  /**
   * Render the content for a single block group within a page.
   * Each group contains consecutive blocks of the same sectionId.
   * The renderer wraps the group in a CanvasSectionWrapper and
   * delegates to the appropriate section component.
   *
   * For experience, the group may contain a subset of job entries
   * (those assigned to this page). The showHeader flag controls
   * whether the "Work Experience" heading appears (only for the
   * first page that has experience blocks).
   */
  function renderBlockGroup(group: BlockGroup, pageNumber: number): React.ReactNode {
    const sid = group.sectionId;
    /* Unique key for section wrappers that may appear on multiple pages.
     * Anchor IDs must be unique per wrapper, so page-indexed wrappers
     * use a page suffix for all pages after the first. */
    const pageKeySuffix = pageNumber > 1 ? '-p' + pageNumber : '';
    const wrapperTestId = 'canvas-section-' + sid + (pageNumber > 1 ? '-p' + pageNumber : '');

    /* Determine whether this group contains the first block of the
     * section (used for showing the heading in experience). */
    const showHeader = groupContainsFirstBlock(group.blocks);

    if (sid === 'contact') {
      return (
        <CanvasSectionWrapper
          key={'section-contact' + pageKeySuffix}
          sectionId="contact"
          isSelected={props.selectedSectionId === 'contact'}
          isEditReady={props.editMode}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <ContactCanvasSection
            draft={props.draft}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'contact'}
            editingField={editingField}
            editingText={editingText}
            onFieldEditStart={function (fieldName: string, currentValue: string) {
              startEditing({ type: 'contact-field', fieldName: fieldName }, currentValue);
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'summary') {
      return (
        <CanvasSectionWrapper
          key={'section-summary' + pageKeySuffix}
          sectionId="summary"
          isSelected={props.selectedSectionId === 'summary'}
          isEditReady={props.editMode}
          isEmpty={!props.draft.summary || props.draft.summary.trim().length === 0}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <SummaryCanvasSection
            summary={props.draft.summary}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'summary'}
            editingField={editingField}
            editingText={editingText}
            onEditStart={function () {
              startEditing({ type: 'summary' }, props.draft.summary || '');
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'experience') {
      /* Filter the draft's experience entries to only those assigned
       * to this page via the pagination engine's block assignment. */
      const expIds = getExperienceIdsFromBlocks(group.blocks);
      const filteredExperience: typeof props.draft.experience = [];
      for (let i = 0; i < props.draft.experience.length; i++) {
        for (let j = 0; j < expIds.length; j++) {
          if (props.draft.experience[i].id === expIds[j]) {
            filteredExperience.push(props.draft.experience[i]);
            break;
          }
        }
      }
      /* If no valid IDs matched (empty experience placeholder), show
       * the empty section with the full array to get the placeholder. */
      const expToRender = filteredExperience.length > 0 ? filteredExperience : props.draft.experience;

      return (
        <CanvasSectionWrapper
          key={'section-experience' + pageKeySuffix}
          sectionId="experience"
          isSelected={props.selectedSectionId === 'experience'}
          isEditReady={props.editMode}
          isEmpty={props.draft.experience.length === 0}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <ExperienceCanvasSection
            experience={expToRender}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'experience'}
            editingField={editingField}
            editingText={editingText}
            showHeader={showHeader}
            onBulletEditStart={function (expId: string, bulletIdx: number, text: string) {
              startEditing({ type: 'bullet', experienceId: expId, bulletIndex: bulletIdx }, text);
            }}
            onFieldEditStart={function (expId: string, fieldName: string, currentValue: string) {
              startEditing({ type: 'experience-field', experienceId: expId, fieldName: fieldName }, currentValue);
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            onRemoveJob={function (expId: string) { handleRemoveItem('experience', expId); }}
            onRemoveBullet={function (expId: string, bulletIdx: number) { handleRemoveItem('experience', expId, { bulletIndex: bulletIdx }); }}
            onAddBullet={function (expId: string) { handleRemoveItem('experience-add-bullet', expId); }}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'education') {
      return (
        <CanvasSectionWrapper
          key={'section-education' + pageKeySuffix}
          sectionId="education"
          isSelected={props.selectedSectionId === 'education'}
          isEditReady={props.editMode}
          isEmpty={props.draft.education.length === 0}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <EducationCanvasSection
            education={props.draft.education}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'education'}
            editingField={editingField}
            editingText={editingText}
            onFieldEditStart={function (eduId: string, fieldName: string, currentValue: string) {
              startEditing({ type: 'education-field', educationId: eduId, fieldName: fieldName }, currentValue);
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            onRemoveEntry={function (eduId: string) { handleRemoveItem('education', eduId); }}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'certifications') {
      return (
        <CanvasSectionWrapper
          key={'section-certifications' + pageKeySuffix}
          sectionId="certifications"
          isSelected={props.selectedSectionId === 'certifications'}
          isEditReady={props.editMode}
          isEmpty={!props.certifications || props.certifications.length === 0}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <CertificationsCanvasSection
            certifications={props.certifications}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'certifications'}
            editingField={editingField}
            editingText={editingText}
            onEditStart={function (currentValue: string) {
              startEditing({ type: 'certification' as EditingFieldType }, currentValue);
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            onRemoveCert={function (certId: string) { handleRemoveItem('certifications', certId); }}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'skills') {
      return (
        <CanvasSectionWrapper
          key={'section-skills' + pageKeySuffix}
          sectionId="skills"
          isSelected={props.selectedSectionId === 'skills'}
          isEditReady={props.editMode}
          isEmpty={props.draft.skills.length === 0}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <SkillsCanvasSection
            skills={props.draft.skills}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'skills'}
            editingField={editingField}
            editingText={editingText}
            onEditStart={function () {
              const names: string[] = [];
              for (let i = 0; i < props.draft.skills.length; i++) {
                names.push(props.draft.skills[i].name);
              }
              startEditing({ type: 'skill' }, names.join(', '));
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'federal-details') {
      return (
        <CanvasSectionWrapper
          key={'section-federal-details' + pageKeySuffix}
          sectionId="federal-details"
          isSelected={props.selectedSectionId === 'federal-details'}
          isEditReady={props.editMode}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <FederalDetailsCanvasSection
            federalDetails={props.federalDetails}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'federal-details'}
            editingField={editingField}
            editingText={editingText}
            onFieldEditStart={function (fieldName: string, currentValue: string) {
              startEditing({ type: 'federal-field', fieldName: fieldName }, currentValue);
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        </CanvasSectionWrapper>
      );
    }

    if (sid === 'supporting-evidence') {
      return (
        <CanvasSectionWrapper
          key={'section-supporting-evidence' + pageKeySuffix}
          sectionId="supporting-evidence"
          isSelected={props.selectedSectionId === 'supporting-evidence'}
          isEditReady={props.editMode}
          isEmpty={!props.supportingEvidence || props.supportingEvidence.length === 0}
          onClick={handleSectionClick}
          onAnchorRegister={props.onAnchorRegister}
          onSectionAction={handleSectionAction}
          testId={wrapperTestId}
          anchorIdSuffix={pageNumber > 1 ? pageKeySuffix : undefined}
        >
          <SupportingEvidenceCanvasSection
            evidence={props.supportingEvidence}
            editMode={props.editMode}
            isSelected={props.selectedSectionId === 'supporting-evidence'}
            editingField={editingField}
            editingText={editingText}
            onEditStart={function (evidenceId: string, currentValue: string) {
              startEditing({ type: 'supporting-evidence', evidenceId: evidenceId }, currentValue);
            }}
            onEditChange={function (text: string) { setEditingText(text); }}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            onRemoveEvidence={function (evidenceId: string) { handleRemoveItem('supporting-evidence', evidenceId); }}
          />
        </CanvasSectionWrapper>
      );
    }

    return null;
  }

  return (
    <div
      ref={scrollRefCallback}
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--p-bg)' }}
      data-testid="live-resume-canvas"
      onMouseOver={handleCanvasMouseOver}
      onMouseOut={handleCanvasMouseOut}
    >
      {/* PAGE-FIRST DOCUMENT LAYOUT: Each page in the PaginatedDocument
       * renders as a real DOM container with paper styling (background,
       * shadow, border). Content blocks are INSIDE their page surface,
       * not floating above absolute-positioned backgrounds.
       *
       * This ensures selection chrome, action bars, and callout anchors
       * are page-local by construction — nothing can visually cross a
       * page boundary because each page is its own isolated container.
       *
       * Pages are separated by workspace-background gaps with optional
       * "Page N" labels to reinforce the multi-page document metaphor.
       */}
      <div className="max-w-[820px] mx-auto px-10 py-8">
        <div
          ref={props.documentPanelRef}
          style={{
            /* Minimum height so the document feels substantial even with
             * sparse content — avoids the "empty card" perception. */
            minHeight: '600px',
          }}
          data-testid="resume-document-panel"
        >
          {paginatedDoc.pages.map(function (page: DocumentPage) {
            /* Group consecutive blocks by sectionId so related blocks
             * (e.g. multiple experience entries) share one wrapper. */
            const groups = groupBlocksBySectionId(page.blocks);

            return (
              <div key={'page-' + page.pageNumber}>
                {/* PAGE BOUNDARY LABEL — shown between pages (not before
                 * page 1). Sits in the workspace-background gap. */}
                {page.pageNumber > 1 && (
                  <div
                    className="flex items-center justify-center"
                    style={{
                      height: PAGE_GAP_PX + 'px',
                      background: 'var(--p-bg)',
                    }}
                    data-testid={'page-boundary-spacer-' + page.pageNumber}
                    aria-label={'Page ' + page.pageNumber + ' begins here'}
                  >
                    <span
                      className="px-3 py-0.5 rounded text-[9px] font-semibold"
                      style={{
                        background: 'var(--p-bg)',
                        color: 'var(--p-accent)',
                        border: '1px solid color-mix(in srgb, var(--p-accent) 25%, transparent)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Page {page.pageNumber}
                    </span>
                  </div>
                )}

                {/* PAGE SURFACE — real container for this page's content.
                 * All section wrappers, selection chrome, action bars, and
                 * anchors are INSIDE this surface, preventing any visual
                 * element from crossing a page boundary. */}
                <div
                  className="rounded-lg"
                  style={{
                    minHeight: PAGE_HEIGHT_PX + 'px',
                    background: 'var(--p-surface)',
                    border: '1px solid var(--p-border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
                    padding: '2.5rem 3rem',
                    /* TEXT WRAPPING PARITY: Ensures all text content within
                     * the page surface wraps correctly. overflow-wrap is
                     * inherited, so all descendant text elements (summary,
                     * bullets, skills, evidence) benefit from this rule.
                     * Prevents long unbroken words or URLs from overflowing
                     * the page surface boundary. */
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                  } as React.CSSProperties}
                  data-testid={'page-surface-' + page.pageNumber}
                  data-page-number={page.pageNumber}
                >
                  {groups.map(function (group: BlockGroup, groupIdx: number) {
                    return (
                      <div key={group.sectionId + '-' + groupIdx}>
                        {renderBlockGroup(group, page.pageNumber)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: section-specific "Add" label for action chip bar
// ---------------------------------------------------------------------------

/**
 * Returns a section-specific add-action label instead of a generic
 * "Add here". Each section gets a clear verb so the user knows what
 * the button creates. Falls back to "Add" for sections where item
 * addition is not meaningful (e.g. contact, federal-details).
 */
function getSectionAddLabel(sectionId: string): string {
  if (sectionId === 'experience') return 'Add Job';
  if (sectionId === 'education') return 'Add Education';
  if (sectionId === 'certifications') return 'Add Certification';
  if (sectionId === 'skills') return 'Add Skill';
  if (sectionId === 'supporting-evidence') return 'Add Evidence';
  return 'Add';
}

// ---------------------------------------------------------------------------
// Sub-component: Section wrapper — handles selection, actions, anchoring
// ---------------------------------------------------------------------------

/**
 * CanvasSectionWrapper wraps each resume section with:
 *   - selection highlighting (accent left border + tinted background)
 *   - hover feedback (explicit useState tracking per interaction standard)
 *   - action chip bar when selected (Edit, Strengthen, Compress, Add)
 *   - anchor registration for the callout layer
 *   - keyboard reachability (tabIndex, Enter/Space handling)
 */
function CanvasSectionWrapper(props: {
  sectionId: string;
  isSelected: boolean;
  isEditReady: boolean;
  /** When true, the section has no content. The action bar hides Edit
   * and emphasizes Add so the user sees the correct primary action. */
  isEmpty?: boolean;
  onClick: (sectionId: string) => void;
  onAnchorRegister: (registration: AnchorRegistration, ref: React.RefObject<HTMLElement | null>) => void;
  onSectionAction: (sectionId: string, action: string) => void;
  testId: string;
  /** Optional suffix appended to the anchor registration ID to make
   *  it unique when the same section appears on multiple pages.
   *  Example: "-p2" for a section continuation on page 2. */
  anchorIdSuffix?: string;
  children: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  /*
   * Register this section as an anchor point on mount. The anchor
   * registration tells the callout system: "this DOM region belongs
   * to section X, supports annotation types Y, and has priority Z."
   */
  useEffect(function () {
    const allowedAnnotations: AnnotationType[] = ['evidence', 'alignment', 'compression'];
    /* Anchor ID includes an optional page suffix so that the same section
     * appearing on multiple pages (e.g. experience spanning page 1 and 2)
     * registers distinct anchor IDs. The primary anchor (no suffix) is
     * on the first page; continuation anchors have "-p2", "-p3", etc. */
    const anchorSuffix = props.anchorIdSuffix ? props.anchorIdSuffix : '';
    const registration: AnchorRegistration = {
      id: props.sectionId + '-section-0' + anchorSuffix,
      kind: 'section',
      owningSection: props.sectionId as AnchorSectionId,
      allowedAnnotations: allowedAnnotations,
      priority: anchorSuffix ? 5 : 10,
    };
    props.onAnchorRegister(registration, sectionRef as React.RefObject<HTMLElement | null>);
  }, [props.sectionId, props.anchorIdSuffix]); /* eslint-disable-line react-hooks/exhaustive-deps -- registration only needed once per section mount */

  /* DOCUMENT-FIRST VISUAL HIERARCHY:
   *
   * View mode (isEditReady=false):
   *   Selected section gets a quiet accent left border and very subtle
   *   tint. The document looks polished and readable — like a real resume.
   *   No action chips are shown. Hover gives a faint feedback tint.
   *
   * Edit-ready mode (isEditReady=true):
   *   Selected section gets a stronger accent border and a slightly more
   *   prominent tint. Action chips appear. The user understands that this
   *   section is ready for direct editing. Non-selected sections still look
   *   like the polished document — only the active region is "activated."
   */
  const isSelectedAndEditable = props.isSelected && props.isEditReady;

  let bgColor = 'transparent';
  if (isSelectedAndEditable) {
    bgColor = 'color-mix(in srgb, var(--p-accent) 7%, transparent)';
  } else if (props.isSelected) {
    bgColor = 'color-mix(in srgb, var(--p-accent) 4%, transparent)';
  } else if (isHovered) {
    bgColor = 'color-mix(in srgb, var(--p-text-dim) 4%, transparent)';
  }

  /* Border treatment: in edit-ready mode, selected section gets a slightly
   * thicker accent bar. In view mode, a thinner quiet accent line. */
  let borderStyle = '3px solid transparent';
  if (isSelectedAndEditable) {
    borderStyle = '3px solid var(--p-accent)';
  } else if (props.isSelected) {
    borderStyle = '2px solid color-mix(in srgb, var(--p-accent) 50%, transparent)';
  }

  return (
    <div
      ref={sectionRef}
      className="relative py-2 cursor-pointer rounded-sm"
      style={{
        borderLeft: borderStyle,
        paddingLeft: props.isSelected ? '12px' : '15px',
        background: bgColor,
        transition: 'border-color 0.2s ease, padding-left 0.2s ease, background 0.15s ease',
        borderRadius: '2px',
      }}
      onClick={function () { props.onClick(props.sectionId); }}
      onKeyDown={function (e: React.KeyboardEvent) {
        /* Only handle Space/Enter when the keydown originated on
         * THIS wrapper element (not a child input/textarea).
         * This prevents stealing Space from inline editors and
         * other child interactive elements. */
        if ((e.key === 'Enter' || e.key === ' ') && e.target === sectionRef.current) {
          e.preventDefault();
          props.onClick(props.sectionId);
        }
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      role="button"
      tabIndex={0}
      aria-label={'Select ' + props.sectionId + ' section'}
      data-testid={props.testId}
      data-section-id={props.sectionId}
      data-selected={props.isSelected ? 'true' : 'false'}
      data-edit-ready={isSelectedAndEditable ? 'true' : 'false'}
    >
      {props.children}

      {/* Action chip bar — appears ONLY when the section is selected AND
       * edit-ready mode is active. In view mode, the document looks clean
       * without action clutter. Chips provide quick actions directly on the
       * document region so the selected section feels actionable.
       *
       * Chips: Edit, Strengthen (evidence), Compress, Add here
       * Each chip calls the parent's onSectionAction callback. */}
      {/* ACTION CHIP BAR — context-sensitive based on section emptiness.
       * Empty sections hide Edit/Strengthen/Compress (which are meaningless
       * without content) and show only Add as the emphasized primary action.
       * Sections with content show the full chip set. */}
      {isSelectedAndEditable && (
        <div
          className="flex items-center gap-2 mt-2.5 pt-2"
          style={{
            borderTop: '1px solid color-mix(in srgb, var(--p-accent) 15%, transparent)',
          }}
          data-testid={'section-action-bar-' + props.sectionId}
        >
          {!props.isEmpty && (
            <ActionChip
              label="Edit"
              icon={<Pencil className="w-3 h-3" />}
              onClick={function (e: React.MouseEvent) {
                e.stopPropagation();
                props.onSectionAction(props.sectionId, 'edit');
              }}
              testId={'action-chip-edit-' + props.sectionId}
            />
          )}
          {!props.isEmpty && (
            <ActionChip
              label="Strengthen"
              icon={<Sparkles className="w-3 h-3" />}
              onClick={function (e: React.MouseEvent) {
                e.stopPropagation();
                props.onSectionAction(props.sectionId, 'strengthen');
              }}
              testId={'action-chip-strengthen-' + props.sectionId}
            />
          )}
          {!props.isEmpty && (
            <ActionChip
              label="Compress"
              icon={<Shrink className="w-3 h-3" />}
              onClick={function (e: React.MouseEvent) {
                e.stopPropagation();
                props.onSectionAction(props.sectionId, 'compress');
              }}
              testId={'action-chip-compress-' + props.sectionId}
            />
          )}
          <ActionChip
            label={getSectionAddLabel(props.sectionId)}
            icon={<Plus className="w-3 h-3" />}
            onClick={function (e: React.MouseEvent) {
              e.stopPropagation();
              props.onSectionAction(props.sectionId, 'add');
            }}
            testId={'action-chip-add-' + props.sectionId}
            emphasized={props.isEmpty}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Action chip — compact inline action button
// ---------------------------------------------------------------------------

/**
 * Small action button rendered in the selected-section action bar.
 * Uses PathOS theme tokens for consistent styling with explicit hover
 * and active/pressed state tracking. The chip is compact — it must
 * not compete with the document content for visual attention.
 *
 * INTERACTION STATES (per interaction-state standard):
 *   hover:         background intensifies, border becomes more opaque
 *   focus-visible: ring-2 ring accent (keyboard only)
 *   active/pressed: slight scale reduction + opacity shift to confirm click
 *   pointer:       cursor: pointer always
 */
function ActionChip(props: {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  testId: string;
  /** When true, the chip uses a stronger accent fill to signal it is
   * the primary/only action (used for Add on empty sections). */
  emphasized?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  /* Compute background intensity based on interaction state and emphasis.
   * Emphasized chips (empty-section Add) use a solid accent fill.
   * Pressed wins over hover — pressed is the strongest visual. */
  let chipBg = props.emphasized
    ? 'color-mix(in srgb, var(--p-accent) 20%, transparent)'
    : 'color-mix(in srgb, var(--p-accent) 8%, transparent)';
  let chipBorder = props.emphasized
    ? '1px solid color-mix(in srgb, var(--p-accent) 50%, transparent)'
    : '1px solid color-mix(in srgb, var(--p-accent) 20%, transparent)';
  if (isPressed) {
    chipBg = 'color-mix(in srgb, var(--p-accent) 30%, transparent)';
    chipBorder = '1px solid color-mix(in srgb, var(--p-accent) 50%, transparent)';
  } else if (isHovered) {
    chipBg = props.emphasized
      ? 'color-mix(in srgb, var(--p-accent) 28%, transparent)'
      : 'color-mix(in srgb, var(--p-accent) 14%, transparent)';
    chipBorder = '1px solid color-mix(in srgb, var(--p-accent) 40%, transparent)';
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        color: 'var(--p-accent)',
        background: chipBg,
        border: chipBorder,
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.1s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={function () { setIsPressed(true); }}
      onMouseUp={function () { setIsPressed(false); }}
      onKeyDown={function (e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick(e as unknown as React.MouseEvent);
        }
      }}
      aria-label={props.label}
      data-testid={props.testId}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Inline editor — shared textarea/input for editing
// ---------------------------------------------------------------------------

/**
 * InlineEditor replaces static content when the user clicks to edit.
 * Supports both single-line (input) and multi-line (textarea) modes.
 * Save is triggered by Ctrl+Enter or clicking the check button.
 * Cancel is triggered by Escape or clicking the X button.
 *
 * The editor is styled to blend with the document — it should feel
 * like editing the resume directly, not like opening a dialog.
 */
function InlineEditor(props: {
  value: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  multiline?: boolean;
  placeholder?: string;
  testId: string;
  /** Subtle format guidance shown below the input (e.g. phone format hint).
   *  Keeps the editing experience low-friction while guiding the user
   *  toward consistent, trustworthy contact information. */
  hint?: string;
  /** Inline validation message shown when the current value has issues.
   *  Uses a subtle amber style — not loud error red — to match the
   *  document-calm aesthetic. Only shown when non-empty. */
  validationMessage?: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isMultiline = props.multiline !== undefined ? props.multiline : false;

  /* Auto-focus the editor when it mounts so the user can start typing
   * immediately without a second click. */
  useEffect(function () {
    if (inputRef.current) {
      inputRef.current.focus();
      /* Place cursor at end of text */
      const len = props.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, []); /* eslint-disable-line react-hooks/exhaustive-deps -- focus on mount only */

  /**
   * Handle keyboard shortcuts within the editor:
   *   Ctrl+Enter or Meta+Enter → save
   *   Escape → cancel
   *   Enter (single-line mode) → save
   *   All other keys → stop propagation so parent handlers
   *     (e.g. CanvasSectionWrapper Space/Enter) do not steal
   *     normal editing keystrokes like Space.
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    /* CRITICAL: Always stop propagation from the inline editor so
     * parent containers (CanvasSectionWrapper, ActionChip, etc.)
     * cannot intercept normal text-editing keystrokes. Without this,
     * pressing Space inside the editor would bubble up and trigger
     * the section's role="button" Space handler, exiting editing. */
    e.stopPropagation();

    if (e.key === 'Escape') {
      e.preventDefault();
      props.onCancel();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      props.onSave();
      return;
    }
    if (e.key === 'Enter' && !isMultiline) {
      e.preventDefault();
      props.onSave();
      return;
    }
  }

  return (
    <div
      className="relative"
      onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}
      data-testid={props.testId}
    >
      <textarea
        ref={inputRef}
        value={props.value}
        onChange={function (e: React.ChangeEvent<HTMLTextAreaElement>) {
          props.onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        className="w-full text-xs leading-relaxed rounded-sm resize-none outline-none"
        style={{
          /* DOCUMENT-NATIVE FEEL: The inline editor uses a very subtle
           * accent-tinted background and matching border so it blends
           * with the resume document rather than feeling like a detached
           * modal or form element. The font inherits from the document. */
          color: 'var(--p-text)',
          background: 'color-mix(in srgb, var(--p-accent) 4%, var(--p-surface))',
          border: '1.5px solid var(--p-accent)',
          padding: '8px 10px',
          minHeight: isMultiline ? '80px' : '34px',
          fontFamily: 'inherit',
          boxShadow: '0 0 0 2px color-mix(in srgb, var(--p-accent) 10%, transparent)',
          transition: 'box-shadow 0.15s ease',
        }}
        placeholder={props.placeholder || 'Type here...'}
        rows={isMultiline ? 4 : 1}
        data-testid={props.testId + '-input'}
      />

      {/* Inline validation warning — shown when the current value has
       * issues that the user should address. Uses subtle amber styling
       * to stay calm and informational rather than alarming. */}
      {props.validationMessage && (
        <div
          className="text-[10px] mt-1 px-1"
          style={{ color: 'var(--p-warning, #eab308)' }}
          data-testid={props.testId + '-validation'}
        >
          {props.validationMessage}
        </div>
      )}

      {/* Format guidance hint — shows expected format for structured fields
       * like phone numbers. Always visible when provided, not conditional
       * on validation state, so the user sees guidance before typing. */}
      {props.hint && !props.validationMessage && (
        <div
          className="text-[10px] mt-1 px-1"
          style={{ color: 'var(--p-text-dim)' }}
          data-testid={props.testId + '-hint'}
        >
          {props.hint}
        </div>
      )}

      {/* Save/Cancel button row — compact controls below the editor.
       * Uses PathOS theme tokens for consistent styling. Both buttons
       * have hover brightening and active/pressed feedback per the
       * interaction-state standard. */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <InlineEditorButton
          label="Save"
          icon={<Check className="w-3 h-3" />}
          variant="primary"
          onClick={function (e: React.MouseEvent) {
            e.stopPropagation();
            props.onSave();
          }}
          testId={props.testId + '-save'}
        />
        <InlineEditorButton
          label="Cancel"
          icon={<X className="w-3 h-3" />}
          variant="secondary"
          onClick={function (e: React.MouseEvent) {
            e.stopPropagation();
            props.onCancel();
          }}
          testId={props.testId + '-cancel'}
        />
        <span
          className="text-[9px] ml-auto"
          style={{ color: 'var(--p-text-dim)' }}
        >
          Ctrl+Enter to save · Esc to cancel
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Inline editor button — with explicit hover/active states
// ---------------------------------------------------------------------------

/**
 * Button used inside the InlineEditor save/cancel row. Provides explicit
 * hover and active/pressed feedback per the interaction-state standard.
 * Two variants:
 *   primary:   accent fill with white text (Save button)
 *   secondary: transparent with border (Cancel button)
 */
function InlineEditorButton(props: {
  label: string;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary';
  onClick: (e: React.MouseEvent) => void;
  testId: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isPrimary = props.variant === 'primary';

  /* Compute styles based on variant + interaction state */
  let bgColor: string;
  let textColor: string;
  let borderColor: string;

  if (isPrimary) {
    bgColor = 'var(--p-accent)';
    textColor = '#ffffff';
    borderColor = 'var(--p-accent)';
    if (isPressed) {
      bgColor = 'color-mix(in srgb, var(--p-accent) 85%, black)';
    } else if (isHovered) {
      bgColor = 'color-mix(in srgb, var(--p-accent) 90%, black)';
    }
  } else {
    bgColor = 'transparent';
    textColor = 'var(--p-text-muted)';
    borderColor = 'var(--p-border)';
    if (isPressed) {
      bgColor = 'color-mix(in srgb, var(--p-text-dim) 12%, transparent)';
    } else if (isHovered) {
      bgColor = 'color-mix(in srgb, var(--p-text-dim) 8%, transparent)';
    }
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        color: textColor,
        background: bgColor,
        border: '1px solid ' + borderColor,
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'background 0.12s ease, transform 0.1s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={function () { setIsPressed(true); }}
      onMouseUp={function () { setIsPressed(false); }}
      aria-label={props.label}
      data-testid={props.testId}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Contact / Header section
// ---------------------------------------------------------------------------

/**
 * Contact / Header section with inline editing support. Each contact
 * field is individually click-to-edit when the section is selected.
 * This enables direct editing of the resume header without leaving
 * the document-centered workflow.
 */
function ContactCanvasSection(props: {
  draft: ResumeDraft;
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onFieldEditStart: (fieldName: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const contact = props.draft.contact;

  /* Helper: check if a specific contact field is currently being edited */
  function isFieldEditing(fieldName: string): boolean {
    return (
      props.editingField !== null
      && props.editingField.type === 'contact-field'
      && props.editingField.fieldName === fieldName
    );
  }

  /* ---- Email validation ---- */
  /* Basic shape check: something@something.something. Not a full RFC
   * validation — just enough to catch obvious typos and encourage a
   * real address. The regex is intentionally permissive because many
   * valid email addresses look "weird" to strict patterns. */
  function getEmailValidation(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) return '';
    const atIdx = trimmed.indexOf('@');
    if (atIdx < 1) return 'Should include @ (e.g. name@agency.gov)';
    const domain = trimmed.substring(atIdx + 1);
    if (domain.indexOf('.') < 1) return 'Domain should include a dot (e.g. agency.gov)';
    if (trimmed !== text) return 'Extra whitespace will be trimmed on save';
    return '';
  }

  /* ---- Phone format guidance ---- */
  /* Validates that the phone value looks like a US phone number.
   * Accepts various formats and guides toward the consistent
   * (xxx) xxx-xxxx display format used in federal resumes. */
  function getPhoneValidation(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) return '';
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (digitsOnly.length < 10) return 'Enter a 10-digit phone number';
    if (digitsOnly.length > 11) return 'Phone number seems too long';
    return '';
  }

  /* Compute live validation for the field currently being edited */
  const emailValidation = isFieldEditing('email') ? getEmailValidation(props.editingText) : '';
  const phoneValidation = isFieldEditing('phone') ? getPhoneValidation(props.editingText) : '';

  /* Persistent validation indicators for saved values — show a subtle
   * warning icon next to email/phone when the saved value looks wrong.
   * This gives the user visual feedback without blocking their workflow. */
  const savedEmailLooksWrong = contact.email
    && contact.email.trim().length > 0
    && (contact.email.indexOf('@') < 1 || contact.email.substring(contact.email.indexOf('@') + 1).indexOf('.') < 1);
  const savedPhoneDigits = contact.phone ? contact.phone.replace(/[^0-9]/g, '') : '';
  const savedPhoneLooksWrong = contact.phone
    && contact.phone.trim().length > 0
    && (savedPhoneDigits.length < 10 || savedPhoneDigits.length > 11);

  return (
    <div
      className="text-center mb-4"
      data-testid="canvas-contact-header"
      data-callout-anchor="contact-header"
    >
      {/* Name — editable */}
      {isFieldEditing('fullName') ? (
        <div className="mb-1" onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
          <InlineEditor
            value={props.editingText}
            onChange={props.onEditChange}
            onSave={props.onEditSave}
            onCancel={props.onEditCancel}
            multiline={false}
            placeholder="Full name..."
            testId="inline-editor-contact-fullName"
          />
        </div>
      ) : (
        <ContactEditableField
          value={contact.fullName || 'Your Name'}
          isSelected={props.isSelected}
          onEditStart={function () { props.onFieldEditStart('fullName', contact.fullName); }}
          className="text-lg font-bold mb-1"
          style={{ color: 'var(--p-text)' }}
          testId="contact-field-fullName"
        />
      )}

      {/* Contact details row — email, phone, location */}
      <div
        className="text-xs flex items-center justify-center gap-2 flex-wrap"
        style={{ color: 'var(--p-text-muted)' }}
      >
        {isFieldEditing('email') ? (
          <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
            <InlineEditor
              value={props.editingText}
              onChange={props.onEditChange}
              onSave={props.onEditSave}
              onCancel={props.onEditCancel}
              multiline={false}
              placeholder="name@agency.gov"
              testId="inline-editor-contact-email"
              hint="e.g. jane.doe@agency.gov"
              validationMessage={emailValidation}
            />
          </span>
        ) : (
          <ContactEditableField
            value={contact.email || 'Add email'}
            isSelected={props.isSelected}
            onEditStart={function () { props.onFieldEditStart('email', contact.email); }}
            style={{ color: contact.email ? 'var(--p-text-muted)' : 'var(--p-text-dim)' }}
            testId="contact-field-email"
            warningIndicator={savedEmailLooksWrong ? true : false}
          />
        )}

        {isFieldEditing('phone') ? (
          <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
            <InlineEditor
              value={props.editingText}
              onChange={props.onEditChange}
              onSave={props.onEditSave}
              onCancel={props.onEditCancel}
              multiline={false}
              placeholder="(555) 555-1234"
              testId="inline-editor-contact-phone"
              hint="Format: (555) 555-1234"
              validationMessage={phoneValidation}
            />
          </span>
        ) : (
          <ContactEditableField
            value={contact.phone || 'Add phone'}
            isSelected={props.isSelected}
            onEditStart={function () { props.onFieldEditStart('phone', contact.phone); }}
            style={{ color: contact.phone ? 'var(--p-text-muted)' : 'var(--p-text-dim)' }}
            testId="contact-field-phone"
            warningIndicator={savedPhoneLooksWrong ? true : false}
          />
        )}

        {isFieldEditing('location') ? (
          <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
            <InlineEditor
              value={props.editingText}
              onChange={props.onEditChange}
              onSave={props.onEditSave}
              onCancel={props.onEditCancel}
              multiline={false}
              placeholder="City, State..."
              testId="inline-editor-contact-location"
            />
          </span>
        ) : (
          <ContactEditableField
            value={(contact.city || contact.state) ? (contact.city + (contact.city && contact.state ? ', ' : '') + contact.state) : 'Add location'}
            isSelected={props.isSelected}
            onEditStart={function () { props.onFieldEditStart('location', contact.city + (contact.city && contact.state ? ', ' : '') + contact.state); }}
            style={{ color: (contact.city || contact.state) ? 'var(--p-text-muted)' : 'var(--p-text-dim)' }}
            testId="contact-field-location"
          />
        )}
      </div>

      {/* Citizenship and eligibility row — now fully editable inline.
       * Each field (citizenship, veteran status) can be clicked to edit
       * when the contact section is selected, matching the name/email/
       * phone/location editing pattern above. */}
      <div
        className="text-[10px] mt-1 flex items-center justify-center gap-1.5 flex-wrap"
        style={{ color: 'var(--p-text-dim)' }}
        data-callout-anchor="contact-citizenship"
      >
        {/* CITIZENSHIP — editable */}
        {isFieldEditing('citizenship') ? (
          <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
            <InlineEditor
              value={props.editingText}
              onChange={props.onEditChange}
              onSave={props.onEditSave}
              onCancel={props.onEditCancel}
              multiline={false}
              placeholder="Citizenship status (e.g. U.S. Citizen)..."
              testId="inline-editor-contact-citizenship"
            />
          </span>
        ) : (
          <ContactEditableField
            value={contact.citizenship ? contact.citizenship : 'Add citizenship'}
            isSelected={props.isSelected}
            onEditStart={function () {
              props.onFieldEditStart('citizenship', contact.citizenship || '');
            }}
            style={{ color: 'var(--p-text-dim)', opacity: contact.citizenship ? 1 : 0.5 }}
            testId="contact-field-citizenship"
          />
        )}

        {(contact.citizenship || contact.veteranStatus) && (
          <span style={{ opacity: 0.4 }}>|</span>
        )}

        {/* VETERAN STATUS — editable */}
        {isFieldEditing('veteranStatus') ? (
          <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
            <InlineEditor
              value={props.editingText}
              onChange={props.onEditChange}
              onSave={props.onEditSave}
              onCancel={props.onEditCancel}
              multiline={false}
              placeholder="Veteran preference (e.g. 5-Point, 10-Point, N/A)..."
              testId="inline-editor-contact-veteranStatus"
            />
          </span>
        ) : (
          <ContactEditableField
            value={contact.veteranStatus && contact.veteranStatus !== 'N/A'
              ? 'Veteran Preference: ' + contact.veteranStatus
              : 'Add veteran status'}
            isSelected={props.isSelected}
            onEditStart={function () {
              const current = contact.veteranStatus && contact.veteranStatus !== 'N/A'
                ? contact.veteranStatus
                : '';
              props.onFieldEditStart('veteranStatus', current);
            }}
            style={{
              color: 'var(--p-text-dim)',
              opacity: contact.veteranStatus && contact.veteranStatus !== 'N/A' ? 1 : 0.5,
            }}
            testId="contact-field-veteranStatus"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Inline-editable contact field. Shows the value normally; highlights
 * on hover when the section is selected. Clicking starts editing.
 */
function ContactEditableField(props: {
  value: string;
  isSelected: boolean;
  onEditStart: () => void;
  className?: string;
  style?: React.CSSProperties;
  testId: string;
  /** When true, shows a subtle amber warning dot next to the value to
   *  indicate the saved value might need attention (e.g. malformed email
   *  or phone). The dot is small and non-intrusive — it invites review
   *  without blocking the user's workflow. */
  warningIndicator?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className={(props.className || '') + ' rounded-sm inline-block outline-none focus-visible:ring-2 focus-visible:ring-inset'}
      style={Object.assign({}, props.style || {}, {
        cursor: props.isSelected ? 'text' : 'default',
        background: isHovered && props.isSelected
          ? 'color-mix(in srgb, var(--p-accent) 6%, transparent)'
          : 'transparent',
        padding: '0 3px',
        transition: 'background 0.12s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties)}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        if (props.isSelected) {
          e.stopPropagation();
          props.onEditStart();
        }
      }}
      onKeyDown={function (e: React.KeyboardEvent) {
        if ((e.key === 'Enter' || e.key === ' ') && props.isSelected) {
          e.preventDefault();
          e.stopPropagation();
          props.onEditStart();
        }
      }}
      tabIndex={props.isSelected ? 0 : -1}
      role={props.isSelected ? 'button' : undefined}
      data-testid={props.testId}
    >
      {props.value}
      {props.warningIndicator && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full ml-1"
          style={{
            background: 'var(--p-warning, #eab308)',
            verticalAlign: 'middle',
            opacity: 0.7,
          }}
          title="This value may need review"
          data-testid={props.testId + '-warning'}
        />
      )}
      {isHovered && props.isSelected && (
        <Pencil
          className="inline-block w-2.5 h-2.5 ml-1"
          style={{ color: 'var(--p-accent)', opacity: 0.5, verticalAlign: 'middle' }}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Professional Summary — with inline editing
// ---------------------------------------------------------------------------

/**
 * Renders the professional summary section. When the section is selected
 * and the user clicks the summary text (or the empty placeholder), an
 * inline editor opens for direct editing. The editor replaces the static
 * text and provides save/cancel controls.
 */
function SummaryCanvasSection(props: {
  summary: string;
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const hasSummary = props.summary && props.summary.trim().length > 0;
  const [isHovered, setIsHovered] = useState(false);

  /* Check whether the summary field is currently being edited. */
  const isEditing = props.editingField !== null && props.editingField.type === 'summary';

  return (
    <div
      className="mb-4"
      data-testid="canvas-summary-section"
      data-callout-anchor="summary-text"
    >
      <SectionHeading label="Professional Summary" />

      {isEditing ? (
        /* Active editing state — show inline editor replacing the summary text. */
        <InlineEditor
          value={props.editingText}
          onChange={props.onEditChange}
          onSave={props.onEditSave}
          onCancel={props.onEditCancel}
          multiline={true}
          placeholder="Write your professional summary..."
          testId="inline-editor-summary"
        />
      ) : hasSummary ? (
        /* Display state — summary text with hover-to-edit affordance. */
        <div
          className="relative rounded-sm cursor-text"
          style={{
            background: isHovered && props.isSelected
              ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
              : 'transparent',
            transition: 'background 0.15s ease',
            padding: '4px 6px',
            margin: '-4px -6px',
          }}
          onMouseEnter={function () { setIsHovered(true); }}
          onMouseLeave={function () { setIsHovered(false); }}
          onClick={function (e: React.MouseEvent) {
            /* DIRECT EDITING: Clicking into editable content within a
             * selected section starts editing immediately. The old model
             * required both section selection AND a global edit-ready
             * toggle — too many steps for the core editing path. Now:
             * select section → click content → start editing. */
            if (props.isSelected) {
              e.stopPropagation();
              props.onEditStart();
            }
          }}
          data-testid="summary-editable-region"
        >
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--p-text)' }}
          >
            {props.summary}
          </p>
          {isHovered && props.isSelected && (
            <div
              className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, var(--p-accent) 12%, transparent)',
                color: 'var(--p-accent)',
              }}
            >
              <Pencil className="w-3 h-3" />
              <span className="text-[9px] font-medium">Click to edit</span>
            </div>
          )}
        </div>
      ) : (
        /* Empty state — placeholder that opens the editor when clicked.
         * Direct editing: starts on click when section is selected. */
        <EmptyPlaceholder
          label="Click to add professional summary"
          onClick={function () {
            if (props.isSelected) {
              props.onEditStart();
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Work Experience — with inline bullet editing
// ---------------------------------------------------------------------------

/**
 * Renders work experience entries with editable subfields and bullets.
 *
 * EDITABILITY MODEL: When the experience section is selected, ALL key
 * subfields become directly editable — not just bullets. This is a
 * major workflow improvement: the user can click any of these fields
 * to enter inline editing mode:
 *   - Job title
 *   - Employer / agency
 *   - Date range (start – end)
 *   - Hours per week
 *   - Individual bullet descriptions
 *
 * The editing affordance (hover highlight + pencil icon) appears on hover
 * so the user always knows which fields are editable. The resume still
 * LOOKS like a resume first — edit affordances are subtle until hover.
 */
function ExperienceCanvasSection(props: {
  experience: ResumeDraft['experience'];
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  /** Whether to show the "Work Experience" section heading. Defaults to
   *  true. Set to false for continuation blocks on subsequent pages where
   *  the heading already appeared on the previous page. */
  showHeader?: boolean;
  onBulletEditStart: (expId: string, bulletIdx: number, text: string) => void;
  onFieldEditStart: (expId: string, fieldName: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRemoveJob?: (expId: string) => void;
  onRemoveBullet?: (expId: string, bulletIdx: number) => void;
  onAddBullet?: (expId: string) => void;
}) {
  /* Helper: check if a specific experience subfield is currently editing */
  function isExpFieldEditing(expId: string, fieldName: string): boolean {
    return (
      props.editingField !== null
      && props.editingField.type === 'experience-field'
      && props.editingField.experienceId === expId
      && props.editingField.fieldName === fieldName
    );
  }

  /* showHeader defaults to true when not provided, preserving backward
   * compatibility. When false (experience continuation on page 2+), the
   * heading is replaced with a "(continued)" label. */
  const shouldShowHeader = props.showHeader !== false;

  return (
    <div className="mb-4" data-testid="canvas-experience-section" data-callout-anchor="experience-section-anchor">
      {shouldShowHeader ? (
        <SectionHeading label="Work Experience" />
      ) : (
        <SectionHeading label="Work Experience (continued)" />
      )}
      {props.experience.length === 0 ? (
        <EmptyPlaceholder label="Add work experience" />
      ) : (
        props.experience.map(function (exp) {
          /* Split duties into individual bullets for display */
          const dutyLines: string[] = [];
          if (exp.duties) {
            const rawLines = exp.duties.split('\n');
            for (let i = 0; i < rawLines.length; i++) {
              const trimmed = rawLines[i].replace(/^[•\-*]\s*/, '').trim();
              if (trimmed) {
                dutyLines.push(trimmed);
              }
            }
          }

          return (
            <div key={exp.id} className="mb-3 relative" data-testid={'canvas-experience-' + exp.id}>
              {/* JOB TITLE — editable subfield
               * The remove-job button lives inside this flex row (after
               * the date) so it never overlaps dates or content. Previously
               * it was absolutely positioned at -right-1 -top-0.5 which
               * covered the date range text. */}
              <div className="flex items-baseline justify-between mb-0.5 gap-1">
                {isExpFieldEditing(exp.id, 'jobTitle') ? (
                  <div className="flex-1 mr-2" onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
                    <InlineEditor
                      value={props.editingText}
                      onChange={props.onEditChange}
                      onSave={props.onEditSave}
                      onCancel={props.onEditCancel}
                      multiline={false}
                      placeholder="Job title..."
                      testId={'inline-editor-exp-title-' + exp.id}
                    />
                  </div>
                ) : (
                  <ExperienceEditableField
                    value={exp.jobTitle || 'Add job title'}
                    isEmpty={!exp.jobTitle}
                    isSelected={props.isSelected}
                    onEditStart={function () { props.onFieldEditStart(exp.id, 'jobTitle', exp.jobTitle || ''); }}
                    className="text-xs font-bold"
                    style={{ color: 'var(--p-text)' }}
                    testId={'exp-field-title-' + exp.id}
                    anchorId={'experience-title-' + exp.id}
                  />
                )}

                {/* DATE RANGE — split into Start Date and End Date for
                 * intuitive left-to-right editing. Previously a single
                 * combined field where the cursor started after the dash,
                 * making editing confusing. Now each part is independent. */}
                <div
                  className="flex items-baseline gap-0.5 text-[10px] flex-shrink-0"
                  style={{ color: 'var(--p-text-muted)' }}
                  data-testid={'exp-dates-row-' + exp.id}
                >
                  {/* START DATE */}
                  {isExpFieldEditing(exp.id, 'startDate') ? (
                    <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }} style={{ minWidth: '60px' }}>
                      <InlineEditor
                        value={props.editingText}
                        onChange={props.onEditChange}
                        onSave={props.onEditSave}
                        onCancel={props.onEditCancel}
                        multiline={false}
                        placeholder="Start date..."
                        testId={'inline-editor-exp-startDate-' + exp.id}
                      />
                    </span>
                  ) : (
                    <ExperienceEditableField
                      value={exp.startDate || 'Start'}
                      isEmpty={!exp.startDate}
                      isSelected={props.isSelected}
                      onEditStart={function () { props.onFieldEditStart(exp.id, 'startDate', exp.startDate || ''); }}
                      style={{ color: 'var(--p-text-muted)' }}
                      testId={'exp-field-startDate-' + exp.id}
                      anchorId={'experience-startDate-' + exp.id}
                    />
                  )}

                  <span style={{ color: 'var(--p-text-dim)' }}>{'\u2013'}</span>

                  {/* END DATE */}
                  {isExpFieldEditing(exp.id, 'endDate') ? (
                    <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }} style={{ minWidth: '60px' }}>
                      <InlineEditor
                        value={props.editingText}
                        onChange={props.onEditChange}
                        onSave={props.onEditSave}
                        onCancel={props.onEditCancel}
                        multiline={false}
                        placeholder="End date..."
                        testId={'inline-editor-exp-endDate-' + exp.id}
                      />
                    </span>
                  ) : (
                    <ExperienceEditableField
                      value={exp.endDate || 'End'}
                      isEmpty={!exp.endDate}
                      isSelected={props.isSelected}
                      onEditStart={function () { props.onFieldEditStart(exp.id, 'endDate', exp.endDate || ''); }}
                      style={{ color: 'var(--p-text-muted)' }}
                      testId={'exp-field-endDate-' + exp.id}
                      anchorId={'experience-endDate-' + exp.id}
                    />
                  )}
                </div>

                {/* Remove job button — in-flow at end of title row so it
                 * never overlaps dates or content. Visible only in edit
                 * mode when the experience section is selected. */}
                {props.editMode && props.isSelected && props.onRemoveJob && (
                  <button
                    type="button"
                    onClick={function (e: React.MouseEvent) {
                      e.stopPropagation();
                      if (props.onRemoveJob) props.onRemoveJob(exp.id);
                    }}
                    className={'flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                    style={{
                      color: 'var(--p-danger, #ef4444)',
                      background: 'color-mix(in srgb, var(--p-danger, #ef4444) 8%, transparent)',
                      '--tw-ring-color': 'var(--p-accent)',
                      fontSize: '10px',
                    } as React.CSSProperties}
                    aria-label={'Remove job: ' + (exp.jobTitle || 'untitled')}
                    title="Remove this job entry"
                    data-testid={'remove-job-' + exp.id}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* EMPLOYER & DETAILS ROW — employer, location, grade, hours */}
              <div
                className="text-[10px] mb-1 flex items-center flex-wrap gap-x-1"
                style={{ color: 'var(--p-text-muted)' }}
              >
                {/* EMPLOYER — editable subfield */}
                {isExpFieldEditing(exp.id, 'employer') ? (
                  <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
                    <InlineEditor
                      value={props.editingText}
                      onChange={props.onEditChange}
                      onSave={props.onEditSave}
                      onCancel={props.onEditCancel}
                      multiline={false}
                      placeholder="Employer / agency..."
                      testId={'inline-editor-exp-employer-' + exp.id}
                    />
                  </span>
                ) : (
                  <ExperienceEditableField
                    value={exp.employer || 'Add employer'}
                    isEmpty={!exp.employer}
                    isSelected={props.isSelected}
                    onEditStart={function () { props.onFieldEditStart(exp.id, 'employer', exp.employer || ''); }}
                    style={{ color: 'var(--p-text-muted)' }}
                    testId={'exp-field-employer-' + exp.id}
                    anchorId={'experience-employer-' + exp.id}
                  />
                )}

                {exp.location ? <span>| {exp.location}</span> : null}
                {exp.grade ? <span>| {exp.grade}</span> : null}

                {/* HOURS PER WEEK — editable subfield */}
                {isExpFieldEditing(exp.id, 'hoursPerWeek') ? (
                  <span onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
                    <span>| </span>
                    <InlineEditor
                      value={props.editingText}
                      onChange={props.onEditChange}
                      onSave={props.onEditSave}
                      onCancel={props.onEditCancel}
                      multiline={false}
                      placeholder="Hours per week..."
                      testId={'inline-editor-exp-hours-' + exp.id}
                    />
                  </span>
                ) : (
                  <span>
                    <span>| </span>
                    <ExperienceEditableField
                      value={exp.hoursPerWeek ? exp.hoursPerWeek + ' hrs/week' : 'Add hours'}
                      isEmpty={!exp.hoursPerWeek}
                      isSelected={props.isSelected}
                      onEditStart={function () { props.onFieldEditStart(exp.id, 'hoursPerWeek', exp.hoursPerWeek ? String(exp.hoursPerWeek) : ''); }}
                      style={{ color: 'var(--p-text-muted)' }}
                      testId={'exp-field-hours-' + exp.id}
                      anchorId={'experience-hours-' + exp.id}
                    />
                  </span>
                )}
              </div>

              {/* BULLET DESCRIPTIONS — editable + removable */}
              <ul className="list-none pl-0">
                {dutyLines.map(function (line, idx) {
                  return (
                    <div key={exp.id + '-bullet-' + idx} className="flex items-start gap-1">
                      <div className="flex-1">
                        <EditableBulletItem
                          text={line}
                          testId={'canvas-bullet-' + exp.id + '-' + idx}
                          editMode={props.editMode}
                          isSelected={props.isSelected}
                          isEditing={
                            props.editingField !== null
                            && props.editingField.type === 'bullet'
                            && props.editingField.experienceId === exp.id
                            && props.editingField.bulletIndex === idx
                          }
                          editingText={props.editingText}
                          onEditStart={function () {
                            props.onBulletEditStart(exp.id, idx, line);
                          }}
                          onEditChange={props.onEditChange}
                          onEditSave={props.onEditSave}
                          onEditCancel={props.onEditCancel}
                        />
                      </div>
                      {props.editMode && props.isSelected && props.onRemoveBullet && (
                        <button
                          type="button"
                          onClick={function (e: React.MouseEvent) {
                            e.stopPropagation();
                            if (props.onRemoveBullet) props.onRemoveBullet(exp.id, idx);
                          }}
                          className={'flex-shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                          style={{
                            color: 'var(--p-text-dim)',
                            '--tw-ring-color': 'var(--p-accent)',
                          } as React.CSSProperties}
                          aria-label="Remove bullet"
                          title="Remove this bullet"
                          data-testid={'remove-bullet-' + exp.id + '-' + idx}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </ul>
              {/* Add Bullet button — quick path to add a new duty line */}
              {props.editMode && props.isSelected && props.onAddBullet && (
                <button
                  type="button"
                  onClick={function (e: React.MouseEvent) {
                    e.stopPropagation();
                    if (props.onAddBullet) props.onAddBullet(exp.id);
                  }}
                  className={'inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                  style={{
                    color: 'var(--p-accent)',
                    background: 'color-mix(in srgb, var(--p-accent) 5%, transparent)',
                    '--tw-ring-color': 'var(--p-accent)',
                  } as React.CSSProperties}
                  aria-label={'Add bullet to ' + (exp.jobTitle || 'job')}
                  data-testid={'add-bullet-' + exp.id}
                >
                  <Plus className="w-2.5 h-2.5" />
                  Add Bullet
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Experience editable field — hover-to-edit subfield
// ---------------------------------------------------------------------------

/**
 * Inline-editable experience subfield. Shows the value normally with a
 * hover affordance (background tint + pencil icon) when the section is
 * selected. Clicking starts editing. Keyboard reachable via tabIndex.
 *
 * INTERACTION STATES:
 *   hover (section selected): faint accent background + pencil icon
 *   focus-visible: ring-2 ring accent
 *   empty state: dim placeholder text
 */
function ExperienceEditableField(props: {
  value: string;
  isEmpty?: boolean;
  isSelected: boolean;
  onEditStart: () => void;
  className?: string;
  style?: React.CSSProperties;
  testId: string;
  anchorId?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showEditHint = isHovered && props.isSelected;

  return (
    <span
      className={(props.className || '') + ' rounded-sm inline-flex items-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-inset'}
      style={Object.assign({}, props.style || {}, {
        cursor: props.isSelected ? 'text' : 'default',
        background: showEditHint
          ? 'color-mix(in srgb, var(--p-accent) 6%, transparent)'
          : 'transparent',
        padding: '0 3px',
        transition: 'background 0.12s ease',
        color: props.isEmpty ? 'var(--p-text-dim)' : (props.style ? props.style.color : undefined),
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties)}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        if (props.isSelected) {
          e.stopPropagation();
          props.onEditStart();
        }
      }}
      onKeyDown={function (e: React.KeyboardEvent) {
        if (props.isSelected && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          props.onEditStart();
        }
      }}
      tabIndex={props.isSelected ? 0 : -1}
      data-testid={props.testId}
      data-callout-anchor={props.anchorId}
      role={props.isSelected ? 'button' : undefined}
      aria-label={props.isSelected ? 'Edit ' + props.value : undefined}
    >
      {props.value}
      {showEditHint && (
        <Pencil
          className="w-2.5 h-2.5 flex-shrink-0"
          style={{ color: 'var(--p-accent)', opacity: 0.5 }}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Education
// ---------------------------------------------------------------------------

/**
 * Renders the education section with full inline editing support.
 * Each education entry has four editable sub-fields: degree, field,
 * institution, and graduationDate. Clicking any field in a selected
 * section opens the inline editor for that specific field.
 */
function EducationCanvasSection(props: {
  education: ResumeDraft['education'];
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onFieldEditStart: (eduId: string, fieldName: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRemoveEntry?: (eduId: string) => void;
}) {
  /**
   * Check if a specific sub-field of a specific education entry is
   * currently being edited.
   */
  function isFieldEditing(eduId: string, fieldName: string): boolean {
    return (
      props.editingField !== null
      && props.editingField.type === 'education-field'
      && props.editingField.educationId === eduId
      && props.editingField.fieldName === fieldName
    );
  }

  return (
    <div className="mb-4" data-testid="canvas-education-section" data-callout-anchor="education-section-anchor">
      <SectionHeading label="Education" />
      {props.education.length === 0 ? (
        <EmptyPlaceholder
          label="Add education"
          onClick={function () {
            if (props.isSelected) {
              props.onFieldEditStart('new', 'degree', '');
            }
          }}
        />
      ) : (
        props.education.map(function (edu) {
          return (
            <div key={edu.id} className="mb-3 relative" data-testid={'canvas-education-' + edu.id}>
              {/* Degree + Field row — editable. Remove button is placed
               * at the end of this flex row (in-flow) so it never overlaps
               * degree/date text. Previously absolutely positioned. */}
              <div
                className="flex items-baseline gap-1"
                data-callout-anchor={'education-entry-' + edu.id}
              >
                {/* Remove education entry — in-flow after last field */}
                {props.editMode && props.isSelected && props.onRemoveEntry && (
                  <button
                    type="button"
                    onClick={function (e: React.MouseEvent) {
                      e.stopPropagation();
                      if (props.onRemoveEntry) props.onRemoveEntry(edu.id);
                    }}
                    className={'order-last flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                    style={{
                      color: 'var(--p-danger, #ef4444)',
                      background: 'color-mix(in srgb, var(--p-danger, #ef4444) 8%, transparent)',
                      '--tw-ring-color': 'var(--p-accent)',
                    } as React.CSSProperties}
                    aria-label={'Remove education: ' + (edu.degree || 'entry')}
                    title="Remove this education entry"
                    data-testid={'remove-education-' + edu.id}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <EducationEditableField
                  value={edu.degree}
                  placeholder="Degree"
                  fieldName="degree"
                  eduId={edu.id}
                  isEditing={isFieldEditing(edu.id, 'degree')}
                  editingText={props.editingText}
                  isSelected={props.isSelected}
                  onEditStart={props.onFieldEditStart}
                  onEditChange={props.onEditChange}
                  onEditSave={props.onEditSave}
                  onEditCancel={props.onEditCancel}
                  className="text-xs font-bold"
                  textColor="var(--p-text)"
                />
                <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>,</span>
                <EducationEditableField
                  value={edu.field}
                  placeholder="Field of study"
                  fieldName="field"
                  eduId={edu.id}
                  isEditing={isFieldEditing(edu.id, 'field')}
                  editingText={props.editingText}
                  isSelected={props.isSelected}
                  onEditStart={props.onFieldEditStart}
                  onEditChange={props.onEditChange}
                  onEditSave={props.onEditSave}
                  onEditCancel={props.onEditCancel}
                  className="text-xs font-bold"
                  textColor="var(--p-text)"
                />
              </div>
              {/* Institution + Graduation date row */}
              <div className="flex items-baseline gap-1">
                <EducationEditableField
                  value={edu.institution}
                  placeholder="Institution"
                  fieldName="institution"
                  eduId={edu.id}
                  isEditing={isFieldEditing(edu.id, 'institution')}
                  editingText={props.editingText}
                  isSelected={props.isSelected}
                  onEditStart={props.onFieldEditStart}
                  onEditChange={props.onEditChange}
                  onEditSave={props.onEditSave}
                  onEditCancel={props.onEditCancel}
                  className="text-[10px]"
                  textColor="var(--p-text-muted)"
                />
                <span className="text-[10px]" style={{ color: 'var(--p-text-muted)' }}>|</span>
                <EducationEditableField
                  value={edu.graduationDate}
                  placeholder="Graduation date"
                  fieldName="graduationDate"
                  eduId={edu.id}
                  isEditing={isFieldEditing(edu.id, 'graduationDate')}
                  editingText={props.editingText}
                  isSelected={props.isSelected}
                  onEditStart={props.onFieldEditStart}
                  onEditChange={props.onEditChange}
                  onEditSave={props.onEditSave}
                  onEditCancel={props.onEditCancel}
                  className="text-[10px]"
                  textColor="var(--p-text-muted)"
                />
              </div>
              {/* GPA row — only shown if non-empty */}
              {edu.gpa ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px]" style={{ color: 'var(--p-text-muted)' }}>GPA:</span>
                  <EducationEditableField
                    value={edu.gpa}
                    placeholder="GPA"
                    fieldName="gpa"
                    eduId={edu.id}
                    isEditing={isFieldEditing(edu.id, 'gpa')}
                    editingText={props.editingText}
                    isSelected={props.isSelected}
                    onEditStart={props.onFieldEditStart}
                    onEditChange={props.onEditChange}
                    onEditSave={props.onEditSave}
                    onEditCancel={props.onEditCancel}
                    className="text-[10px]"
                    textColor="var(--p-text-muted)"
                  />
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * Individual education field with hover-to-edit affordance.
 * Mirrors the FederalDetailField pattern: clicking an editable field
 * in a selected section opens the inline editor inline.
 */
function EducationEditableField(props: {
  value: string;
  placeholder: string;
  fieldName: string;
  eduId: string;
  isEditing: boolean;
  editingText: string;
  isSelected: boolean;
  onEditStart: (eduId: string, fieldName: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  className: string;
  textColor: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (props.isEditing) {
    return (
      <InlineEditor
        value={props.editingText}
        onChange={props.onEditChange}
        onSave={props.onEditSave}
        onCancel={props.onEditCancel}
        multiline={false}
        placeholder={'Enter ' + props.placeholder.toLowerCase() + '...'}
        testId={'inline-editor-edu-' + props.eduId + '-' + props.fieldName}
      />
    );
  }

  return (
    <span
      className={props.className + ' rounded-sm inline-block'}
      style={{
        color: props.textColor,
        background: isHovered && props.isSelected
          ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
          : 'transparent',
        padding: '0 3px',
        margin: '0 -3px',
        cursor: props.isSelected ? 'text' : 'default',
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        if (props.isSelected) {
          e.stopPropagation();
          props.onEditStart(props.eduId, props.fieldName, props.value);
        }
      }}
      data-testid={'edu-field-' + props.eduId + '-' + props.fieldName}
    >
      {props.value || props.placeholder}
      {isHovered && props.isSelected && (
        <Pencil
          className="inline-block w-2.5 h-2.5 ml-0.5"
          style={{ color: 'var(--p-accent)', opacity: 0.5, verticalAlign: 'middle' }}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Skills — with inline editing
// ---------------------------------------------------------------------------

/**
 * Renders the skills section. When selected, clicking the skills text
 * opens an inline editor for the comma-separated skill list.
 */
function SkillsCanvasSection(props: {
  skills: ResumeDraft['skills'];
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  /* Build display text from skills array */
  const skillNames: string[] = [];
  for (let i = 0; i < props.skills.length; i++) {
    skillNames.push(props.skills[i].name);
  }
  const skillsText = skillNames.join(', ');

  const isEditing = props.editingField !== null && props.editingField.type === 'skill';

  return (
    <div className="mb-4" data-testid="canvas-skills-section">
      <SectionHeading label="Technical Skills" />

      {isEditing ? (
        <InlineEditor
          value={props.editingText}
          onChange={props.onEditChange}
          onSave={props.onEditSave}
          onCancel={props.onEditCancel}
          multiline={false}
          placeholder="Enter skills separated by commas..."
          testId="inline-editor-skills"
        />
      ) : props.skills.length === 0 ? (
        <EmptyPlaceholder
          label="Add skills"
          onClick={function () {
            if (props.isSelected) {
              props.onEditStart();
            }
          }}
        />
      ) : (
        <div
          className="relative rounded-sm cursor-text"
          style={{
            background: isHovered && props.isSelected
              ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
              : 'transparent',
            transition: 'background 0.15s ease',
            padding: '4px 6px',
            margin: '-4px -6px',
          }}
          onMouseEnter={function () { setIsHovered(true); }}
          onMouseLeave={function () { setIsHovered(false); }}
          onClick={function (e: React.MouseEvent) {
            /* DIRECT EDITING: No edit-ready gate needed — clicking
             * editable content in a selected section starts editing. */
            if (props.isSelected) {
              e.stopPropagation();
              props.onEditStart();
            }
          }}
          data-testid="skills-editable-region"
          data-callout-anchor="skills-block"
        >
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--p-text)' }}
          >
            {skillsText}
          </p>
          {isHovered && props.isSelected && (
            <div
              className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, var(--p-accent) 12%, transparent)',
                color: 'var(--p-accent)',
              }}
            >
              <Pencil className="w-3 h-3" />
              <span className="text-[9px] font-medium">Click to edit</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Certifications
// ---------------------------------------------------------------------------

/**
 * Renders the certifications section with full inline editing.
 * Works similarly to the Skills section — clicking the text block
 * opens a comma-separated inline editor. Each certification is
 * a simple name string (structured metadata can be added later).
 */
function CertificationsCanvasSection(props: {
  certifications: ResumeCertification[];
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onEditStart: (currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRemoveCert?: (certId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const certNames: string[] = [];
  for (let i = 0; i < props.certifications.length; i++) {
    certNames.push(props.certifications[i].name);
  }
  const certsText = certNames.join(', ');

  const isEditing = props.editingField !== null && props.editingField.type === 'certification';

  return (
    <div className="mb-4" data-testid="canvas-certifications-section" data-callout-anchor="certifications-section-anchor">
      <SectionHeading label="Certifications" />

      {isEditing ? (
        <InlineEditor
          value={props.editingText}
          onChange={props.onEditChange}
          onSave={props.onEditSave}
          onCancel={props.onEditCancel}
          multiline={false}
          placeholder="Enter certifications separated by commas..."
          testId="inline-editor-certifications"
        />
      ) : props.certifications.length === 0 ? (
        /* EMPTY STATE: Allow adding certifications regardless of whether
         * the section is currently selected. The old code required the
         * section to be selected first, which meant clicking "Add
         * certifications" did nothing visible — a broken trust point.
         *
         * Now we always call onEditStart when the placeholder is clicked.
         * The parent (ResumeBuilderScreen) handles section selection as
         * part of the inline edit start flow if needed. */
        <EmptyPlaceholder
          label="Add certifications"
          onClick={function () {
            props.onEditStart('');
          }}
        />
      ) : (
        <div
          className="relative rounded-sm"
          data-testid="certifications-editable-region"
          data-callout-anchor="certifications-block"
        >
          {/* Individual certification items with remove buttons */}
          <div className="flex flex-wrap gap-1.5">
            {props.certifications.map(function (cert) {
              return (
                <span
                  key={cert.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--p-surface2, rgba(255,255,255,0.04))',
                    color: 'var(--p-text)',
                    border: '1px solid var(--p-border)',
                    cursor: props.isSelected ? 'text' : 'default',
                  }}
                  onClick={function (e: React.MouseEvent) {
                    if (props.isSelected) {
                      e.stopPropagation();
                      props.onEditStart(certsText);
                    }
                  }}
                  data-testid={'cert-item-' + cert.id}
                >
                  {cert.name}
                  {props.editMode && props.isSelected && props.onRemoveCert && (
                    <button
                      type="button"
                      onClick={function (e: React.MouseEvent) {
                        e.stopPropagation();
                        if (props.onRemoveCert) props.onRemoveCert(cert.id);
                      }}
                      className={'flex items-center justify-center w-3.5 h-3.5 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                      style={{
                        color: 'var(--p-text-dim)',
                        '--tw-ring-color': 'var(--p-accent)',
                      } as React.CSSProperties}
                      aria-label={'Remove ' + cert.name}
                      title={'Remove ' + cert.name}
                      data-testid={'remove-cert-' + cert.id}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Federal Details — with inline field editing
// ---------------------------------------------------------------------------

/**
 * Renders federal details. When the section is selected, each field
 * is individually click-to-edit. The empty state shows a placeholder
 * that opens the editor for the first field.
 */
function FederalDetailsCanvasSection(props: {
  federalDetails: LiveResumeCanvasProps['federalDetails'];
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onFieldEditStart: (fieldName: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  if (!props.federalDetails) {
    return (
      <div className="mb-4" data-testid="canvas-federal-details-section" data-callout-anchor="federal-details-section-anchor">
        <SectionHeading label="Federal Details" />
        <EmptyPlaceholder
          label="Add federal employment details"
          onClick={function () {
            if (props.isSelected) {
              props.onFieldEditStart('securityClearance', '');
            }
          }}
        />
      </div>
    );
  }

  const fd = props.federalDetails;

  /* Helper: check if a specific federal field is currently being edited */
  function isFieldEditing(fieldName: string): boolean {
    return (
      props.editingField !== null
      && props.editingField.type === 'federal-field'
      && props.editingField.fieldName === fieldName
    );
  }

  return (
    <div className="mb-4" data-testid="canvas-federal-details-section" data-callout-anchor="federal-details-section-anchor">
      <SectionHeading label="Federal Details" />
      <div className="text-xs leading-relaxed" style={{ color: 'var(--p-text)' }}>
        <FederalDetailField
          label="Security Clearance"
          value={fd.securityClearance}
          fieldName="securityClearance"
          isEditing={isFieldEditing('securityClearance')}
          editingText={props.editingText}
          isSelected={props.isSelected}
          editMode={props.editMode}
          onEditStart={props.onFieldEditStart}
          onEditChange={props.onEditChange}
          onEditSave={props.onEditSave}
          onEditCancel={props.onEditCancel}
        />
        <FederalDetailField
          label="Highest Grade Held"
          value={fd.highestGrade}
          fieldName="highestGrade"
          isEditing={isFieldEditing('highestGrade')}
          editingText={props.editingText}
          isSelected={props.isSelected}
          editMode={props.editMode}
          onEditStart={props.onFieldEditStart}
          onEditChange={props.onEditChange}
          onEditSave={props.onEditSave}
          onEditCancel={props.onEditCancel}
        />
        <div className="mb-0.5">
          <span style={{ color: 'var(--p-text-muted)' }}>Federal Employee:</span>{' '}
          {fd.federalEmployee ? 'Yes' : 'No'}
        </div>
        <FederalDetailField
          label="Veteran Preference"
          value={fd.veteranPreference}
          fieldName="veteranPreference"
          isEditing={isFieldEditing('veteranPreference')}
          editingText={props.editingText}
          isSelected={props.isSelected}
          editMode={props.editMode}
          onEditStart={props.onFieldEditStart}
          onEditChange={props.onEditChange}
          onEditSave={props.onEditSave}
          onEditCancel={props.onEditCancel}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Individual federal detail field with inline editing
// ---------------------------------------------------------------------------

/**
 * A single federal detail field that supports click-to-edit when the
 * section is selected. Shows the label and current value normally;
 * replaces the value with an inline input when editing.
 */
function FederalDetailField(props: {
  label: string;
  value: string;
  fieldName: string;
  isEditing: boolean;
  editingText: string;
  isSelected: boolean;
  editMode: boolean;
  onEditStart: (fieldName: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (props.isEditing) {
    return (
      <div className="mb-0.5">
        <span style={{ color: 'var(--p-text-muted)' }}>{props.label}:</span>{' '}
        <InlineEditor
          value={props.editingText}
          onChange={props.onEditChange}
          onSave={props.onEditSave}
          onCancel={props.onEditCancel}
          multiline={false}
          placeholder={'Enter ' + props.label.toLowerCase() + '...'}
          testId={'inline-editor-federal-' + props.fieldName}
        />
      </div>
    );
  }

  return (
    <div
      className="mb-0.5 rounded-sm"
      style={{
        background: isHovered && props.isSelected
          ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
          : 'transparent',
        padding: '1px 4px',
        margin: '-1px -4px',
        cursor: props.isSelected ? 'text' : 'default',
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        /* DIRECT EDITING: No edit-ready gate — click to edit when
         * section is selected. */
        if (props.isSelected) {
          e.stopPropagation();
          props.onEditStart(props.fieldName, props.value);
        }
      }}
      data-testid={'federal-field-' + props.fieldName}
    >
      <span style={{ color: 'var(--p-text-muted)' }}>{props.label}:</span>{' '}
      {props.value}
      {isHovered && props.isSelected && (
        <Pencil
          className="inline-block w-2.5 h-2.5 ml-1"
          style={{ color: 'var(--p-accent)', opacity: 0.5, verticalAlign: 'middle' }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Supporting Evidence — quantified achievements, projects
// ---------------------------------------------------------------------------

/**
 * Renders the supporting evidence section. This section holds quantified
 * achievements, project outcomes, awards, and other evidence that backs
 * up the experience bullets. It is separate from work experience to give
 * space for cross-cutting evidence that spans multiple positions.
 *
 * In the initial state this renders a placeholder prompting the user
 * to add supporting evidence.
 */
/**
 * Renders the supporting evidence section with full inline editing.
 * Each evidence item is a click-to-edit text block, similar to
 * experience bullets but without the parent experience context.
 * Evidence items span across positions — they're for cross-cutting
 * achievements, awards, publications, and quantified outcomes.
 */
function SupportingEvidenceCanvasSection(props: {
  evidence: ResumeSupportingEvidence[];
  editMode: boolean;
  isSelected: boolean;
  editingField: EditingField | null;
  editingText: string;
  onEditStart: (evidenceId: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRemoveEvidence?: (evidenceId: string) => void;
}) {
  return (
    <div
      className="mb-4"
      data-testid="canvas-supporting-evidence-section"
      data-callout-anchor="supporting-evidence-section-anchor"
    >
      <SectionHeading label="Supporting Evidence" />
      {props.evidence.length === 0 ? (
        <EmptyPlaceholder
          label="Add supporting evidence (projects, awards, publications, metrics)"
          onClick={function () {
            if (props.isSelected) {
              props.onEditStart('new', '');
            }
          }}
        />
      ) : (
        <ul className="list-disc pl-4 space-y-0.5">
          {props.evidence.map(function (item) {
            const isEditing = (
              props.editingField !== null
              && props.editingField.type === 'supporting-evidence'
              && props.editingField.evidenceId === item.id
            );
            return (
              <li key={item.id} className="flex items-start gap-1">
                <div className="flex-1">
                  <EvidenceEditableItem
                    item={item}
                    isSelected={props.isSelected}
                    isEditing={isEditing}
                    editingText={props.editingText}
                    onEditStart={props.onEditStart}
                    onEditChange={props.onEditChange}
                    onEditSave={props.onEditSave}
                    onEditCancel={props.onEditCancel}
                  />
                </div>
                {props.editMode && props.isSelected && props.onRemoveEvidence && (
                  <button
                    type="button"
                    onClick={function (e: React.MouseEvent) {
                      e.stopPropagation();
                      if (props.onRemoveEvidence) props.onRemoveEvidence(item.id);
                    }}
                    className={'flex-shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                    style={{
                      color: 'var(--p-text-dim)',
                      '--tw-ring-color': 'var(--p-accent)',
                    } as React.CSSProperties}
                    aria-label="Remove evidence item"
                    title="Remove this evidence item"
                    data-testid={'remove-evidence-' + item.id}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * A single evidence item with hover-to-edit affordance.
 * Mirrors the EditableBulletItem pattern for consistency.
 */
function EvidenceEditableItem(props: {
  item: ResumeSupportingEvidence;
  isSelected: boolean;
  isEditing: boolean;
  editingText: string;
  onEditStart: (evidenceId: string, currentValue: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (props.isEditing) {
    return (
      <div
        className="text-xs leading-relaxed pl-1 relative mb-0.5"
        data-testid={'evidence-item-' + props.item.id}
      >
        <InlineEditor
          value={props.editingText}
          onChange={props.onEditChange}
          onSave={props.onEditSave}
          onCancel={props.onEditCancel}
          multiline={true}
          placeholder="Describe the achievement, award, or project outcome..."
          testId={'inline-editor-evidence-' + props.item.id}
        />
      </div>
    );
  }

  return (
    <div
      className="text-xs leading-relaxed pl-1 relative mb-0.5 rounded-sm"
      style={{
        background: isHovered && props.isSelected
          ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
          : 'transparent',
        cursor: props.isSelected ? 'text' : 'default',
        transition: 'background 0.12s ease',
        padding: '1px 4px',
        margin: '-1px -4px',
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        if (props.isSelected) {
          e.stopPropagation();
          props.onEditStart(props.item.id, props.item.text);
        }
      }}
      data-testid={'evidence-item-' + props.item.id}
      data-callout-anchor={'evidence-' + props.item.id}
    >
      {props.item.text}
      {isHovered && props.isSelected && (
        <Pencil
          className="inline-block w-2.5 h-2.5 ml-1"
          style={{ color: 'var(--p-accent)', opacity: 0.5, verticalAlign: 'middle' }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-page document surfaces — per-page visual backgrounds
// ---------------------------------------------------------------------------

/**
 * Renders one absolute-positioned visual surface per page behind the
 * content layer. Each surface has its own border, shadow, and rounded
 * corners — creating the impression of separate sheets of paper on
 * the workspace. Surfaces are separated by a gap that shows the
 * workspace background color.
 *
 * PAGE_HEIGHT: Total height of one printed page (US Letter at 96dpi
 *              = 1056px). Each surface is this tall.
 * PAGE_GAP:    Gap between surfaces showing workspace background.
 */
/* DocumentPageSurfaces and PageBoundarySpacer have been removed.
 * The page-first rendering model renders each page as a real DOM container
 * directly in the LiveResumeCanvas return JSX. Page boundary labels are
 * rendered inline between page surfaces. The old absolute-positioned
 * background + spacer approach is no longer used. */

// ---------------------------------------------------------------------------
// Shared: Section heading
// ---------------------------------------------------------------------------

/**
 * Consistent section heading used by all canvas sections.
 * Uppercase, tracking-wider, with a bottom border — matches
 * the established resume document heading pattern.
 */
function SectionHeading(props: { label: string }) {
  return (
    <div
      className="flex items-center justify-between mb-2 pb-1"
      style={{ borderBottom: '1px solid var(--p-border)' }}
    >
      <h3
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: 'var(--p-text)', letterSpacing: '0.08em' }}
      >
        {props.label}
      </h3>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Editable bullet item — with inline editing support
// ---------------------------------------------------------------------------

/**
 * Individual bullet with hover-to-edit affordance and inline editing.
 * When the experience section is selected, hovering shows a faint
 * background tint and pencil icon. Clicking opens an inline editor
 * that replaces the bullet text.
 */
function EditableBulletItem(props: {
  text: string;
  testId: string;
  editMode: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editingText: string;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (props.isEditing) {
    return (
      <li
        className="text-xs leading-relaxed pl-3 relative mb-0.5"
        data-testid={props.testId}
      >
        <span
          className="absolute left-0"
          style={{ color: 'var(--p-text-dim)' }}
        >
          •
        </span>
        <InlineEditor
          value={props.editingText}
          onChange={props.onEditChange}
          onSave={props.onEditSave}
          onCancel={props.onEditCancel}
          multiline={false}
          placeholder="Edit bullet point..."
          testId={props.testId + '-editor'}
        />
      </li>
    );
  }

  return (
    <li
      className="text-xs leading-relaxed pl-3 relative mb-0.5 rounded-sm"
      style={{
        color: 'var(--p-text)',
        /* DIRECT EDITING: Hover affordance shows whenever section is
         * selected (no edit-ready gate). The cursor changes to text
         * to signal editability. */
        background: isHovered && props.isSelected
          ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
          : 'transparent',
        transition: 'background 0.12s ease',
        paddingTop: '1px',
        paddingBottom: '1px',
        paddingRight: isHovered && props.isSelected ? '20px' : '0',
        cursor: props.isSelected ? 'text' : 'default',
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        /* DIRECT EDITING: Start editing on click when section is selected */
        if (props.isSelected) {
          e.stopPropagation();
          props.onEditStart();
        }
      }}
      data-testid={props.testId}
      data-callout-anchor={props.testId.replace('canvas-', '')}
    >
      <span
        className="absolute left-0"
        style={{ color: 'var(--p-text-dim)' }}
      >
        •
      </span>
      {props.text}
      {isHovered && props.isSelected && (
        <Pencil
          className="absolute right-0 top-1/2 w-3 h-3"
          style={{
            color: 'var(--p-accent)',
            opacity: 0.5,
            transform: 'translateY(-50%)',
          }}
        />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Shared: Empty section placeholder
// ---------------------------------------------------------------------------

/**
 * Placeholder shown when a section has no content. Uses a dashed
 * border with a hover effect and Plus icon to indicate that the
 * user can click to add content. Accepts an optional onClick callback
 * to open the appropriate editor directly.
 */
function EmptyPlaceholder(props: { label: string; onClick?: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="py-3 text-center rounded cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        border: isHovered
          ? '1px dashed var(--p-accent)'
          : '1px dashed var(--p-border)',
        color: isHovered ? 'var(--p-accent)' : 'var(--p-text-dim)',
        background: isHovered
          ? 'color-mix(in srgb, var(--p-accent) 4%, transparent)'
          : 'transparent',
        transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      onClick={function (e: React.MouseEvent) {
        if (props.onClick) {
          e.stopPropagation();
          props.onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={props.label}
      onKeyDown={function (e: React.KeyboardEvent) {
        if ((e.key === 'Enter' || e.key === ' ') && props.onClick) {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      <div className="flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        <span className="text-xs">{props.label}</span>
      </div>
    </div>
  );
}
