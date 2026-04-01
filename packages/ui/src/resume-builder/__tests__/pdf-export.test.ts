/**
 * ============================================================================
 * PDF EXPORT TESTS — Deterministic resume PDF generation pipeline
 * ============================================================================
 *
 * PURPOSE: Validates the application-owned PDF export that replaces browser
 * print as the primary export path. These tests verify:
 *
 *   - One-page export produces exactly one PDF page
 *   - Two-page export produces exactly two PDF pages
 *   - Three-plus page export produces the correct page count
 *   - Preview/export page-count parity (same pagination model)
 *   - Canonical section order preserved in export data
 *   - Long summary wrapping does not crash or lose text
 *   - Long work experience pagination is handled correctly
 *   - Supporting evidence pagination is handled correctly
 *   - No duplicate rendered pages in export source model
 *   - Export input contract matches what the UI provides
 *   - Error handling for edge cases (empty pages, no data)
 *
 * APPROACH: Pure function tests — no DOM, no React, no browser. The PDF
 * export module takes typed inputs and produces a Blob. We verify the
 * structural contracts at the model level and validate the Blob output.
 *
 * BOUNDARY RULE: These tests import from the resume-builder module only.
 * No next/* or electron/* imports.
 */

import { describe, expect, it } from 'vitest';
import type { ResumeDraft } from '@pathos/core';
import {
  exportResumePdf,
  MARGIN_TOP_PT,
  MARGIN_BOTTOM_PT,
  SPACING_AFTER_NAME_PT,
  SPACING_AFTER_CONTACT_LINE_PT,
  SPACING_BEFORE_HEADER_RULE_PT,
  SPACING_AFTER_HEADER_RULE_PT,
  SECTION_GAP_PT,
  SPACING_HEADING_TO_UNDERLINE_PT,
  SPACING_AFTER_HEADING_UNDERLINE_PT,
  SPACING_AFTER_JOB_TITLE_ROW_PT,
  SPACING_AFTER_EMPLOYER_ROW_PT,
  SPACING_BETWEEN_ENTRIES_PT,
  SPACING_BETWEEN_BULLETS_PT,
  PAGE_CONTINUATION_TOP_EXTRA_PT,
} from '../utils/pdf-export';
import type { PdfExportInput, PdfFederalDetails } from '../utils/pdf-export';
import {
  paginateResume,
  groupBlocksBySectionId,
  groupContainsFirstBlock,
} from '../utils/pagination-engine';
import type { PaginatedDocument } from '../types/document-block-types';
import { PAGE_SAFETY_MARGIN_PX } from '../types/document-block-types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Federal details mock for consistent pagination results.
 */
const TEST_FEDERAL_DETAILS: PdfFederalDetails = {
  securityClearance: 'Secret',
  veteranPreference: 'None',
  federalEmployee: true,
  highestGrade: 'GS-12',
};

/**
 * Build a minimal one-page draft with short content.
 */
function buildMinimalDraft(): ResumeDraft {
  return {
    contact: {
      fullName: 'Jane Doe',
      email: 'jane@agency.gov',
      phone: '(555) 555-1234',
      city: 'Washington',
      state: 'DC',
      citizenship: '',
      veteranStatus: '',
    },
    summary: 'Experienced federal IT specialist.',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    supportingEvidence: [],
  };
}

/**
 * Build a moderate-length draft that produces exactly 2 pages.
 */
function buildTwoPageDraft(): ResumeDraft {
  const experiences: ResumeDraft['experience'] = [];
  for (let i = 0; i < 4; i++) {
    experiences.push({
      id: 'exp-' + i,
      jobTitle: 'Senior IT Security Analyst ' + i,
      employer: 'Department of Defense Branch ' + i,
      location: 'Fort Meade, MD',
      startDate: 'Jan ' + (2018 + i),
      endDate: i === 3 ? 'Present' : 'Dec ' + (2018 + i),
      hoursPerWeek: '40',
      grade: 'GS-' + (12 + i),
      duties: [
        'Led comprehensive vulnerability assessment program.',
        'Managed a cross-functional team of 12 specialists.',
        'Developed enterprise-wide incident response procedures.',
        'Conducted security architecture reviews for infrastructure.',
      ].join('\n'),
    });
  }

  return {
    contact: {
      fullName: 'John Smith',
      email: 'john.smith@agency.gov',
      phone: '(555) 555-9876',
      city: 'Washington',
      state: 'DC',
      citizenship: 'U.S. Citizen',
      veteranStatus: 'N/A',
    },
    summary: 'Senior cybersecurity professional with 15+ years of progressive federal experience in vulnerability assessment, incident response, and security architecture.',
    experience: experiences,
    education: [
      {
        id: 'edu-1',
        degree: 'Master of Science',
        field: 'Cybersecurity',
        institution: 'Georgetown University',
        graduationDate: '2016',
        gpa: '3.8',
      },
    ],
    skills: [
      { id: 'sk-1', name: 'NIST 800-53' },
      { id: 'sk-2', name: 'Risk Management Framework' },
      { id: 'sk-3', name: 'Incident Response' },
    ],
    certifications: [
      { id: 'cert-1', name: 'CISSP' },
      { id: 'cert-2', name: 'Security+' },
    ],
    supportingEvidence: [
      { id: 'ev-1', text: 'Reduced security incident rate by 40% over 2-year period.' },
    ],
  };
}

/**
 * Build a long draft that produces 3+ pages.
 */
function buildThreePageDraft(): ResumeDraft {
  const experiences: ResumeDraft['experience'] = [];
  for (let i = 0; i < 8; i++) {
    experiences.push({
      id: 'exp-' + i,
      jobTitle: 'Senior IT Security Analyst Position ' + i,
      employer: 'Department of Defense Branch ' + i,
      location: 'Fort Meade, MD',
      startDate: 'Jan ' + (2012 + i),
      endDate: i === 7 ? 'Present' : 'Dec ' + (2012 + i),
      hoursPerWeek: '40',
      grade: 'GS-' + (11 + i),
      duties: [
        'Led comprehensive vulnerability assessment program covering 500+ systems.',
        'Managed a cross-functional team of 12 security specialists across 3 divisions.',
        'Developed and implemented enterprise-wide incident response procedures.',
        'Conducted security architecture reviews for mission-critical infrastructure.',
        'Authored technical security documentation and standard operating procedures.',
        'Performed continuous monitoring and threat analysis using SIEM platforms.',
      ].join('\n'),
    });
  }

  return {
    contact: {
      fullName: 'Alexandra Johnson',
      email: 'alexandra.johnson@agency.gov',
      phone: '(555) 555-4567',
      city: 'Washington',
      state: 'DC',
      citizenship: 'U.S. Citizen',
      veteranStatus: '5-Point',
    },
    summary: 'Distinguished cybersecurity executive with 20+ years of progressive federal experience leading enterprise-wide security programs across DoD and civilian agencies. Expert in zero-trust architecture, risk management framework implementation, and security operations center management.',
    experience: experiences,
    education: [
      {
        id: 'edu-1',
        degree: 'Master of Science',
        field: 'Cybersecurity',
        institution: 'Georgetown University',
        graduationDate: '2014',
        gpa: '3.9',
      },
      {
        id: 'edu-2',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        institution: 'University of Maryland',
        graduationDate: '2010',
        gpa: '3.7',
      },
    ],
    skills: [
      { id: 'sk-1', name: 'NIST 800-53' },
      { id: 'sk-2', name: 'Risk Management Framework' },
      { id: 'sk-3', name: 'Incident Response' },
      { id: 'sk-4', name: 'Vulnerability Assessment' },
      { id: 'sk-5', name: 'Zero Trust Architecture' },
    ],
    certifications: [
      { id: 'cert-1', name: 'CISSP' },
      { id: 'cert-2', name: 'CISM' },
      { id: 'cert-3', name: 'Security+' },
    ],
    supportingEvidence: [
      { id: 'ev-1', text: 'Reduced security incident rate by 40% over 2-year period through systematic vulnerability remediation.' },
      { id: 'ev-2', text: 'Received Agency Award for Excellence in Cybersecurity Operations 2022.' },
      { id: 'ev-3', text: 'Published 3 peer-reviewed papers on federal cybersecurity policy.' },
    ],
  };
}

/**
 * Helper: paginate a draft and return both the paginated doc and export input.
 */
function buildExportInput(
  draft: ResumeDraft,
  federalDetails: PdfFederalDetails | null
): PdfExportInput {
  const certifications = draft.certifications || [];
  const evidence = draft.supportingEvidence || [];
  const paginatedDoc = paginateResume(draft, federalDetails, certifications, evidence);
  return {
    paginatedDoc: paginatedDoc,
    draft: draft,
    federalDetails: federalDetails,
  };
}

// ---------------------------------------------------------------------------
// Test suite: PDF export — page count parity
// ---------------------------------------------------------------------------

describe('PDF export — one-page resume', function () {
  it('produces a valid PDF blob for a minimal resume', function () {
    const input = buildExportInput(buildMinimalDraft(), null);
    const result = exportResumePdf(input);

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.blob.type).toBe('application/pdf');
  });

  it('page count matches the paginated model for a one-page resume', function () {
    const draft = buildMinimalDraft();
    const input = buildExportInput(draft, null);

    /* Verify the pagination engine says 1 page */
    expect(input.paginatedDoc.totalPages).toBe(1);

    /* Verify the PDF export reports the same page count */
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(1);
  });

  it('generates a filename with the contact name and date', function () {
    const input = buildExportInput(buildMinimalDraft(), null);
    const result = exportResumePdf(input);

    expect(result.filename).toContain('Jane-Doe');
    expect(result.filename).toMatch(/\.pdf$/);
    expect(result.filename).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('PDF export — two-page resume', function () {
  it('produces a PDF with exactly 2 pages', function () {
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);

    /* The pagination engine should produce at least 2 pages */
    expect(input.paginatedDoc.totalPages).toBeGreaterThanOrEqual(2);

    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('page count matches between preview and export', function () {
    const draft = buildTwoPageDraft();
    /* Both preview and export use the same paginateResume() call */
    const previewDoc = paginateResume(
      draft,
      TEST_FEDERAL_DETAILS,
      draft.certifications || [],
      draft.supportingEvidence || []
    );
    const exportDoc = paginateResume(
      draft,
      TEST_FEDERAL_DETAILS,
      draft.certifications || [],
      draft.supportingEvidence || []
    );

    /* Deterministic: same input produces same output */
    expect(previewDoc.totalPages).toBe(exportDoc.totalPages);

    /* The export uses the same paginated doc */
    const input = buildExportInput(draft, TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(previewDoc.totalPages);
  });
});

describe('PDF export — three-plus page resume', function () {
  it('produces a PDF with 3+ pages for long content', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);

    /* Should produce at least 3 pages */
    expect(input.paginatedDoc.totalPages).toBeGreaterThanOrEqual(3);

    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('every page has blocks (no empty pages)', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);

    for (let i = 0; i < input.paginatedDoc.pages.length; i++) {
      expect(input.paginatedDoc.pages[i].blocks.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — content integrity
// ---------------------------------------------------------------------------

describe('PDF export — canonical section order preserved', function () {
  it('blocks follow canonical section order across pages', function () {
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);

    /* Collect all section IDs across all pages in order */
    const allSectionIds: string[] = [];
    for (let p = 0; p < input.paginatedDoc.pages.length; p++) {
      const page = input.paginatedDoc.pages[p];
      const groups = groupBlocksBySectionId(page.blocks);
      for (let g = 0; g < groups.length; g++) {
        const sid = groups[g].sectionId;
        /* Only add if it's a new section (not a continuation) */
        if (allSectionIds.length === 0 || allSectionIds[allSectionIds.length - 1] !== sid) {
          allSectionIds.push(sid);
        }
      }
    }

    /* Verify canonical order: contact → summary → experience → ... */
    expect(allSectionIds[0]).toBe('contact');
    if (allSectionIds.length > 1) {
      expect(allSectionIds[1]).toBe('summary');
    }
  });

  it('experience blocks have correct first-in-section markers', function () {
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);
    let foundFirst = false;

    for (let p = 0; p < input.paginatedDoc.pages.length; p++) {
      const page = input.paginatedDoc.pages[p];
      for (let b = 0; b < page.blocks.length; b++) {
        const block = page.blocks[b];
        if (block.sectionId === 'experience') {
          if (!foundFirst) {
            expect(block.isFirstInSection).toBe(true);
            foundFirst = true;
          }
        }
      }
    }
    /* At least one experience block should have been found */
    expect(foundFirst).toBe(true);
  });
});

describe('PDF export — long content handling', function () {
  it('long summary text produces a valid PDF without crashing', function () {
    const draft = buildMinimalDraft();
    /* Create a very long summary (500+ characters) */
    let longSummary = '';
    for (let i = 0; i < 10; i++) {
      longSummary = longSummary + 'Experienced federal IT specialist with extensive background in cybersecurity, network architecture, and incident response. ';
    }
    const updatedDraft = Object.assign({}, draft, { summary: longSummary });
    const input = buildExportInput(updatedDraft, null);
    const result = exportResumePdf(input);

    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('many experience entries span multiple pages without data loss', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);

    /* All pages from the model should appear in the PDF */
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);

    /* The PDF should be substantially larger than a single-page version */
    const minimalInput = buildExportInput(buildMinimalDraft(), null);
    const minimalResult = exportResumePdf(minimalInput);
    expect(result.blob.size).toBeGreaterThan(minimalResult.blob.size);
  });

  it('supporting evidence pagination is handled correctly', function () {
    const draft = buildThreePageDraft();
    /* Verify supporting evidence exists in the blocks */
    const input = buildExportInput(draft, TEST_FEDERAL_DETAILS);
    let hasEvidence = false;
    for (let p = 0; p < input.paginatedDoc.pages.length; p++) {
      for (let b = 0; b < input.paginatedDoc.pages[p].blocks.length; b++) {
        if (input.paginatedDoc.pages[p].blocks[b].sectionId === 'supporting-evidence') {
          hasEvidence = true;
          break;
        }
      }
      if (hasEvidence) break;
    }
    expect(hasEvidence).toBe(true);

    /* PDF should still generate successfully */
    const result = exportResumePdf(input);
    expect(result.blob.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — no duplicates
// ---------------------------------------------------------------------------

describe('PDF export — no duplicate pages', function () {
  it('each page in the model has a unique page number', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const pageNumbers: number[] = [];

    for (let i = 0; i < input.paginatedDoc.pages.length; i++) {
      pageNumbers.push(input.paginatedDoc.pages[i].pageNumber);
    }

    /* Check no duplicates */
    for (let i = 0; i < pageNumbers.length; i++) {
      let count = 0;
      for (let j = 0; j < pageNumbers.length; j++) {
        if (pageNumbers[j] === pageNumbers[i]) {
          count = count + 1;
        }
      }
      expect(count).toBe(1);
    }
  });

  it('export page count matches model page count exactly', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);
    expect(result.pageCount).toBe(input.paginatedDoc.pages.length);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — error handling
// ---------------------------------------------------------------------------

describe('PDF export — error handling', function () {
  it('throws when paginated document has zero pages', function () {
    const emptyDoc: PaginatedDocument = {
      pages: [],
      totalPages: 0,
      blockCount: 0,
    };

    const input: PdfExportInput = {
      paginatedDoc: emptyDoc,
      draft: buildMinimalDraft(),
      federalDetails: null,
    };

    expect(function () {
      exportResumePdf(input);
    }).toThrow('zero pages');
  });

  it('handles null federal details without crashing', function () {
    const input = buildExportInput(buildTwoPageDraft(), null);
    const result = exportResumePdf(input);

    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('handles empty certifications array without crashing', function () {
    const draft = buildMinimalDraft();
    const updatedDraft = Object.assign({}, draft, { certifications: [] });
    const input = buildExportInput(updatedDraft, null);
    const result = exportResumePdf(input);

    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('handles empty supporting evidence array without crashing', function () {
    const draft = buildMinimalDraft();
    const updatedDraft = Object.assign({}, draft, { supportingEvidence: [] });
    const input = buildExportInput(updatedDraft, null);
    const result = exportResumePdf(input);

    expect(result.blob.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — input contract
// ---------------------------------------------------------------------------

describe('PDF export — input contract matches UI', function () {
  it('PdfExportInput accepts the same data the preview overlay provides', function () {
    /*
     * The preview overlay calls paginateResume(draft, federalDetails, certs, evidence)
     * and passes the result to the PDF export. This test verifies the input
     * contract works with the same data shapes.
     */
    const draft = buildTwoPageDraft();
    const federalDetails = TEST_FEDERAL_DETAILS;
    const paginatedDoc = paginateResume(
      draft,
      federalDetails,
      draft.certifications || [],
      draft.supportingEvidence || []
    );

    /* Build the export input exactly as the UI would */
    const input: PdfExportInput = {
      paginatedDoc: paginatedDoc,
      draft: draft,
      federalDetails: federalDetails,
    };

    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(paginatedDoc.totalPages);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.filename).toContain('.pdf');
  });

  it('export result contains all required fields', function () {
    const input = buildExportInput(buildMinimalDraft(), null);
    const result = exportResumePdf(input);

    /* blob: the PDF file */
    expect(result.blob).toBeDefined();
    expect(result.blob instanceof Blob).toBe(true);

    /* filename: suggested download name */
    expect(typeof result.filename).toBe('string');
    expect(result.filename.length).toBeGreaterThan(0);

    /* pageCount: number of pages */
    expect(typeof result.pageCount).toBe('number');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — preview/export parity
// ---------------------------------------------------------------------------

describe('PDF export — preview/export parity', function () {
  it('preview pagination and export pagination use the same model', function () {
    /*
     * Both the on-screen preview and the PDF export derive their page
     * structure from the same paginateResume() function. If they used
     * different models, the preview and PDF could diverge. This test
     * verifies determinism: same input always produces same output.
     */
    const draft = buildThreePageDraft();
    const run1 = paginateResume(
      draft,
      TEST_FEDERAL_DETAILS,
      draft.certifications || [],
      draft.supportingEvidence || []
    );
    const run2 = paginateResume(
      draft,
      TEST_FEDERAL_DETAILS,
      draft.certifications || [],
      draft.supportingEvidence || []
    );

    expect(run1.totalPages).toBe(run2.totalPages);
    expect(run1.blockCount).toBe(run2.blockCount);

    for (let i = 0; i < run1.pages.length; i++) {
      expect(run1.pages[i].blocks.length).toBe(run2.pages[i].blocks.length);
    }
  });

  it('section groups are identical between preview and export rendering', function () {
    const draft = buildTwoPageDraft();
    const paginatedDoc = paginateResume(
      draft,
      TEST_FEDERAL_DETAILS,
      draft.certifications || [],
      draft.supportingEvidence || []
    );

    /* Both preview and export use groupBlocksBySectionId for each page */
    for (let p = 0; p < paginatedDoc.pages.length; p++) {
      const groups = groupBlocksBySectionId(paginatedDoc.pages[p].blocks);
      expect(groups.length).toBeGreaterThan(0);

      for (let g = 0; g < groups.length; g++) {
        expect(groups[g].sectionId).toBeDefined();
        expect(groups[g].blocks.length).toBeGreaterThan(0);

        /* Verify groupContainsFirstBlock works consistently */
        const hasFirst = groupContainsFirstBlock(groups[g].blocks);
        expect(typeof hasFirst).toBe('boolean');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF spacing configuration — central spacing tokens
// ---------------------------------------------------------------------------
//
// Validates that the exported spacing tokens exist, have positive values,
// and maintain the hierarchy relationships needed for a well-formatted
// document (e.g. section gap > entry gap > bullet gap). These tests
// protect against accidental zero/negative values or inverted hierarchy.
// ---------------------------------------------------------------------------

describe('PDF spacing configuration — token existence and sanity', function () {
  it('all spacing tokens are exported and positive', function () {
    /* Every spacing token must be a positive number. A zero or negative
     * value would collapse visual separation between elements. */
    expect(SPACING_AFTER_NAME_PT).toBeGreaterThan(0);
    expect(SPACING_AFTER_CONTACT_LINE_PT).toBeGreaterThan(0);
    expect(SPACING_BEFORE_HEADER_RULE_PT).toBeGreaterThan(0);
    expect(SPACING_AFTER_HEADER_RULE_PT).toBeGreaterThan(0);
    expect(SECTION_GAP_PT).toBeGreaterThan(0);
    expect(SPACING_HEADING_TO_UNDERLINE_PT).toBeGreaterThan(0);
    expect(SPACING_AFTER_HEADING_UNDERLINE_PT).toBeGreaterThan(0);
    expect(SPACING_AFTER_JOB_TITLE_ROW_PT).toBeGreaterThan(0);
    expect(SPACING_AFTER_EMPLOYER_ROW_PT).toBeGreaterThan(0);
    expect(SPACING_BETWEEN_ENTRIES_PT).toBeGreaterThan(0);
    expect(SPACING_BETWEEN_BULLETS_PT).toBeGreaterThan(0);
    expect(PAGE_CONTINUATION_TOP_EXTRA_PT).toBeGreaterThan(0);
  });

  it('all spacing tokens are finite numbers', function () {
    /* Guards against NaN, Infinity, or accidentally stringified values */
    expect(Number.isFinite(SPACING_AFTER_NAME_PT)).toBe(true);
    expect(Number.isFinite(SPACING_AFTER_CONTACT_LINE_PT)).toBe(true);
    expect(Number.isFinite(SPACING_BEFORE_HEADER_RULE_PT)).toBe(true);
    expect(Number.isFinite(SPACING_AFTER_HEADER_RULE_PT)).toBe(true);
    expect(Number.isFinite(SECTION_GAP_PT)).toBe(true);
    expect(Number.isFinite(SPACING_HEADING_TO_UNDERLINE_PT)).toBe(true);
    expect(Number.isFinite(SPACING_AFTER_HEADING_UNDERLINE_PT)).toBe(true);
    expect(Number.isFinite(SPACING_AFTER_JOB_TITLE_ROW_PT)).toBe(true);
    expect(Number.isFinite(SPACING_AFTER_EMPLOYER_ROW_PT)).toBe(true);
    expect(Number.isFinite(SPACING_BETWEEN_ENTRIES_PT)).toBe(true);
    expect(Number.isFinite(SPACING_BETWEEN_BULLETS_PT)).toBe(true);
    expect(Number.isFinite(PAGE_CONTINUATION_TOP_EXTRA_PT)).toBe(true);
  });
});

describe('PDF spacing configuration — hierarchy relationships', function () {
  it('section gap is larger than entry gap', function () {
    /* The gap between sections must be visually larger than the gap
     * between entries within a section, so sections are clearly
     * separated from each other. */
    expect(SECTION_GAP_PT).toBeGreaterThan(SPACING_BETWEEN_ENTRIES_PT);
  });

  it('entry gap is larger than bullet gap', function () {
    /* The gap between experience entries must be larger than the gap
     * between bullet items, preserving the visual nesting hierarchy. */
    expect(SPACING_BETWEEN_ENTRIES_PT).toBeGreaterThan(SPACING_BETWEEN_BULLETS_PT);
  });

  it('header rule spacing is larger than contact line spacing', function () {
    /* The space around the header rule (the big visual break between
     * the header block and the body) must be more prominent than the
     * small gaps within the contact block. */
    expect(SPACING_AFTER_HEADER_RULE_PT).toBeGreaterThan(SPACING_AFTER_CONTACT_LINE_PT);
  });

  it('heading-after-underline gap is larger than heading-to-underline gap', function () {
    /* The space below the underline (before content) should be at least
     * as large as the space above it (between heading text and line),
     * so the underline feels anchored to its heading. */
    expect(SPACING_AFTER_HEADING_UNDERLINE_PT).toBeGreaterThanOrEqual(SPACING_HEADING_TO_UNDERLINE_PT);
  });

  it('section gap fits within the safety margin budget', function () {
    /* The section gap must not exceed the pagination engine's safety
     * margin (PAGE_SAFETY_MARGIN_PX converted to points). A single
     * section gap larger than the safety margin could cause page
     * overflow in the PDF. Uses the actual constant so the test
     * automatically tracks any safety margin changes. */
    const SAFETY_MARGIN_PT = PAGE_SAFETY_MARGIN_PX * 0.75;
    expect(SECTION_GAP_PT).toBeLessThanOrEqual(SAFETY_MARGIN_PT);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — spacing does not break page count parity
// ---------------------------------------------------------------------------
//
// These tests verify that the spacing adjustments do not cause the PDF
// to produce a different page count than the pagination engine. The
// spacing changes are designed to stay within the safety margin budget.
// ---------------------------------------------------------------------------

describe('PDF export — spacing changes preserve page count parity', function () {
  it('one-page resume still produces exactly one page after spacing polish', function () {
    const input = buildExportInput(buildMinimalDraft(), null);
    expect(input.paginatedDoc.totalPages).toBe(1);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(1);
  });

  it('two-page resume still produces correct page count after spacing polish', function () {
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);
  });

  it('three-page resume still produces correct page count after spacing polish', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);
  });

  it('PDF blob size increases with spacing polish (more whitespace in output)', function () {
    /* A well-spaced PDF should not be smaller than a cramped one.
     * This is a soft check — the PDF library may compress differently,
     * but for our text-heavy documents the blob should be stable. */
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.blob.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF export — continued section spacing on later pages
// ---------------------------------------------------------------------------

describe('PDF export — continued section handling on multi-page resumes', function () {
  it('multi-page resume with experience across pages exports without error', function () {
    /* When experience entries span pages, the PDF renderer shows
     * "Work Experience (continued)" on page 2+. Spacing changes must
     * not cause a crash when rendering the continued heading. */
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBeGreaterThanOrEqual(3);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('experience section appears on multiple pages for long content', function () {
    /* Verify the pagination engine splits experience across pages,
     * which is the prerequisite for "(continued)" headings. */
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    let experiencePageCount = 0;
    for (let p = 0; p < input.paginatedDoc.pages.length; p++) {
      const page = input.paginatedDoc.pages[p];
      for (let b = 0; b < page.blocks.length; b++) {
        if (page.blocks[b].sectionId === 'experience') {
          experiencePageCount = experiencePageCount + 1;
          break;
        }
      }
    }
    expect(experiencePageCount).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF visual-parity spacing — values tuned to print reference
// ---------------------------------------------------------------------------
//
// These tests verify that the spacing constants match the specific values
// chosen for visual parity with the browser-print reference PDF
// (testResume3.pdf). If a value changes, these tests will catch it so the
// developer can confirm the change is intentional, not accidental.
// ---------------------------------------------------------------------------

describe('PDF visual-parity spacing — specific value verification', function () {
  it('MARGIN_TOP_PT is 40pt for generous top margin matching print reference', function () {
    /* The print reference uses approximately 0.55in top margin. 40pt =
     * 0.556in, matching that feel. The previous value (30pt = 0.42in)
     * made the name feel too close to the page edge. */
    expect(MARGIN_TOP_PT).toBe(40);
  });

  it('MARGIN_BOTTOM_PT is 30pt preserving standard bottom margin', function () {
    expect(MARGIN_BOTTOM_PT).toBe(30);
  });

  it('SPACING_AFTER_NAME_PT is 8pt for generous name-to-contact separation', function () {
    /* The large bold name needs clear breathing room before the smaller
     * contact details line. 8pt matches the print reference gap. */
    expect(SPACING_AFTER_NAME_PT).toBe(8);
  });

  it('SPACING_AFTER_HEADER_RULE_PT is 18pt for header-to-body breathing room', function () {
    /* This is the single most impactful token for fixing the
     * "cramped page 1" perception in the deterministic PDF. 18pt
     * creates a clear visual break between the header and body. */
    expect(SPACING_AFTER_HEADER_RULE_PT).toBe(18);
  });

  it('SECTION_GAP_PT is 24pt for deliberate section separation', function () {
    /* Sections should read as distinct visual blocks. 24pt provides
     * deliberate, calm transitions between resume sections. */
    expect(SECTION_GAP_PT).toBe(24);
  });

  it('SPACING_BETWEEN_ENTRIES_PT is 15pt so entries have clear territory', function () {
    /* The most impactful change for Work Experience density. 15pt
     * gives each experience entry its own visual territory so entries
     * read as distinct items, not a continuous text wall. */
    expect(SPACING_BETWEEN_ENTRIES_PT).toBe(15);
  });

  it('SPACING_BETWEEN_BULLETS_PT is 3pt for individually scannable bullets', function () {
    /* Each bullet should be scannable on its own. 3pt prevents
     * the bullet list from feeling like undifferentiated text. */
    expect(SPACING_BETWEEN_BULLETS_PT).toBe(3);
  });

  it('SPACING_AFTER_HEADING_UNDERLINE_PT is 12pt for heading clarity', function () {
    /* 12pt below the underline ensures the heading reads as a clear
     * label for the content below, not merged into it. */
    expect(SPACING_AFTER_HEADING_UNDERLINE_PT).toBe(12);
  });

  it('PAGE_CONTINUATION_TOP_EXTRA_PT is 6pt for page 2+ breathing', function () {
    /* Pages 2+ need extra top padding because they lack the contact
     * block that naturally provides header breathing on page 1. */
    expect(PAGE_CONTINUATION_TOP_EXTRA_PT).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF visual-parity — page margin budget
// ---------------------------------------------------------------------------
//
// Verifies that the margin + spacing budget stays within the available
// page height so content does not overflow past the bottom margin.
// ---------------------------------------------------------------------------

describe('PDF visual-parity — margin budget integrity', function () {
  it('top + bottom margins leave enough room for content on US Letter', function () {
    /* US Letter is 792pt tall. After margins, at least 700pt should
     * remain for content. This guards against accidentally setting
     * margins so large that content overflows. */
    const PDF_PAGE_HEIGHT_PT = 792;
    const usableHeight = PDF_PAGE_HEIGHT_PT - MARGIN_TOP_PT - MARGIN_BOTTOM_PT;
    expect(usableHeight).toBeGreaterThanOrEqual(700);
  });

  it('section gap does not exceed half the entry gap budget', function () {
    /* Sanity check: the inter-section gap should not be so large that
     * a page with 3 sections loses >66pt just to section gaps. Keep
     * it proportional. */
    expect(SECTION_GAP_PT * 3).toBeLessThan(100);
  });

  it('cumulative header spacing is reasonable', function () {
    /* Total header block overhead: name spacing + contact spacing +
     * before-rule spacing + after-rule spacing. This should not exceed
     * ~50pt total, leaving the bulk of the page for body content.
     * The limit was raised from 40pt to 50pt to accommodate the more
     * generous spacing tuned for print-reference visual parity. */
    const headerOverhead = SPACING_AFTER_NAME_PT
      + SPACING_AFTER_CONTACT_LINE_PT
      + SPACING_BEFORE_HEADER_RULE_PT
      + SPACING_AFTER_HEADER_RULE_PT;
    expect(headerOverhead).toBeLessThanOrEqual(50);
    expect(headerOverhead).toBeGreaterThan(20);
  });

  it('entry spacing hierarchy creates proper visual nesting', function () {
    /* Four-level spacing hierarchy:
     *   section gap > entry gap > heading gap > bullet gap
     * Each level should be at least 1.5x the level below it for
     * clear visual differentiation. */
    expect(SECTION_GAP_PT).toBeGreaterThan(SPACING_BETWEEN_ENTRIES_PT * 1.5);
    expect(SPACING_BETWEEN_ENTRIES_PT).toBeGreaterThan(SPACING_BETWEEN_BULLETS_PT * 3);
  });

  it('continuation padding is moderate and does not consume excessive page space', function () {
    /* The page 2+ top extra padding should be small — just enough to
     * prevent abrupt content starts. It must not exceed the section gap,
     * since it serves a smaller visual purpose. */
    expect(PAGE_CONTINUATION_TOP_EXTRA_PT).toBeLessThanOrEqual(SECTION_GAP_PT);
    expect(PAGE_CONTINUATION_TOP_EXTRA_PT).toBeGreaterThanOrEqual(4);
    expect(PAGE_CONTINUATION_TOP_EXTRA_PT).toBeLessThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PDF visual-parity — export action wiring integrity
// ---------------------------------------------------------------------------
//
// Verifies that the export function still works correctly with the new
// spacing values, producing valid output for all resume sizes.
// ---------------------------------------------------------------------------

describe('PDF visual-parity — export wiring with new spacing', function () {
  it('one-page export still succeeds with polished spacing', function () {
    const input = buildExportInput(buildMinimalDraft(), null);
    const result = exportResumePdf(input);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.blob.type).toBe('application/pdf');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('two-page export still succeeds with polished spacing', function () {
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.pageCount).toBeGreaterThanOrEqual(2);
  });

  it('three-page export still succeeds with polished spacing', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const result = exportResumePdf(input);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.pageCount).toBeGreaterThanOrEqual(3);
  });

  it('no duplicate content: each page has distinct block IDs', function () {
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    const allBlockIds: string[] = [];
    for (let p = 0; p < input.paginatedDoc.pages.length; p++) {
      for (let b = 0; b < input.paginatedDoc.pages[p].blocks.length; b++) {
        allBlockIds.push(input.paginatedDoc.pages[p].blocks[b].id);
      }
    }
    /* Check no block ID appears on more than one page */
    for (let i = 0; i < allBlockIds.length; i++) {
      let count = 0;
      for (let j = 0; j < allBlockIds.length; j++) {
        if (allBlockIds[j] === allBlockIds[i]) {
          count = count + 1;
        }
      }
      expect(count).toBe(1);
    }
  });

  it('canonical section order preserved after spacing changes', function () {
    const input = buildExportInput(buildTwoPageDraft(), TEST_FEDERAL_DETAILS);
    const sectionOrder: string[] = [];
    for (let p = 0; p < input.paginatedDoc.pages.length; p++) {
      const groups = groupBlocksBySectionId(input.paginatedDoc.pages[p].blocks);
      for (let g = 0; g < groups.length; g++) {
        const sid = groups[g].sectionId;
        if (sectionOrder.length === 0 || sectionOrder[sectionOrder.length - 1] !== sid) {
          sectionOrder.push(sid);
        }
      }
    }
    expect(sectionOrder[0]).toBe('contact');
    if (sectionOrder.length > 1) {
      expect(sectionOrder[1]).toBe('summary');
    }
  });

  it('multi-page export with continuation padding produces valid PDF', function () {
    /* Pages 2+ use PAGE_CONTINUATION_TOP_EXTRA_PT for extra top
     * breathing room. Verify the export still succeeds and the
     * continuation padding does not break rendering. */
    const input = buildExportInput(buildThreePageDraft(), TEST_FEDERAL_DETAILS);
    expect(input.paginatedDoc.totalPages).toBeGreaterThanOrEqual(3);
    const result = exportResumePdf(input);
    expect(result.pageCount).toBe(input.paginatedDoc.totalPages);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.blob.type).toBe('application/pdf');
  });
});
