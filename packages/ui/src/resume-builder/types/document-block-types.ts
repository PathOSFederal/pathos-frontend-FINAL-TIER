/**
 * ============================================================================
 * DOCUMENT BLOCK MODEL — Pagination-first resume layout types
 * ============================================================================
 *
 * PURPOSE: Defines the block-level document model for the Resume Builder's
 * pagination engine. Every rendered part of the resume is represented as a
 * typed block with enough metadata to paginate BEFORE rendering. This is
 * the foundation for a deterministic, page-first layout model.
 *
 * ARCHITECTURE:
 *   The pipeline works in three phases:
 *     1. BUILD: Convert the ResumeDraft into an ordered list of blocks.
 *     2. PAGINATE: Assign blocks to numbered pages using height estimates
 *        and keepTogether / split rules.
 *     3. RENDER: Each page is a real DOM container; blocks render inside
 *        their assigned page surface.
 *
 *   This replaces the previous model where content flowed as one continuous
 *   column with absolute-positioned page backgrounds and a single spacer
 *   injected post-hoc. That model caused selection chrome, action bars,
 *   and section borders to cross page boundaries visually.
 *
 * PAGINATION RULES (v1):
 *   - Contact, Summary, Education, Certifications, Skills, Federal Details,
 *     and Supporting Evidence are ATOMIC — they never split across pages.
 *   - Work Experience splits ONLY at job-entry boundaries. A single job
 *     entry (title + employer + duties) is never torn across pages.
 *   - The experience section heading stays with the first job entry.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Block type identifiers — every visual unit in the resume document
// ---------------------------------------------------------------------------

/**
 * Identifies the type of document block. Each type maps to a specific
 * visual unit in the resume and carries its own rendering logic.
 *
 *   contact:              Full contact/header block (name, email, phone, etc.)
 *   summary:              Professional summary paragraph.
 *   experience-entry:     A single work experience job (header + bullets).
 *                         The first entry in the section also carries the
 *                         section heading ("Work Experience").
 *   education:            Full education section (heading + all entries).
 *   certifications:       Full certifications section (heading + all certs).
 *   skills:               Full skills section (heading + skill list).
 *   federal-details:      Full federal details section (heading + fields).
 *   supporting-evidence:  Full supporting evidence section (heading + items).
 */
export type DocumentBlockType =
  | 'contact'
  | 'summary'
  | 'experience-entry'
  | 'education'
  | 'certifications'
  | 'skills'
  | 'federal-details'
  | 'supporting-evidence';

// ---------------------------------------------------------------------------
// Document block — the atomic unit of the pagination pipeline
// ---------------------------------------------------------------------------

/**
 * A single block in the document layout pipeline. Blocks are built from
 * the ResumeDraft in canonical order, then assigned to pages by the
 * pagination engine based on their estimated height and keepTogether flag.
 *
 * The block carries enough metadata for the pagination engine to make
 * page-assignment decisions without needing the DOM. After pagination,
 * the renderer uses the block's type and data references to produce
 * the correct visual output inside its assigned page surface.
 */
export interface DocumentBlock {
  /** Unique block identifier. Format: "{sectionId}" or "{sectionId}-{entryId}". */
  id: string;

  /** Which resume section this block belongs to. Maps to the canonical
   *  section IDs from federal-section-meta (contact, summary, experience,
   *  education, certifications, skills, federal-details, supporting-evidence). */
  sectionId: string;

  /** Block type — determines which renderer handles this block. */
  blockType: DocumentBlockType;

  /** When true, the pagination engine must NOT split this block across
   *  a page boundary. If it does not fit on the current page, the entire
   *  block moves to the next page.
   *
   *  All block types are keepTogether=true in v1. Individual experience
   *  entries are keepTogether=true (the SECTION can span pages, but each
   *  JOB ENTRY stays intact on one page). */
  keepTogether: boolean;

  /** Estimated rendered height in pixels. Computed from content length
   *  and structure before rendering. Used by the pagination engine to
   *  decide page assignment. Does not need to be pixel-perfect — the
   *  pagination engine includes a safety margin. */
  estimatedHeight: number;

  /** Canonical sort position. Blocks are sorted by this value before
   *  pagination to guarantee deterministic ordering. */
  order: number;

  /** When true, this is the first block in its section. Used by the
   *  renderer to decide whether to show the section heading. For
   *  experience, only the first job entry shows "Work Experience". */
  isFirstInSection: boolean;

  /** For experience-entry blocks: the experience entry ID from the draft.
   *  Used to filter the experience array when rendering a subset of
   *  jobs on a given page. */
  experienceId?: string;
}

// ---------------------------------------------------------------------------
// Paginated page — a group of blocks assigned to one page surface
// ---------------------------------------------------------------------------

/**
 * Represents one page in the paginated document. Contains the blocks
 * assigned to this page and tracks how much vertical space they consume.
 */
export interface DocumentPage {
  /** 1-based page number (page 1, page 2, etc.). */
  pageNumber: number;

  /** Blocks assigned to this page, in rendering order. */
  blocks: DocumentBlock[];

  /** Total estimated height consumed by the blocks on this page.
   *  Used for debugging and validation — should not exceed the
   *  page content area height. */
  usedHeight: number;
}

// ---------------------------------------------------------------------------
// Paginated document — the complete page-first layout result
// ---------------------------------------------------------------------------

/**
 * The output of the pagination engine. Contains all pages with their
 * assigned blocks. This is the primary input to the page-first renderer.
 *
 * DETERMINISM: Given the same draft data, the pagination engine must
 * always produce the same PaginatedDocument. No randomness, no DOM
 * dependency, no measurement-race conditions.
 */
export interface PaginatedDocument {
  /** Ordered array of pages. Page 1 is at index 0. */
  pages: DocumentPage[];

  /** Total number of pages in the document. */
  totalPages: number;

  /** Total number of blocks across all pages. */
  blockCount: number;
}

// ---------------------------------------------------------------------------
// Page layout constants — shared between pagination engine and renderer
// ---------------------------------------------------------------------------

/**
 * Layout constants for the resume document page model. These are the
 * single source of truth for page dimensions. Both the pagination engine
 * and the canvas renderer must use these values.
 *
 * US Letter at 96 DPI:
 *   Width:  8.5in * 96dpi = 816px
 *   Height: 11in  * 96dpi = 1056px
 *
 * The content area subtracts vertical padding (top 40px + bottom 40px = 80px)
 * to get the usable space for resume content within a single page.
 */
export const PAGE_HEIGHT_PX = 1056;
export const PAGE_CONTENT_PX = 976;
export const PAGE_GAP_PX = 40;
export const PAGE_PADDING_TOP_PX = 40;
export const PAGE_PADDING_BOTTOM_PX = 40;
export const PAGE_PADDING_HORIZONTAL = '3rem';

/**
 * Safety margin subtracted from PAGE_CONTENT_PX when deciding whether
 * a block fits on the current page. This absorbs estimation errors —
 * if the actual rendered height is slightly taller than estimated, the
 * content still fits within the page surface without overflowing.
 *
 * Increased from 48px to 72px to give the deterministic PDF renderer
 * room for its more generous spacing tokens (tuned to match the print
 * reference). The extra 24px (~1.3 lines) per page means the engine
 * allocates slightly fewer blocks per page, producing a less cramped
 * page rhythm and better page-break pacing that matches the browser-
 * print visual reference.
 */
export const PAGE_SAFETY_MARGIN_PX = 72;
