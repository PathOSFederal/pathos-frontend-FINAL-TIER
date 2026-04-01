/**
 * ============================================================================
 * DETERMINISTIC PDF EXPORT — Application-owned resume PDF generation
 * ============================================================================
 *
 * PURPOSE: Produces a clean PDF from the same PaginatedDocument model used
 * by the live workspace canvas and preview overlay. This replaces the
 * browser-print-based export path (window.print()) with a deterministic,
 * application-controlled pipeline that produces identical output regardless
 * of browser, OS, or print dialog settings.
 *
 * WHY NOT BROWSER PRINT:
 *   - Browser print injects metadata (date, URL, page title) around resume
 *   - Browser print dialog settings vary across users and browsers
 *   - Browser print preview can show wrong page count
 *   - Browser-controlled page breaks weaken deterministic export fidelity
 *   - No way to remove browser chrome from the PDF programmatically
 *
 * ARCHITECTURE:
 *   1. Takes a PaginatedDocument (from paginateResume()) + ResumeDraft as input
 *   2. Creates a jsPDF document with US Letter page dimensions
 *   3. For each page in the paginated model, renders section blocks using
 *      jsPDF text drawing commands — no DOM scraping, no canvas screenshot
 *   4. Returns a Blob for download or triggers a direct file save
 *
 * ATS SAFETY:
 *   The output is a text-based PDF. All resume content is real, selectable,
 *   searchable text — not rasterized images. This preserves ATS readability.
 *   Standard PDF fonts (Helvetica family) are used for maximum compatibility.
 *
 * PAGE-COUNT PARITY:
 *   The PDF page count equals the PaginatedDocument page count. Each page
 *   in the model produces exactly one PDF page. The same pagination engine
 *   drives both the workspace canvas and the PDF export — no second
 *   pagination path exists.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import { jsPDF } from 'jspdf';
import type { ResumeDraft } from '@pathos/core';
import type {
  DocumentPage,
  PaginatedDocument,
} from '../types/document-block-types';
import {
  groupBlocksBySectionId,
  getExperienceIdsFromBlocks,
  groupContainsFirstBlock,
} from './pagination-engine';
import type { BlockGroup } from './pagination-engine';

// ---------------------------------------------------------------------------
// Unit conversion: CSS px (96 DPI) → PDF points (72 DPI)
// ---------------------------------------------------------------------------

/**
 * Converts CSS pixels (at 96 DPI) to PDF points (at 72 DPI).
 * CSS uses 96 pixels per inch; PDF uses 72 points per inch.
 * Formula: points = pixels * (72 / 96) = pixels * 0.75
 */
function pxToPt(px: number): number {
  return px * 0.75;
}

// ---------------------------------------------------------------------------
// Page layout constants (in PDF points)
// ---------------------------------------------------------------------------

/**
 * PDF page dimensions in points. US Letter: 8.5in x 11in.
 * 8.5 * 72 = 612pt, 11 * 72 = 792pt.
 */
const PDF_PAGE_WIDTH_PT = 612;
const PDF_PAGE_HEIGHT_PT = 792;

/**
 * Page margins in points. These are tuned to match the visual feel of
 * the browser-print reference (testResume3.pdf), not mechanically
 * converted from CSS padding. The print reference has more generous
 * top margin (~0.55in) than the CSS 40px (0.42in), so we use 40pt
 * to bring the deterministic PDF into visual parity.
 *
 * Horizontal margins stay at 36pt (48px * 0.75) to match content width.
 */
export const MARGIN_TOP_PT = 40;
export const MARGIN_BOTTOM_PT = 30;
const MARGIN_LEFT_PT = 36;
const MARGIN_RIGHT_PT = 36;

/**
 * Usable content width in points (page width minus left+right margins).
 * 612 - 36 - 36 = 540pt
 */
const CONTENT_WIDTH_PT = PDF_PAGE_WIDTH_PT - MARGIN_LEFT_PT - MARGIN_RIGHT_PT;

// ---------------------------------------------------------------------------
// Font sizing constants (in PDF points)
// ---------------------------------------------------------------------------

/**
 * Font sizes derived from the preview's CSS classes:
 *   text-2xl   = 24px → 18pt   (contact name)
 *   text-sm    = 14px → 10.5pt (contact details)
 *   text-[13px]= 13px → 9.75pt (body text)
 *   text-xs    = 12px → 9pt    (section headings)
 *   text-[10px]= 10px → 7.5pt  (citizenship line)
 */
const FONT_NAME_PT = 18;
const FONT_CONTACT_PT = 10;
const FONT_BODY_PT = 9.5;
const FONT_HEADING_PT = 9;
const FONT_SMALL_PT = 7.5;

/**
 * Line height multiplier for body text. Matches Tailwind leading-relaxed
 * (line-height: 1.625). Applied to body font size for line spacing.
 */
const LINE_HEIGHT_MULTIPLIER = 1.625;

// ---------------------------------------------------------------------------
// Spacing tokens — central hierarchy and breathing room constants
// ---------------------------------------------------------------------------
//
// These tokens control the visual spacing throughout the exported PDF.
// Keeping them in one place makes it easy to tune the document's feel
// without hunting through individual renderers. Each token is named for
// the gap it controls, not the raw point value, so the intent is clear.
//
// DESIGN RATIONALE: Federal resumes must be ATS-safe and scannable.
// Generous spacing between the header block, section headings, and
// content rows improves readability without wasting vertical space.
// The values were tuned to provide clear visual hierarchy while staying
// within the pagination engine's PAGE_SAFETY_MARGIN_PX budget (48px /
// 36pt), so page-count parity between preview and PDF is preserved.
// ---------------------------------------------------------------------------

/** Gap below the candidate name before the contact details line.
 *  Tuned to 8pt so the large bold name has generous visual separation
 *  from the smaller contact details line below. The print reference
 *  (testResume3.pdf) shows roughly 0.11in of whitespace here. */
export const SPACING_AFTER_NAME_PT = 8;

/** Gap below the contact details line (email | phone | city) before the
 *  citizenship / veteran-preference line, when present. Set to 4pt so
 *  the smaller citizenship text reads as a sub-line rather than running
 *  into the contact details above it. */
export const SPACING_AFTER_CONTACT_LINE_PT = 4;

/** Gap below the last header element (citizenship or contact line)
 *  before the horizontal separator rule. Set to 10pt so the header
 *  block has a clean, finished bottom edge with visible breathing
 *  room before the rule. Matches the print reference rhythm. */
export const SPACING_BEFORE_HEADER_RULE_PT = 10;

/** Gap below the horizontal separator rule before the first body
 *  section. This is the primary breathing space between the header
 *  block and the resume body — the single most impactful gap for
 *  "cramped header" perception. Set to 18pt to match the print
 *  reference's generous header-to-body transition, which visually
 *  separates the header block from the resume content below. */
export const SPACING_AFTER_HEADER_RULE_PT = 18;

/** Gap between adjacent sections in the resume body. Applied by the
 *  page renderer before every section except the first on each page.
 *  Set to 24pt for deliberate, visually calm section transitions that
 *  match the print reference's rhythm. Enough space that sections
 *  feel like distinct visual blocks without wasting vertical space. */
export const SECTION_GAP_PT = 24;

/** Distance from section heading text baseline to the thin underline
 *  rule that visually anchors the heading. Set to 6pt for clean heading
 *  geometry — the underline feels deliberately placed, not crowding
 *  the text. */
export const SPACING_HEADING_TO_UNDERLINE_PT = 6;

/** Gap below the section heading's underline rule before the first
 *  content row. Set to 12pt so the heading reads as a clear label
 *  for the content below, with enough space that the underline
 *  separates heading from content rather than blending them. */
export const SPACING_AFTER_HEADING_UNDERLINE_PT = 12;

/** Gap after the job-title / date row before the employer / meta row.
 *  Set to 4pt so the bold title row and the lighter employer row read
 *  as a logical pair with clear but not excessive separation. */
export const SPACING_AFTER_JOB_TITLE_ROW_PT = 4;

/** Gap after the employer / meta row before the first duty bullet.
 *  Set to 6pt for a clearer boundary between the entry metadata
 *  (title + employer) and the accomplishment bullets below. This
 *  prevents the metadata rows from visually merging into the bullets. */
export const SPACING_AFTER_EMPLOYER_ROW_PT = 6;

/** Gap between successive experience (or education) entries within a
 *  section. Set to 15pt so each entry has its own visual territory —
 *  this is the most impactful token for eliminating the cramped
 *  feeling in the Work Experience section. At 15pt, entries read as
 *  distinct items rather than a continuous wall of text. */
export const SPACING_BETWEEN_ENTRIES_PT = 15;

/** Micro gap between individual bullet items within an experience
 *  entry. Set to 3pt so each bullet is individually scannable rather
 *  than blending into an undifferentiated wall of text. The print
 *  reference shows perceptible per-bullet breathing. */
export const SPACING_BETWEEN_BULLETS_PT = 3;

/** Extra top padding on pages 2+ (continuation pages). Page 1 has the
 *  contact block which provides natural header breathing room. On pages
 *  2+, the first section (often "Work Experience (continued)") would
 *  otherwise start abruptly at MARGIN_TOP_PT. This token adds
 *  comfortable top breathing so page 2+ openings feel intentional
 *  and unhurried, matching the professional pacing of the print
 *  reference. */
export const PAGE_CONTINUATION_TOP_EXTRA_PT = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Federal details input type, matching the shape passed through
 * the preview overlay. Kept inline to avoid coupling to screen-level
 * type definitions.
 */
export interface PdfFederalDetails {
  securityClearance: string;
  veteranPreference: string;
  federalEmployee: boolean;
  highestGrade: string;
}

/**
 * Input contract for the PDF export function. All data needed to
 * produce the PDF is passed explicitly — no global state, no DOM access.
 */
export interface PdfExportInput {
  /** The paginated document from paginateResume(). */
  paginatedDoc: PaginatedDocument;
  /** The current resume draft. */
  draft: ResumeDraft;
  /** Federal details (may be null if not provided). */
  federalDetails: PdfFederalDetails | null;
}

/**
 * Result from the PDF export. Contains the Blob and filename for download.
 */
export interface PdfExportResult {
  /** The generated PDF as a Blob. */
  blob: Blob;
  /** Suggested filename for the download. */
  filename: string;
  /** Number of pages in the generated PDF. */
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Cursor tracker — tracks the vertical drawing position on each page
// ---------------------------------------------------------------------------

/**
 * Internal state for the PDF renderer. Tracks where the next content
 * should be drawn vertically on the current page.
 */
interface RenderCursor {
  /** Current vertical position in points from the top of the page. */
  y: number;
}

// ---------------------------------------------------------------------------
// PDF text helper functions
// ---------------------------------------------------------------------------

/**
 * Draws a line of text at the specified position.
 * Returns the new Y position after the text.
 */
function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontStyle: string,
  color: string,
  options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }
): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);

  /* Parse hex color to RGB values for jsPDF */
  const r = parseInt(color.substring(1, 3), 16);
  const g = parseInt(color.substring(3, 5), 16);
  const b = parseInt(color.substring(5, 7), 16);
  doc.setTextColor(r, g, b);

  const align = (options && options.align) ? options.align : 'left';
  const maxWidth = (options && options.maxWidth) ? options.maxWidth : undefined;

  if (maxWidth) {
    /* Wrap text to fit within maxWidth. jsPDF splitTextToSize returns
     * an array of lines that fit within the specified width. */
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;

    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], x, y, { align: align });
      y = y + lineHeight;
    }
    return y;
  }

  doc.text(text, x, y, { align: align });
  return y + fontSize * LINE_HEIGHT_MULTIPLIER;
}

/**
 * Draws a horizontal line (rule) across the content area.
 * Used as a separator below the contact section. The returned Y
 * position includes SPACING_AFTER_HEADER_RULE_PT so the caller gets
 * the ready-to-draw position for the next element.
 */
function drawHorizontalRule(
  doc: jsPDF,
  y: number,
  color: string
): number {
  const r = parseInt(color.substring(1, 3), 16);
  const g = parseInt(color.substring(3, 5), 16);
  const b = parseInt(color.substring(5, 7), 16);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT_PT, y, PDF_PAGE_WIDTH_PT - MARGIN_RIGHT_PT, y);
  return y + SPACING_AFTER_HEADER_RULE_PT;
}

/**
 * Draws an uppercase section heading with consistent formatting.
 * Returns the new Y position after the heading and its bottom spacing.
 * Uses SPACING_HEADING_TO_UNDERLINE_PT for the gap between heading text
 * and underline, and SPACING_AFTER_HEADING_UNDERLINE_PT for the gap
 * between underline and the first content row.
 */
function drawSectionHeading(
  doc: jsPDF,
  text: string,
  y: number
): number {
  doc.setFontSize(FONT_HEADING_PT);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(text.toUpperCase(), MARGIN_LEFT_PT, y);

  /* Thin line below the heading for visual structure. Positioned using
   * the heading-to-underline spacing token. */
  const lineY = y + SPACING_HEADING_TO_UNDERLINE_PT;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT_PT, lineY, PDF_PAGE_WIDTH_PT - MARGIN_RIGHT_PT, lineY);

  return lineY + SPACING_AFTER_HEADING_UNDERLINE_PT;
}

/**
 * Parses a duties string into individual cleaned bullet lines.
 * Strips bullet prefixes (dot, dash, asterisk) and blank lines.
 */
function parseDutyLines(duties: string): string[] {
  const lines = duties.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(/^[•\-*]\s*/, '').trim();
    if (cleaned.length > 0) {
      result.push(cleaned);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-section renderers
// ---------------------------------------------------------------------------

/**
 * Renders the contact block: centered name, contact details, citizenship.
 * Uses dedicated spacing tokens between the name, contact line, citizenship
 * line, and the separator rule to prevent the header from feeling cramped.
 */
function renderContact(
  doc: jsPDF,
  draft: ResumeDraft,
  cursor: RenderCursor
): void {
  const contact = draft.contact;
  const centerX = PDF_PAGE_WIDTH_PT / 2;

  /* Full name — large, bold, centered */
  const nameText = contact.fullName || 'Your Name';
  cursor.y = drawText(doc, nameText, centerX, cursor.y, FONT_NAME_PT, 'bold', '#000000', { align: 'center' });

  /* Breathing room between the prominent name and smaller contact details */
  cursor.y = cursor.y + SPACING_AFTER_NAME_PT;

  /* Contact details line — email | phone | city, state */
  const detailParts: string[] = [];
  if (contact.email) detailParts.push(contact.email);
  if (contact.phone) detailParts.push(contact.phone);
  if (contact.city && contact.state) {
    detailParts.push(contact.city + ', ' + contact.state);
  }
  if (detailParts.length > 0) {
    cursor.y = drawText(
      doc,
      detailParts.join(' | '),
      centerX,
      cursor.y,
      FONT_CONTACT_PT,
      'normal',
      '#444444',
      { align: 'center' }
    );

    /* Small gap before citizenship line when both are present */
    cursor.y = cursor.y + SPACING_AFTER_CONTACT_LINE_PT;
  }

  /* Citizenship / veteran preference line */
  const citizenParts: string[] = [];
  if (contact.citizenship) citizenParts.push(contact.citizenship);
  if (contact.veteranStatus && contact.veteranStatus !== 'N/A') {
    citizenParts.push('Veteran Preference: ' + contact.veteranStatus);
  }
  if (citizenParts.length > 0) {
    cursor.y = drawText(
      doc,
      citizenParts.join(' | '),
      centerX,
      cursor.y,
      FONT_SMALL_PT,
      'normal',
      '#666666',
      { align: 'center' }
    );
  }

  /* Separator line below contact — uses SPACING_BEFORE_HEADER_RULE_PT for
   * the gap between the last contact element and the rule, and
   * drawHorizontalRule internally adds SPACING_AFTER_HEADER_RULE_PT. */
  cursor.y = drawHorizontalRule(doc, cursor.y + SPACING_BEFORE_HEADER_RULE_PT, '#cccccc');
}

/**
 * Renders the professional summary section.
 */
function renderSummary(
  doc: jsPDF,
  summary: string,
  cursor: RenderCursor
): void {
  cursor.y = drawSectionHeading(doc, 'Professional Summary', cursor.y);
  cursor.y = drawText(
    doc,
    summary,
    MARGIN_LEFT_PT,
    cursor.y,
    FONT_BODY_PT,
    'normal',
    '#111111',
    { maxWidth: CONTENT_WIDTH_PT }
  );
}

/**
 * Renders experience entries for a single page. Handles both "Work
 * Experience" and "Work Experience (continued)" headings based on
 * whether this page contains the first experience block.
 */
function renderExperience(
  doc: jsPDF,
  draft: ResumeDraft,
  group: BlockGroup,
  showHeader: boolean,
  cursor: RenderCursor
): void {
  /* Filter to only the experience entries assigned to this page */
  const expIds = getExperienceIdsFromBlocks(group.blocks);
  const entries: ResumeDraft['experience'] = [];
  for (let i = 0; i < draft.experience.length; i++) {
    for (let j = 0; j < expIds.length; j++) {
      if (draft.experience[i].id === expIds[j]) {
        entries.push(draft.experience[i]);
        break;
      }
    }
  }

  if (entries.length === 0) return;

  /* Section heading — uses "(continued)" label on non-first pages so
   * the reader knows the section spans multiple pages intentionally. */
  const headingText = showHeader ? 'Work Experience' : 'Work Experience (continued)';
  cursor.y = drawSectionHeading(doc, headingText, cursor.y);

  /* Each experience entry */
  for (let i = 0; i < entries.length; i++) {
    const exp = entries[i];

    /* Job title (left) and dates (right) on the same line */
    doc.setFontSize(FONT_BODY_PT);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(exp.jobTitle, MARGIN_LEFT_PT, cursor.y);

    /* Date range — right-aligned */
    const dateText = exp.startDate + ' \u2013 ' + exp.endDate;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 85, 85);
    doc.setFontSize(FONT_HEADING_PT);
    doc.text(dateText, PDF_PAGE_WIDTH_PT - MARGIN_RIGHT_PT, cursor.y, { align: 'right' });

    /* Advance past the job-title row, then add the explicit gap before
     * the employer/meta row. */
    cursor.y = cursor.y + FONT_BODY_PT * LINE_HEIGHT_MULTIPLIER;
    cursor.y = cursor.y + SPACING_AFTER_JOB_TITLE_ROW_PT;

    /* Employer | Grade | Hours line */
    let employerLine = exp.employer;
    if (exp.grade) employerLine = employerLine + ' | ' + exp.grade;
    if (exp.hoursPerWeek) employerLine = employerLine + ' | ' + exp.hoursPerWeek + ' hrs/wk';

    cursor.y = drawText(doc, employerLine, MARGIN_LEFT_PT, cursor.y, FONT_HEADING_PT, 'normal', '#444444');

    /* Gap between the employer row and the first duty bullet */
    cursor.y = cursor.y + SPACING_AFTER_EMPLOYER_ROW_PT;

    /* Duty bullets */
    const dutyLines = parseDutyLines(exp.duties);
    const bulletIndent = MARGIN_LEFT_PT + 12;
    const bulletContentWidth = CONTENT_WIDTH_PT - 12;

    for (let d = 0; d < dutyLines.length; d++) {
      /* Draw bullet marker */
      doc.setFontSize(FONT_BODY_PT);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(17, 17, 17);
      doc.text('\u2022', MARGIN_LEFT_PT + 4, cursor.y);

      /* Draw bullet text with wrapping */
      cursor.y = drawText(
        doc,
        dutyLines[d],
        bulletIndent,
        cursor.y,
        FONT_BODY_PT,
        'normal',
        '#111111',
        { maxWidth: bulletContentWidth }
      );

      /* Micro gap between bullets to prevent a wall-of-text feel */
      if (d < dutyLines.length - 1) {
        cursor.y = cursor.y + SPACING_BETWEEN_BULLETS_PT;
      }
    }

    /* Spacing between experience entries */
    cursor.y = cursor.y + SPACING_BETWEEN_ENTRIES_PT;
  }
}

/**
 * Renders the education section.
 */
function renderEducation(
  doc: jsPDF,
  education: ResumeDraft['education'],
  cursor: RenderCursor
): void {
  if (education.length === 0) return;

  cursor.y = drawSectionHeading(doc, 'Education', cursor.y);

  for (let i = 0; i < education.length; i++) {
    const edu = education[i];

    /* Degree, Field — bold */
    cursor.y = drawText(
      doc,
      edu.degree + ', ' + edu.field,
      MARGIN_LEFT_PT,
      cursor.y,
      FONT_BODY_PT,
      'bold',
      '#000000'
    );

    /* Institution | Date | GPA */
    let detailLine = edu.institution + ' | ' + edu.graduationDate;
    if (edu.gpa) detailLine = detailLine + ' | GPA: ' + edu.gpa;
    cursor.y = drawText(doc, detailLine, MARGIN_LEFT_PT, cursor.y, FONT_HEADING_PT, 'normal', '#444444');
    cursor.y = cursor.y + SPACING_BETWEEN_ENTRIES_PT;
  }
}

/**
 * Renders the certifications section.
 */
function renderCertifications(
  doc: jsPDF,
  certifications: ResumeDraft['certifications'],
  cursor: RenderCursor
): void {
  if (!certifications || certifications.length === 0) return;

  cursor.y = drawSectionHeading(doc, 'Certifications', cursor.y);

  const names: string[] = [];
  for (let i = 0; i < certifications.length; i++) {
    names.push(certifications[i].name);
  }
  cursor.y = drawText(
    doc,
    names.join(', '),
    MARGIN_LEFT_PT,
    cursor.y,
    FONT_BODY_PT,
    'normal',
    '#111111',
    { maxWidth: CONTENT_WIDTH_PT }
  );
}

/**
 * Renders the skills section.
 */
function renderSkills(
  doc: jsPDF,
  skills: ResumeDraft['skills'],
  cursor: RenderCursor
): void {
  if (skills.length === 0) return;

  cursor.y = drawSectionHeading(doc, 'Skills', cursor.y);

  const names: string[] = [];
  for (let i = 0; i < skills.length; i++) {
    names.push(skills[i].name);
  }
  cursor.y = drawText(
    doc,
    names.join(', '),
    MARGIN_LEFT_PT,
    cursor.y,
    FONT_BODY_PT,
    'normal',
    '#111111',
    { maxWidth: CONTENT_WIDTH_PT }
  );
}

/**
 * Renders the federal details section.
 */
function renderFederalDetails(
  doc: jsPDF,
  federalDetails: PdfFederalDetails,
  cursor: RenderCursor
): void {
  cursor.y = drawSectionHeading(doc, 'Federal Details', cursor.y);

  const rows = [
    'Security Clearance: ' + (federalDetails.securityClearance || 'Not specified'),
    'Highest Grade Held: ' + (federalDetails.highestGrade || 'Not specified'),
    'Federal Employee: ' + (federalDetails.federalEmployee ? 'Yes' : 'No'),
    'Veteran Preference: ' + (federalDetails.veteranPreference || 'Not specified'),
  ];

  for (let i = 0; i < rows.length; i++) {
    cursor.y = drawText(doc, rows[i], MARGIN_LEFT_PT, cursor.y, FONT_BODY_PT, 'normal', '#111111');
  }
}

/**
 * Renders the supporting evidence section.
 */
function renderSupportingEvidence(
  doc: jsPDF,
  evidence: ResumeDraft['supportingEvidence'],
  cursor: RenderCursor
): void {
  if (!evidence || evidence.length === 0) return;

  cursor.y = drawSectionHeading(doc, 'Supporting Evidence', cursor.y);

  const bulletIndent = MARGIN_LEFT_PT + 12;
  const bulletContentWidth = CONTENT_WIDTH_PT - 12;

  for (let i = 0; i < evidence.length; i++) {
    /* Bullet marker */
    doc.setFontSize(FONT_BODY_PT);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 17, 17);
    doc.text('\u2022', MARGIN_LEFT_PT + 4, cursor.y);

    /* Evidence text with wrapping */
    cursor.y = drawText(
      doc,
      evidence[i].text,
      bulletIndent,
      cursor.y,
      FONT_BODY_PT,
      'normal',
      '#111111',
      { maxWidth: bulletContentWidth }
    );
  }
}

// ---------------------------------------------------------------------------
// Page renderer — maps a DocumentPage to PDF drawing commands
// ---------------------------------------------------------------------------

/**
 * Renders a single page of the paginated document into the PDF.
 * Each block group is dispatched to its section-specific renderer.
 * The cursor tracks the vertical drawing position.
 *
 * Page 2+ gets extra top padding (PAGE_CONTINUATION_TOP_EXTRA_PT) so
 * continuation sections do not start abruptly at the top margin. Page 1
 * has the contact block which provides natural header breathing room;
 * subsequent pages need explicit padding to match that professional feel.
 */
function renderPage(
  doc: jsPDF,
  page: DocumentPage,
  draft: ResumeDraft,
  federalDetails: PdfFederalDetails | null
): void {
  const groups = groupBlocksBySectionId(page.blocks);

  /* Page 1 starts at the standard margin. Pages 2+ get extra top
   * padding so continuation sections feel intentionally spaced. */
  const continuationPad = page.pageNumber > 1 ? PAGE_CONTINUATION_TOP_EXTRA_PT : 0;
  const cursor: RenderCursor = { y: MARGIN_TOP_PT + FONT_BODY_PT + continuationPad };

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const sid = group.sectionId;
    const showHeader = groupContainsFirstBlock(group.blocks);

    /* Add inter-section gap (except before the first section) */
    if (gi > 0) {
      cursor.y = cursor.y + SECTION_GAP_PT;
    }

    if (sid === 'contact') {
      renderContact(doc, draft, cursor);
    } else if (sid === 'summary' && draft.summary) {
      renderSummary(doc, draft.summary, cursor);
    } else if (sid === 'experience') {
      renderExperience(doc, draft, group, showHeader, cursor);
    } else if (sid === 'education') {
      renderEducation(doc, draft.education, cursor);
    } else if (sid === 'certifications') {
      renderCertifications(doc, draft.certifications, cursor);
    } else if (sid === 'skills') {
      renderSkills(doc, draft.skills, cursor);
    } else if (sid === 'federal-details' && federalDetails) {
      renderFederalDetails(doc, federalDetails, cursor);
    } else if (sid === 'supporting-evidence') {
      renderSupportingEvidence(doc, draft.supportingEvidence, cursor);
    }
  }
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic PDF from the paginated resume document.
 *
 * This is the primary entry point for the deterministic PDF export.
 * It takes the same paginated document model used by the workspace canvas
 * and preview overlay, ensuring page-count parity between what the user
 * sees on screen and what appears in the exported PDF.
 *
 * USAGE:
 *   const result = exportResumePdf({
 *     paginatedDoc: paginateResume(draft, federalDetails, certs, evidence),
 *     draft: store.draft,
 *     federalDetails: federalDetails,
 *   });
 *   // result.blob is the PDF, result.filename is the suggested name
 *
 * ERROR HANDLING:
 *   Throws if jsPDF initialization fails or if the paginated document
 *   has zero pages. The caller should catch errors and offer a fallback.
 *
 * @param input - The typed export input (paginated doc + draft + federal details)
 * @returns PdfExportResult with the blob, filename, and page count
 */
export function exportResumePdf(input: PdfExportInput): PdfExportResult {
  const paginatedDoc = input.paginatedDoc;
  const draft = input.draft;
  const federalDetails = input.federalDetails;

  if (paginatedDoc.pages.length === 0) {
    throw new Error(
      '[PDF Export] Cannot export a resume with zero pages. ' +
      'The pagination engine produced an empty document.'
    );
  }

  /* Create a new jsPDF document. Unit: points, page size: letter.
   * The first page is created automatically by the constructor. */
  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
    orientation: 'portrait',
  });

  /* Render each page from the paginated model. Page 2+ requires
   * calling addPage() before rendering. */
  for (let i = 0; i < paginatedDoc.pages.length; i++) {
    if (i > 0) {
      doc.addPage('letter', 'portrait');
    }
    renderPage(doc, paginatedDoc.pages[i], draft, federalDetails);
  }

  /* Generate the PDF blob */
  const pdfBlob = doc.output('blob');

  /* Build the filename with today's date for easy identification */
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const contactName = draft.contact.fullName
    ? draft.contact.fullName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')
    : 'Resume';
  const filename = contactName + '-' + year + '-' + month + '-' + day + '.pdf';

  return {
    blob: pdfBlob,
    filename: filename,
    pageCount: paginatedDoc.pages.length,
  };
}

/**
 * Convenience function: exports the resume as PDF and triggers a browser
 * download. This is the function called by the UI export button.
 *
 * Creates an invisible anchor element, sets its href to a blob URL,
 * triggers a click to start the download, then cleans up the URL.
 *
 * @param input - The typed export input
 * @returns The PdfExportResult for logging/verification
 */
export function downloadResumePdf(input: PdfExportInput): PdfExportResult {
  const result = exportResumePdf(input);

  /* Create a temporary download link and trigger it */
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  /* Clean up: remove the link and revoke the blob URL to free memory */
  setTimeout(function () {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 100);

  return result;
}
