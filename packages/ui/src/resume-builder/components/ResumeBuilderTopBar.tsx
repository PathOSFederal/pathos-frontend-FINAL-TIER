/**
 * ============================================================================
 * RESUME BUILDER TOP BAR — Stable 7-slot architecture with real dropdowns
 * ============================================================================
 *
 * PURPOSE: Top-level workspace controls for the Resume Builder. Uses a
 * fixed 7-slot layout where slot POSITIONS never shift across stages.
 * Only the CONTENT inside each slot changes based on the active stage.
 *
 * SLOT MAP:
 *   Slot 1: resume-selector     — Default Resume / version picker (real dropdown)
 *   Slot 2: target-job-selector — Target job picker (real dropdown)
 *   Slot 3: stage-tabs          — Partial | Tailoring | Validation
 *   Slot 4: page-budget         — Page count vs 2-page limit
 *   Slot 5: readiness           — Readiness score or validation state
 *   Slot 6: utility-actions     — Preview, Versions, settings
 *   Slot 7: primary-cta         — Context-dependent primary action
 *
 * DROPDOWN BEHAVIOR:
 *   - Resume and Target Job selectors open real dropdown menus.
 *   - Menus close on outside click, Escape key, or item selection.
 *   - Keyboard navigation: Arrow keys move focus, Enter selects, Escape closes.
 *   - Selected value is visually obvious with accent text + check icon.
 *   - Menu items have hover and focus-visible states per interaction standard.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, FileText, Eye, Layers, Download, Check, Pencil, Sparkles } from 'lucide-react';
import type { BuilderStage, PrimaryCtaConfig } from '../types/stage-types';
import type { PreflightState } from '../types/validation-types';
import { INTERACTIVE_HOVER_CLASS } from '../../styles/interactiveHover';
import { readinessTierColor, readinessBandLabel } from '../../styles/scoreTiers';
import { StageTabs } from './StageTabs';
import { PageBudgetIndicator } from './PageBudgetIndicator';

// ---------------------------------------------------------------------------
// Dropdown item types — data for the real dropdown menus
// ---------------------------------------------------------------------------

/**
 * A single selectable item in a dropdown menu. Both resume versions
 * and target jobs use this same structure.
 */
export interface DropdownItem {
  /** Unique identifier for the item. */
  id: string;
  /** Display label shown in the dropdown menu. */
  label: string;
  /** Optional secondary text (e.g., agency name for target jobs). */
  sublabel?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResumeBuilderTopBarProps {
  /** Currently active builder stage. */
  stage: BuilderStage;
  /** Callback when the user changes the stage via tabs. */
  onStageChange: (stage: BuilderStage) => void;

  /** Display label for the active master resume version. */
  resumeLabel: string;
  /** Available resume versions for the dropdown. */
  resumeVersions?: DropdownItem[];
  /** Currently selected resume version ID. */
  selectedResumeId?: string;
  /** Callback when the user selects a resume version. */
  onResumeSelect: (resumeId: string) => void;

  /** Display label for the active target job, or null if none selected. */
  targetJobLabel: string | null;
  /** Available target jobs for the dropdown. */
  targetJobs?: DropdownItem[];
  /** Currently selected target job ID, or null. */
  selectedTargetJobId?: string | null;
  /** Callback when the user selects a target job. */
  onTargetJobSelect: (jobId: string | null) => void;

  /** Whether a target job is currently selected. */
  hasTargetJob: boolean;
  /** Whether tailoring is sufficiently complete for validation. */
  tailoringComplete: boolean;

  /** Current page count for the page budget indicator. */
  pageCount: number;
  /** Maximum page limit (typically 2 for federal resumes). */
  pageLimit: number;

  /** Computed readiness score (0-100) for the readiness slot. */
  readinessScore: number;
  /** Preflight state when in validation stage. */
  preflightState: PreflightState | null;

  /** Whether there are pending suggestions to apply. */
  hasPendingSuggestions: boolean;

  /** Primary CTA configuration. */
  primaryCta: PrimaryCtaConfig;
  /** Callback when the primary CTA is clicked. */
  onPrimaryCtaClick: () => void;

  /** Callback for preview action. */
  onPreview: () => void;
  /** Callback for versions action. */
  onVersions: () => void;
  /** Callback for save/export action. */
  onExport?: () => void;

  /**
   * Callback for "Review Resume" action. Opens a full-document review
   * surface powered by PathAdvisor that evaluates the entire resume.
   */
  onReviewResume?: () => void;

  /**
   * Whether the document is in edit-ready mode. When true, the
   * selected section in the resume becomes visibly editable with
   * highlighted regions and action affordances. When false, the
   * document is in polished view mode.
   */
  isEditReady?: boolean;
  /** Callback when the user toggles edit-ready mode. */
  onEditToggle?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ResumeBuilderTopBar renders the 7-slot stable header for the resume
 * builder workspace. Slot positions are fixed — only content changes
 * across stages.
 *
 * The Resume Selector (Slot 1) and Target Job Selector (Slot 2) are
 * real dropdown controls: clicking opens a positioned dropdown menu
 * with selectable items, keyboard navigation, and outside-click-to-close.
 */
export function ResumeBuilderTopBar(props: ResumeBuilderTopBarProps) {
  /* ---- Dropdown open/close state ---- */
  const [resumeDropdownOpen, setResumeDropdownOpen] = useState(false);
  const [targetJobDropdownOpen, setTargetJobDropdownOpen] = useState(false);

  /* ---- Refs for outside-click detection ---- */
  const resumeDropdownRef = useRef<HTMLDivElement>(null);
  const targetJobDropdownRef = useRef<HTMLDivElement>(null);

  /**
   * Close both dropdowns. Called when the user clicks outside the
   * dropdown area or presses Escape.
   */
  const closeAllDropdowns = useCallback(function () {
    setResumeDropdownOpen(false);
    setTargetJobDropdownOpen(false);
  }, []);

  /**
   * Outside-click handler: close dropdowns when clicking anywhere
   * outside the dropdown container. Uses a delayed event listener
   * to avoid closing on the same click that opened the dropdown.
   */
  useEffect(function () {
    if (!resumeDropdownOpen && !targetJobDropdownOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      /* Check if click is outside the resume dropdown */
      if (resumeDropdownOpen && resumeDropdownRef.current) {
        if (!resumeDropdownRef.current.contains(target)) {
          setResumeDropdownOpen(false);
        }
      }
      /* Check if click is outside the target job dropdown */
      if (targetJobDropdownOpen && targetJobDropdownRef.current) {
        if (!targetJobDropdownRef.current.contains(target)) {
          setTargetJobDropdownOpen(false);
        }
      }
    }

    /* Delay listener registration to avoid closing on the opening click */
    const timer = setTimeout(function () {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 10);

    return function () {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [resumeDropdownOpen, targetJobDropdownOpen]);

  /**
   * Global Escape key handler: close any open dropdown when Escape is pressed.
   */
  useEffect(function () {
    if (!resumeDropdownOpen && !targetJobDropdownOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return function () {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [resumeDropdownOpen, targetJobDropdownOpen, closeAllDropdowns]);

  return (
    <div
      className="px-4 py-2.5 flex items-center flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
        minHeight: '48px',
      }}
      data-testid="resume-builder-top-bar"
      role="toolbar"
      aria-label="Resume Builder controls"
    >
      {/* LEFT GROUP: Resume selector + Target job — stays left-aligned.
       * gap-3 keeps the two dropdowns visually grouped. */}
      <div className="flex items-center gap-3 flex-shrink-0">

      {/* ---- Slot 1: Resume Selector (real dropdown) ---- */}
      <div
        ref={resumeDropdownRef}
        className="relative flex items-center flex-shrink-0"
        data-testid="top-bar-slot-resume-selector"
        data-slot="resume-selector"
      >
        <button
          type="button"
          onClick={function () { setResumeDropdownOpen(!resumeDropdownOpen); }}
          className={'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS + ' outline-none focus-visible:ring-2 focus-visible:ring-inset'}
          style={{
            border: '1px solid var(--p-border)',
            color: 'var(--p-text)',
            background: resumeDropdownOpen
              ? 'color-mix(in srgb, var(--p-accent) 8%, transparent)'
              : 'transparent',
            '--tw-ring-color': 'var(--p-accent)',
          } as React.CSSProperties}
          aria-label={'Active resume: ' + props.resumeLabel}
          aria-expanded={resumeDropdownOpen}
          aria-haspopup="listbox"
          data-testid="resume-selector-trigger"
        >
          <FileText className="w-3.5 h-3.5" style={{ color: 'var(--p-accent)' }} />
          <span className="max-w-[160px] truncate">{props.resumeLabel}</span>
          <ChevronDown
            className="w-3 h-3"
            style={{
              color: 'var(--p-text-dim)',
              transform: resumeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>

        {/* Resume version dropdown menu */}
        {resumeDropdownOpen && (
          <DropdownMenu
            items={props.resumeVersions || [{ id: 'master', label: 'Default Resume' }]}
            selectedId={props.selectedResumeId || 'master'}
            onSelect={function (id: string) {
              props.onResumeSelect(id);
              setResumeDropdownOpen(false);
            }}
            onClose={function () { setResumeDropdownOpen(false); }}
            testId="resume-dropdown-menu"
          />
        )}
      </div>

      {/* ---- Slot 2: Target Job Selector (real dropdown) ---- */}
      <div
        ref={targetJobDropdownRef}
        className="relative flex items-center flex-shrink-0"
        data-testid="top-bar-slot-target-job-selector"
        data-slot="target-job-selector"
      >
        <button
          type="button"
          onClick={function () { setTargetJobDropdownOpen(!targetJobDropdownOpen); }}
          className={'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS + ' outline-none focus-visible:ring-2 focus-visible:ring-inset'}
          style={{
            border: props.hasTargetJob
              ? '1px solid var(--p-success)'
              : '1px solid var(--p-border)',
            color: props.hasTargetJob ? 'var(--p-text)' : 'var(--p-text-muted)',
            background: targetJobDropdownOpen
              ? 'color-mix(in srgb, var(--p-accent) 8%, transparent)'
              : props.hasTargetJob
                ? 'color-mix(in srgb, var(--p-success) 8%, transparent)'
                : 'transparent',
            '--tw-ring-color': 'var(--p-accent)',
            /* Prevent very long job titles from jamming the bar */
            maxWidth: '240px',
          } as React.CSSProperties}
          aria-label={props.targetJobLabel ? 'Target job: ' + props.targetJobLabel : 'Select target job'}
          aria-expanded={targetJobDropdownOpen}
          aria-haspopup="listbox"
          data-testid="target-job-selector-trigger"
        >
          <span className="max-w-[200px] truncate">
            {props.targetJobLabel ? props.targetJobLabel : 'Select target job'}
          </span>
          <ChevronDown
            className="w-3 h-3 flex-shrink-0"
            style={{
              color: 'var(--p-text-dim)',
              transform: targetJobDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>

        {/* Target job dropdown menu */}
        {targetJobDropdownOpen && (
          <DropdownMenu
            items={props.targetJobs || []}
            selectedId={props.selectedTargetJobId || ''}
            onSelect={function (id: string) {
              props.onTargetJobSelect(id);
              setTargetJobDropdownOpen(false);
            }}
            onClose={function () { setTargetJobDropdownOpen(false); }}
            testId="target-job-dropdown-menu"
            emptyLabel="No saved jobs available"
            allowDeselect={true}
            onDeselect={function () {
              props.onTargetJobSelect(null);
              setTargetJobDropdownOpen(false);
            }}
          />
        )}
      </div>

      </div>{/* /LEFT GROUP */}

      {/* CENTER GROUP: Spacer + Stage tabs + Page budget — horizontally centered.
       * flex-1 spacers on both sides center the stage tabs visually. */}
      <div className="flex-1 min-w-0" />

      {/* ---- Slot 3: Stage Tabs (visual center) ---- */}
      <div
        className="flex items-center gap-3 flex-shrink-0"
        data-testid="top-bar-slot-stage-tabs"
        data-slot="stage-tabs"
      >
        <StageTabs
          activeStage={props.stage}
          onStageChange={props.onStageChange}
          hasTargetJob={props.hasTargetJob}
          tailoringComplete={props.tailoringComplete}
        />

        {/* ---- Slot 4: Page Budget ---- */}
        <div
          className="flex items-center flex-shrink-0"
          data-testid="top-bar-slot-page-budget"
          data-slot="page-budget"
        >
          <PageBudgetIndicator
            pageCount={props.pageCount}
            pageLimit={props.pageLimit}
          />
        </div>
      </div>

      {/* Spacer — pushes right-aligned slots to the end */}
      <div className="flex-1 min-w-0" />

      {/* ---- Slot 5: Readiness / Validation State ----
       *
       * NON-VALIDATION STAGES: Shows a percentage-first readiness chip.
       *   Primary:   "<N>% Ready" in the 5-tier readiness color
       *   Secondary: Band label (Strong / Good / Fair / Needs work / Critical)
       *
       * The readiness percentage is the MAIN score. The band label is an
       * interpretation — it helps the user understand what the number means
       * without replacing it. Readiness is NOT completion: completion asks
       * "are fields present?", readiness asks "how submission-ready is this
       * resume?" considering quality, evidence, and federal requirements.
       *
       * Color is determined by readinessTierColor() from scoreTiers.ts,
       * which uses the same 5-tier bands as completion-colors.ts so
       * Resume Readiness and Career Readiness feel like siblings.
       *
       * VALIDATION STAGE: Shows preflight pass/fail summary (unchanged).
       *
       * EXTENSIBILITY: The chip is structured as a flex row so a second
       * adjacent score (e.g. match) can be added later without redesign.
       */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        data-testid="top-bar-slot-readiness"
        data-slot="readiness"
      >
        {props.stage === 'validation' && props.preflightState ? (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded"
            style={{
              color: props.preflightState.allPassed ? 'var(--p-success)' : 'var(--p-warning, #eab308)',
              background: props.preflightState.allPassed
                ? 'color-mix(in srgb, var(--p-success) 12%, transparent)'
                : 'color-mix(in srgb, var(--p-warning, #eab308) 12%, transparent)',
            }}
          >
            {props.preflightState.summaryLabel}
          </span>
        ) : (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded"
            style={{
              background: 'color-mix(in srgb, ' + readinessTierColor(props.readinessScore) + ' 10%, transparent)',
            }}
          >
            {/* Primary: percentage-first readiness score */}
            <span
              className="text-xs font-bold"
              style={{ color: readinessTierColor(props.readinessScore) }}
            >
              {props.readinessScore}% Ready
            </span>
            {/* Secondary: band label interpretation */}
            <span
              className="text-[10px] font-medium"
              style={{ color: 'var(--p-text-muted)' }}
            >
              · {readinessBandLabel(props.readinessScore)}
            </span>
          </div>
        )}
      </div>

      {/* SEPARATOR — visual break between readiness cluster and utility
       * actions. Prevents the "87% Ready" badge from visually merging
       * with the Edit toggle, which users reported as crowded. */}
      <div
        className="flex-shrink-0"
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--p-border)',
          margin: '0 4px',
        }}
        aria-hidden="true"
      />

      {/* ---- Slot 6: Utility Actions (Edit toggle + Preview + Versions) ---- */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        data-testid="top-bar-slot-utility-actions"
        data-slot="utility-actions"
      >
        {/* EDIT-READY TOGGLE — the primary affordance for switching between
         * view mode (polished, read-first) and edit-ready mode (editable
         * regions activated). The button uses a toggled visual treatment:
         * accent fill when active, transparent when inactive. This is the
         * key interaction that "activates the document itself." */}
        {props.onEditToggle && (
          <button
            type="button"
            onClick={props.onEditToggle}
            className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              color: props.isEditReady ? '#ffffff' : 'var(--p-text-muted)',
              background: props.isEditReady
                ? 'var(--p-accent)'
                : 'transparent',
              border: props.isEditReady
                ? '1px solid var(--p-accent)'
                : '1px solid var(--p-border)',
              '--tw-ring-color': 'var(--p-accent)',
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            } as React.CSSProperties}
            aria-label={props.isEditReady ? 'Exit edit mode' : 'Enter edit mode'}
            aria-pressed={props.isEditReady ? 'true' : 'false'}
            title={props.isEditReady ? 'Editing — click to view' : 'Click to edit'}
            data-testid="edit-ready-toggle"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{props.isEditReady ? 'Editing' : 'Edit'}</span>
          </button>
        )}

        {/* REVIEW RESUME — opens a full-document PathAdvisor review.
         * This is the top-level entry point for asking PathAdvisor to
         * evaluate the entire resume — strongest sections, weakest sections,
         * missing federal requirements, and top recommended fixes. */}
        {props.onReviewResume && (
          <button
            type="button"
            onClick={props.onReviewResume}
            className={'flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              color: 'var(--p-accent)',
              background: 'color-mix(in srgb, var(--p-accent) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--p-accent) 20%, transparent)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            aria-label="Ask PathAdvisor to review entire resume"
            title="Review Resume — get a full-document evaluation from PathAdvisor"
            data-testid="review-resume-button"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Review Resume</span>
          </button>
        )}

        <button
          type="button"
          onClick={props.onPreview}
          className={'flex items-center justify-center w-8 h-8 rounded ' + INTERACTIVE_HOVER_CLASS + ' outline-none focus-visible:ring-2 focus-visible:ring-inset'}
          style={{
            color: 'var(--p-text-muted)',
            '--tw-ring-color': 'var(--p-accent)',
          } as React.CSSProperties}
          aria-label="Preview resume"
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={props.onVersions}
          className={'flex items-center justify-center w-8 h-8 rounded ' + INTERACTIVE_HOVER_CLASS + ' outline-none focus-visible:ring-2 focus-visible:ring-inset'}
          style={{
            color: 'var(--p-text-muted)',
            '--tw-ring-color': 'var(--p-accent)',
          } as React.CSSProperties}
          aria-label="Resume versions"
          title="Versions"
          data-testid="versions-button"
        >
          <Layers className="w-4 h-4" />
        </button>
        {props.onExport && (
          <button
            type="button"
            onClick={props.onExport}
            className={'flex items-center justify-center w-8 h-8 rounded ' + INTERACTIVE_HOVER_CLASS + ' outline-none focus-visible:ring-2 focus-visible:ring-inset'}
            style={{
              color: 'var(--p-text-muted)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            aria-label="Save resume to computer"
            title="Save to computer"
            data-testid="export-button"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ---- Slot 7: Primary CTA ---- */}
      <div
        className="flex items-center flex-shrink-0"
        data-testid="top-bar-slot-primary-cta"
        data-slot="primary-cta"
      >
        <PrimaryCtaButton
          config={props.primaryCta}
          onClick={props.onPrimaryCtaClick}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Dropdown Menu — reusable positioned dropdown
// ---------------------------------------------------------------------------

/**
 * DropdownMenu renders a positioned dropdown menu below its parent trigger.
 * Supports keyboard navigation (ArrowDown/Up to move, Enter to select,
 * Escape to close). Each item shows a check icon when selected.
 *
 * The menu is absolutely positioned and uses PathOS theme tokens for
 * consistent dark-theme styling. It supports an empty state message
 * and an optional "deselect" action for clearing the selection.
 */
function DropdownMenu(props: {
  items: DropdownItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  testId: string;
  emptyLabel?: string;
  allowDeselect?: boolean;
  onDeselect?: () => void;
}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Auto-focus the menu when it opens so keyboard navigation works
   * immediately without requiring a Tab press. */
  useEffect(function () {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  /**
   * Keyboard navigation handler for the dropdown menu.
   *   ArrowDown: move focus to next item
   *   ArrowUp:   move focus to previous item
   *   Enter:     select the focused item
   *   Escape:    close the dropdown
   *   Home:      move focus to first item
   *   End:       move focus to last item
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    const totalItems = props.items.length + (props.allowDeselect ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(function (prev) {
        const next = prev + 1;
        return next >= totalItems ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(function (prev) {
        const next = prev - 1;
        return next < 0 ? totalItems - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (props.allowDeselect && focusedIndex === 0 && props.onDeselect) {
        props.onDeselect();
      } else {
        const itemIndex = props.allowDeselect ? focusedIndex - 1 : focusedIndex;
        if (itemIndex >= 0 && itemIndex < props.items.length) {
          props.onSelect(props.items[itemIndex].id);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      props.onClose();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(totalItems - 1);
    }
  }

  return (
    <div
      ref={menuRef}
      className="absolute top-full left-0 mt-1 rounded-lg py-1 z-50 outline-none"
      style={{
        background: 'var(--p-surface)',
        border: '1px solid var(--p-border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        minWidth: '200px',
        maxWidth: '320px',
        maxHeight: '240px',
        overflowY: 'auto',
      }}
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid={props.testId}
      aria-label="Select an option"
    >
      {/* Optional "None" / deselect option */}
      {props.allowDeselect && (
        <DropdownMenuItem
          label="None"
          isSelected={!props.selectedId}
          isFocused={focusedIndex === 0}
          onClick={function () {
            if (props.onDeselect) {
              props.onDeselect();
            }
          }}
          onMouseEnter={function () { setFocusedIndex(0); }}
          testId={props.testId + '-none'}
        />
      )}

      {/* Menu items */}
      {props.items.length === 0 ? (
        <div
          className="px-3 py-2 text-xs"
          style={{ color: 'var(--p-text-dim)' }}
        >
          {props.emptyLabel || 'No items available'}
        </div>
      ) : (
        props.items.map(function (item, idx) {
          const adjustedIndex = props.allowDeselect ? idx + 1 : idx;
          return (
            <DropdownMenuItem
              key={item.id}
              label={item.label}
              sublabel={item.sublabel}
              isSelected={item.id === props.selectedId}
              isFocused={focusedIndex === adjustedIndex}
              onClick={function () { props.onSelect(item.id); }}
              onMouseEnter={function () { setFocusedIndex(adjustedIndex); }}
              testId={props.testId + '-item-' + item.id}
            />
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Dropdown menu item
// ---------------------------------------------------------------------------

/**
 * A single item in a dropdown menu. Shows the label, optional sublabel,
 * and a check icon when selected. Uses explicit hover tracking for
 * consistent focus/hover coexistence per interaction-state standard.
 */
function DropdownMenuItem(props: {
  label: string;
  sublabel?: string;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  testId: string;
}) {
  /* Determine background based on selected + focused state.
   * Selected items get an accent-tinted background. Focused items
   * get a surface2 background. Both states can coexist — selected
   * + focused shows the stronger accent tint. */
  let bgStyle = 'transparent';
  if (props.isSelected && props.isFocused) {
    bgStyle = 'color-mix(in srgb, var(--p-accent) 14%, transparent)';
  } else if (props.isSelected) {
    bgStyle = 'color-mix(in srgb, var(--p-accent) 8%, transparent)';
  } else if (props.isFocused) {
    bgStyle = 'var(--p-surface2)';
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none"
      style={{
        background: bgStyle,
        color: props.isSelected ? 'var(--p-accent-text, var(--p-accent))' : 'var(--p-text)',
        fontWeight: props.isSelected ? 600 : 400,
        transition: 'background 0.1s ease',
      }}
      role="option"
      aria-selected={props.isSelected}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      data-testid={props.testId}
    >
      {/* Check icon for selected state — provides non-color signal */}
      <span className="w-4 flex-shrink-0">
        {props.isSelected && (
          <Check className="w-3.5 h-3.5" style={{ color: 'var(--p-accent)' }} />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-xs truncate">{props.label}</div>
        {props.sublabel && (
          <div
            className="text-[10px] truncate"
            style={{ color: 'var(--p-text-dim)' }}
          >
            {props.sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Primary CTA button
// ---------------------------------------------------------------------------

/**
 * The primary action button in Slot 7. Visual treatment changes by stage:
 *   partial    → outline/default style
 *   tailoring  → accent-tinted style
 *   validation → success/green style with export icon
 */
function PrimaryCtaButton(props: {
  config: PrimaryCtaConfig;
  onClick: () => void;
}) {
  /* Compute button styles based on variant */
  let bgStyle = 'transparent';
  let borderStyle = '1px solid var(--p-border)';
  let colorStyle = 'var(--p-text)';

  if (props.config.variant === 'success') {
    bgStyle = 'var(--p-success)';
    borderStyle = '1px solid var(--p-success)';
    colorStyle = '#ffffff';
  } else if (props.config.variant === 'accent') {
    bgStyle = 'var(--p-accent)';
    borderStyle = '1px solid var(--p-accent)';
    colorStyle = '#ffffff';
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={!props.config.enabled}
      className={'flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
      style={{
        background: props.config.enabled ? bgStyle : 'var(--p-surface2)',
        border: props.config.enabled ? borderStyle : '1px solid var(--p-border)',
        color: props.config.enabled ? colorStyle : 'var(--p-text-dim)',
        opacity: props.config.enabled ? 1 : 0.6,
        cursor: props.config.enabled ? 'pointer' : 'not-allowed',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      aria-label={props.config.label}
      data-testid="primary-cta-button"
    >
      {props.config.stage === 'validation' && <Download className="w-3.5 h-3.5" />}
      {props.config.label}
    </button>
  );
}
