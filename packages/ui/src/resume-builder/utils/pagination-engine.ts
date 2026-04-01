/**
 * ============================================================================
 * PAGINATION ENGINE — Deterministic block-to-page assignment
 * ============================================================================
 *
 * PURPOSE: Converts a ResumeDraft into a PaginatedDocument by:
 *   1. Building an ordered list of DocumentBlocks from the draft data.
 *   2. Estimating each block's rendered height from its content.
 *   3. Assigning blocks to numbered pages using keepTogether rules.
 *
 * This engine runs BEFORE rendering. Its output drives the page-first
 * canvas: each page is a real DOM container holding only the blocks
 * assigned to it. Selection chrome, action bars, and callout anchors
 * are therefore page-local by construction.
 *
 * DETERMINISM: Given the same inputs, this engine always produces the
 * same output. No DOM measurement, no randomness, no side effects.
 *
 * PAGINATION RULES (v1):
 *   - Atomic sections (contact, summary, education, certifications,
 *     skills, federal-details, supporting-evidence) NEVER split across
 *     pages. If an atomic block does not fit on the current page, the
 *     entire block moves to the next page.
 *   - Work Experience splits ONLY at job-entry boundaries. Each job
 *     entry is keepTogether. The section heading stays with the first
 *     job entry.
 *   - A safety margin absorbs height estimation errors so content
 *     does not overflow the page surface in the rendered output.
 *
 * HEIGHT ESTIMATION: Uses heuristic formulas based on content length,
 * line counts, and structural element sizes (headings, margins, padding).
 * These do not need to be pixel-perfect — the safety margin absorbs
 * typical estimation drift of ±30px.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import type { ResumeDraft, ResumeCertification, ResumeSupportingEvidence } from '@pathos/core';
import type {
  DocumentBlock,
  DocumentBlockType,
  DocumentPage,
  PaginatedDocument,
} from '../types/document-block-types';
import {
  PAGE_CONTENT_PX,
  PAGE_SAFETY_MARGIN_PX,
} from '../types/document-block-types';

// ---------------------------------------------------------------------------
// Height estimation constants
// ---------------------------------------------------------------------------

/**
 * Base heights for structural elements that appear in most blocks.
 * These constants are calibrated to the canvas rendering style:
 *   - Section headings: text-xs font-bold uppercase + bottom border + mb-2
 *   - Body text: text-xs leading-relaxed (~18px line height)
 *   - Section margin: mb-4 on most sections (~16px)
 *   - Section wrapper padding: py-2 (~8px top + 8px bottom)
 */
const SECTION_HEADING_HEIGHT = 28;
const SECTION_MARGIN_BOTTOM = 16;
const SECTION_WRAPPER_PADDING = 16;
const BODY_LINE_HEIGHT = 18;
const CHARS_PER_LINE = 85;

/**
 * Estimated character width for line-count calculations. Resume content
 * uses text-xs (12px font) with ~85 characters per line at the default
 * content width (~640px usable after padding).
 */

// ---------------------------------------------------------------------------
// Height estimation: per-block-type functions
// ---------------------------------------------------------------------------

/**
 * Estimate the rendered height of the contact block.
 * Structure: name (large), email | phone | location row, citizenship row.
 */
export function estimateContactHeight(draft: ResumeDraft): number {
  /* Name line: text-lg font-bold = ~28px.
   * Contact details row: text-xs flex-wrap = ~20px.
   * Citizenship/vet row: text-[10px] = ~18px.
   * mb-4 on the section = 16px.
   * Wrapper padding = 16px. */
  let height = 28 + 20 + 18 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  /* If citizenship or veteran status is filled, the row is taller */
  if (draft.contact.citizenship || draft.contact.veteranStatus) {
    height = height + 4;
  }
  return height;
}

/**
 * Estimate the rendered height of the summary block.
 * Structure: section heading + paragraph text.
 */
export function estimateSummaryHeight(summary: string): number {
  if (!summary || summary.trim().length === 0) {
    /* Empty summary shows a placeholder: ~48px including border */
    return SECTION_HEADING_HEIGHT + 48 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  }
  const lineCount = Math.max(1, Math.ceil(summary.length / CHARS_PER_LINE));
  const textHeight = lineCount * BODY_LINE_HEIGHT;
  return SECTION_HEADING_HEIGHT + textHeight + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
}

/**
 * Estimate the rendered height of a single experience entry.
 * Structure: job title row, employer/date/hours row, bullet list.
 *
 * When isFirst is true, the section heading is included (only the
 * first entry in the experience section carries the heading).
 */
export function estimateExperienceEntryHeight(
  duties: string,
  isFirst: boolean
): number {
  /* Job header: title row (~20px) + employer/details row (~18px) + mb-1.5 */
  let height = 20 + 18 + 6;

  /* Count duty bullet lines. Each duty line is one bullet item. */
  const bulletCount = countBulletLines(duties);
  /* Each bullet: text-xs leading-relaxed (~18px) + mb-0.5 (2px) */
  height = height + (bulletCount * 20);

  /* Spacing between entries: mb-3 = 12px */
  height = height + 12;

  if (isFirst) {
    /* First entry includes the "Work Experience" section heading */
    height = height + SECTION_HEADING_HEIGHT;
  }

  height = height + SECTION_WRAPPER_PADDING;

  return height;
}

/**
 * Estimate the rendered height of the education section.
 * Structure: section heading + one entry per education record.
 */
export function estimateEducationHeight(education: ResumeDraft['education']): number {
  if (education.length === 0) {
    return SECTION_HEADING_HEIGHT + 48 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  }
  /* Each education entry: degree/field line (~20px) + institution/date line (~18px) + mb-2 (8px) */
  let height = SECTION_HEADING_HEIGHT;
  for (let i = 0; i < education.length; i++) {
    height = height + 20 + 18 + 8;
  }
  height = height + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  return height;
}

/**
 * Estimate the rendered height of the certifications section.
 * Structure: section heading + comma-separated cert names or entries.
 */
export function estimateCertificationsHeight(certifications: ResumeCertification[]): number {
  if (!certifications || certifications.length === 0) {
    return SECTION_HEADING_HEIGHT + 48 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  }
  /* Certifications are rendered as a comma-separated list or individual items.
   * Estimate ~20px per certification for individual rendering. */
  const itemsHeight = certifications.length * 22;
  return SECTION_HEADING_HEIGHT + itemsHeight + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
}

/**
 * Estimate the rendered height of the skills section.
 * Structure: section heading + comma-separated skill names.
 */
export function estimateSkillsHeight(skills: ResumeDraft['skills']): number {
  if (skills.length === 0) {
    return SECTION_HEADING_HEIGHT + 48 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  }
  /* Concatenate skill names to estimate line wrapping */
  let totalChars = 0;
  for (let i = 0; i < skills.length; i++) {
    totalChars = totalChars + skills[i].name.length;
    if (i < skills.length - 1) {
      totalChars = totalChars + 2;
    }
  }
  const lineCount = Math.max(1, Math.ceil(totalChars / CHARS_PER_LINE));
  const textHeight = lineCount * BODY_LINE_HEIGHT;
  return SECTION_HEADING_HEIGHT + textHeight + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
}

/**
 * Estimate the rendered height of the federal details section.
 * Structure: section heading + 4 detail rows (clearance, vet pref,
 * federal status, highest grade).
 */
export function estimateFederalDetailsHeight(_federalDetails: {
  securityClearance: string;
  veteranPreference: string;
  federalEmployee: boolean;
  highestGrade: string;
} | null): number {
  /* Federal details always renders 4 key-value rows regardless of
   * whether data is present (empty state shows placeholders).
   * The _federalDetails parameter is accepted for API consistency
   * with other estimators — future versions may vary height based
   * on whether each field has content. */
  const rowCount = 4;
  const rowsHeight = rowCount * 30;
  return SECTION_HEADING_HEIGHT + rowsHeight + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
}

/**
 * Estimate the rendered height of the supporting evidence section.
 * Structure: section heading + bulleted list of evidence items.
 */
export function estimateSupportingEvidenceHeight(
  evidence: ResumeSupportingEvidence[]
): number {
  if (!evidence || evidence.length === 0) {
    return SECTION_HEADING_HEIGHT + 48 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  }
  /* Each evidence item: text-xs leading-relaxed, potentially multi-line.
   * Estimate lines per item from character count. */
  let totalHeight = SECTION_HEADING_HEIGHT;
  for (let i = 0; i < evidence.length; i++) {
    const lineCount = Math.max(1, Math.ceil(evidence[i].text.length / CHARS_PER_LINE));
    totalHeight = totalHeight + (lineCount * BODY_LINE_HEIGHT) + 4;
  }
  totalHeight = totalHeight + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING;
  return totalHeight;
}

// ---------------------------------------------------------------------------
// Block builder — converts ResumeDraft into ordered DocumentBlocks
// ---------------------------------------------------------------------------

/**
 * Build an ordered list of DocumentBlocks from the resume draft and
 * associated data. The blocks are in canonical section order (contact,
 * summary, experience entries, education, certifications, skills,
 * federal-details, supporting-evidence).
 *
 * Each block has an estimated height computed from its content. The
 * experience section is decomposed into per-job-entry blocks so the
 * pagination engine can split at job boundaries.
 *
 * HOW THIS FITS: This is phase 1 of the pagination pipeline.
 * The output feeds directly into paginateBlocks().
 */
export function buildDocumentBlocks(
  draft: ResumeDraft,
  federalDetails: {
    securityClearance: string;
    veteranPreference: string;
    federalEmployee: boolean;
    highestGrade: string;
  } | null,
  certifications: ResumeCertification[],
  supportingEvidence: ResumeSupportingEvidence[]
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let order = 0;

  /* ---- Contact (order 0) ---- */
  blocks.push({
    id: 'contact',
    sectionId: 'contact',
    blockType: 'contact' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateContactHeight(draft),
    order: order,
    isFirstInSection: true,
  });
  order = order + 1;

  /* ---- Summary (order 1) ---- */
  blocks.push({
    id: 'summary',
    sectionId: 'summary',
    blockType: 'summary' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateSummaryHeight(draft.summary),
    order: order,
    isFirstInSection: true,
  });
  order = order + 1;

  /* ---- Experience entries (order 2+) ----
   * Each job entry is a separate block. The first entry is flagged
   * isFirstInSection=true so the renderer shows the section heading.
   * If there are no entries, a single placeholder block is created. */
  if (draft.experience.length === 0) {
    blocks.push({
      id: 'experience-empty',
      sectionId: 'experience',
      blockType: 'experience-entry' as DocumentBlockType,
      keepTogether: true,
      estimatedHeight: SECTION_HEADING_HEIGHT + 48 + SECTION_MARGIN_BOTTOM + SECTION_WRAPPER_PADDING,
      order: order,
      isFirstInSection: true,
    });
    order = order + 1;
  } else {
    for (let i = 0; i < draft.experience.length; i++) {
      const exp = draft.experience[i];
      const isFirst = (i === 0);
      blocks.push({
        id: 'experience-' + exp.id,
        sectionId: 'experience',
        blockType: 'experience-entry' as DocumentBlockType,
        keepTogether: true,
        estimatedHeight: estimateExperienceEntryHeight(exp.duties, isFirst),
        order: order,
        isFirstInSection: isFirst,
        experienceId: exp.id,
      });
      order = order + 1;
    }
  }

  /* ---- Education (order N) ---- */
  blocks.push({
    id: 'education',
    sectionId: 'education',
    blockType: 'education' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateEducationHeight(draft.education),
    order: order,
    isFirstInSection: true,
  });
  order = order + 1;

  /* ---- Certifications (order N+1) ---- */
  blocks.push({
    id: 'certifications',
    sectionId: 'certifications',
    blockType: 'certifications' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateCertificationsHeight(certifications),
    order: order,
    isFirstInSection: true,
  });
  order = order + 1;

  /* ---- Skills (order N+2) ---- */
  blocks.push({
    id: 'skills',
    sectionId: 'skills',
    blockType: 'skills' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateSkillsHeight(draft.skills),
    order: order,
    isFirstInSection: true,
  });
  order = order + 1;

  /* ---- Federal Details (order N+3) ---- */
  blocks.push({
    id: 'federal-details',
    sectionId: 'federal-details',
    blockType: 'federal-details' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateFederalDetailsHeight(federalDetails),
    order: order,
    isFirstInSection: true,
  });
  order = order + 1;

  /* ---- Supporting Evidence (order N+4) ---- */
  blocks.push({
    id: 'supporting-evidence',
    sectionId: 'supporting-evidence',
    blockType: 'supporting-evidence' as DocumentBlockType,
    keepTogether: true,
    estimatedHeight: estimateSupportingEvidenceHeight(supportingEvidence),
    order: order,
    isFirstInSection: true,
  });

  return blocks;
}

// ---------------------------------------------------------------------------
// Pagination engine — assigns blocks to pages
// ---------------------------------------------------------------------------

/**
 * Assign blocks to pages using their estimated heights and the
 * keepTogether rules. This is phase 2 of the pagination pipeline.
 *
 * ALGORITHM:
 *   1. Start with page 1 and zero used height.
 *   2. For each block in order:
 *      a. If the block fits on the current page (usedHeight + blockHeight
 *         <= effective page height), add it to the current page.
 *      b. If it does not fit AND keepTogether is true, start a new page
 *         and place the block there.
 *      c. If a block is taller than a full page (e.g. very long summary),
 *         place it on a fresh page anyway — it may overflow but this is
 *         the best we can do without splitting.
 *   3. Return the complete PaginatedDocument.
 *
 * The effective page height is PAGE_CONTENT_PX minus PAGE_SAFETY_MARGIN_PX
 * to absorb estimation errors.
 *
 * HOW THIS FITS: This is phase 2. Input: blocks from buildDocumentBlocks().
 * Output: PaginatedDocument consumed by the page-first renderer.
 */
export function paginateBlocks(blocks: DocumentBlock[]): PaginatedDocument {
  /* Effective height available per page after safety margin. This is
   * the maximum usedHeight before a new page is started. */
  const effectivePageHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;

  /* Sort blocks by canonical order to guarantee determinism.
   * The input should already be sorted from buildDocumentBlocks,
   * but sorting here makes the function robust to any caller. */
  const sorted: DocumentBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    sorted.push(blocks[i]);
  }
  sorted.sort(function (a, b) { return a.order - b.order; });

  /* Initialize the first page */
  const pages: DocumentPage[] = [];
  let currentPage: DocumentPage = {
    pageNumber: 1,
    blocks: [],
    usedHeight: 0,
  };
  pages.push(currentPage);

  /* Process each block */
  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];
    const wouldFit = (currentPage.usedHeight + block.estimatedHeight) <= effectivePageHeight;

    if (wouldFit) {
      /* Block fits on the current page — add it. */
      currentPage.blocks.push(block);
      currentPage.usedHeight = currentPage.usedHeight + block.estimatedHeight;
    } else {
      /* Block does not fit. Since all v1 blocks are keepTogether,
       * start a new page and place the block there.
       *
       * Special case: if the current page is empty (no blocks yet),
       * the block is taller than a full page. Place it anyway to
       * avoid an infinite loop of creating empty pages. */
      if (currentPage.blocks.length === 0) {
        currentPage.blocks.push(block);
        currentPage.usedHeight = currentPage.usedHeight + block.estimatedHeight;
      } else {
        /* Start a new page */
        currentPage = {
          pageNumber: pages.length + 1,
          blocks: [],
          usedHeight: 0,
        };
        pages.push(currentPage);
        currentPage.blocks.push(block);
        currentPage.usedHeight = currentPage.usedHeight + block.estimatedHeight;
      }
    }
  }

  /* Count total blocks */
  let blockCount = 0;
  for (let i = 0; i < pages.length; i++) {
    blockCount = blockCount + pages[i].blocks.length;
  }

  return {
    pages: pages,
    totalPages: pages.length,
    blockCount: blockCount,
  };
}

// ---------------------------------------------------------------------------
// Convenience: full pipeline in one call
// ---------------------------------------------------------------------------

/**
 * Run the full pagination pipeline: build blocks → paginate.
 * This is the primary entry point for the canvas renderer.
 *
 *   draft:            The current resume draft.
 *   federalDetails:   Federal details data (not yet in core model).
 *   certifications:   Certifications array.
 *   supportingEvidence: Supporting evidence array.
 *
 * Returns a PaginatedDocument ready for page-first rendering.
 */
export function paginateResume(
  draft: ResumeDraft,
  federalDetails: {
    securityClearance: string;
    veteranPreference: string;
    federalEmployee: boolean;
    highestGrade: string;
  } | null,
  certifications: ResumeCertification[],
  supportingEvidence: ResumeSupportingEvidence[]
): PaginatedDocument {
  const blocks = buildDocumentBlocks(draft, federalDetails, certifications, supportingEvidence);
  return paginateBlocks(blocks);
}

// ---------------------------------------------------------------------------
// Helper: group consecutive blocks by sectionId within a page
// ---------------------------------------------------------------------------

/**
 * Groups consecutive blocks on a page by their sectionId. This is used
 * by the renderer to wrap related blocks in a single CanvasSectionWrapper.
 *
 * Example: If a page has blocks [exp-1, exp-2, education], this returns:
 *   [
 *     { sectionId: 'experience', blocks: [exp-1, exp-2] },
 *     { sectionId: 'education',  blocks: [education] }
 *   ]
 *
 * Experience entries that are consecutive get grouped so they render
 * inside one section wrapper per page (with appropriate heading logic).
 */
export interface BlockGroup {
  sectionId: string;
  blocks: DocumentBlock[];
}

export function groupBlocksBySectionId(blocks: DocumentBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  if (blocks.length === 0) return groups;

  let currentGroup: BlockGroup = {
    sectionId: blocks[0].sectionId,
    blocks: [blocks[0]],
  };

  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].sectionId === currentGroup.sectionId) {
      currentGroup.blocks.push(blocks[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        sectionId: blocks[i].sectionId,
        blocks: [blocks[i]],
      };
    }
  }
  groups.push(currentGroup);

  return groups;
}

// ---------------------------------------------------------------------------
// Helper: count bullet lines in a duties string
// ---------------------------------------------------------------------------

/**
 * Count the number of non-empty bullet lines in a duties string.
 * Splits on newlines and counts lines that have content after
 * stripping bullet prefixes (•, -, *).
 */
export function countBulletLines(duties: string): number {
  if (!duties) return 0;
  const lines = duties.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(/^[•\-*]\s*/, '').trim();
    if (cleaned.length > 0) {
      count = count + 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helper: get experience IDs on a page
// ---------------------------------------------------------------------------

/**
 * Extract the experience entry IDs from the blocks on a page (or group).
 * Used by the renderer to filter the draft.experience array to only
 * the entries assigned to a given page.
 */
export function getExperienceIdsFromBlocks(blocks: DocumentBlock[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].blockType === 'experience-entry' && blocks[i].experienceId) {
      ids.push(blocks[i].experienceId as string);
    }
  }
  return ids;
}

/**
 * Check whether any block in a group is the first in its section.
 * Used to decide whether to render the section heading.
 */
export function groupContainsFirstBlock(blocks: DocumentBlock[]): boolean {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].isFirstInSection) {
      return true;
    }
  }
  return false;
}
