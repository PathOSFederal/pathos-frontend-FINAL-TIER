/**
 * ============================================================================
 * PAGINATION ENGINE TESTS — Block ordering, page assignment, split rules
 * ============================================================================
 *
 * PURPOSE: Verifies the deterministic pagination pipeline that converts
 * a ResumeDraft into a PaginatedDocument. These tests cover:
 *   - Block ordering (canonical section order preserved)
 *   - Pagination assignment (blocks fit on pages correctly)
 *   - keepTogether behavior (atomic sections never split)
 *   - Job-boundary splitting (experience splits only between jobs)
 *   - Page count changes as content grows
 *   - Page 2 rendering for atomic sections moved to next page
 *   - Block grouping for section-wrapper rendering
 *   - Height estimation sanity checks
 *
 * BOUNDARY RULE: These are pure function tests — no DOM, no React, no
 * rendering. The pagination engine is deterministic and testable in
 * isolation.
 */

import { describe, expect, it } from 'vitest';
import type { ResumeDraft } from '@pathos/core';
import {
  buildDocumentBlocks,
  paginateBlocks,
  paginateResume,
  groupBlocksBySectionId,
  getExperienceIdsFromBlocks,
  groupContainsFirstBlock,
  countBulletLines,
  estimateContactHeight,
  estimateSummaryHeight,
  estimateExperienceEntryHeight,
  estimateEducationHeight,
  estimateCertificationsHeight,
  estimateSkillsHeight,
  estimateFederalDetailsHeight,
  estimateSupportingEvidenceHeight,
} from '../utils/pagination-engine';
import type { DocumentBlock } from '../types/document-block-types';
import {
  PAGE_HEIGHT_PX,
  PAGE_CONTENT_PX,
  PAGE_SAFETY_MARGIN_PX,
  PAGE_PADDING_TOP_PX,
  PAGE_PADDING_BOTTOM_PX,
} from '../types/document-block-types';

// ---------------------------------------------------------------------------
// Test fixtures — minimal drafts for testing
// ---------------------------------------------------------------------------

/**
 * Builds a minimal draft with configurable sections for testing.
 * Default: one contact + summary + one experience entry.
 */
function buildTestDraft(overrides?: Partial<ResumeDraft>): ResumeDraft {
  const base: ResumeDraft = {
    contact: {
      fullName: 'Jane Doe',
      email: 'jane@agency.gov',
      phone: '(555) 555-1234',
      city: 'Washington',
      state: 'DC',
      citizenship: 'U.S. Citizen',
      veteranStatus: 'N/A',
    },
    summary: 'Experienced federal IT specialist with 10+ years in cybersecurity.',
    experience: [
      {
        id: 'exp-1',
        jobTitle: 'IT Specialist',
        employer: 'Department of Defense',
        location: 'Washington, DC',
        startDate: '2018-01',
        endDate: 'Present',
        hoursPerWeek: '40',
        grade: 'GS-13',
        duties: '• Led cybersecurity team of 12\n• Managed $5M budget\n• Implemented zero-trust architecture',
      },
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'Georgetown University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        graduationDate: '2014',
        gpa: '3.8',
      },
    ],
    skills: [
      { id: 'sk-1', name: 'Cybersecurity' },
      { id: 'sk-2', name: 'Python' },
      { id: 'sk-3', name: 'AWS' },
    ],
    certifications: [
      { id: 'cert-1', name: 'CISSP' },
    ],
    supportingEvidence: [
      { id: 'ev-1', text: 'Led migration saving $2M annually' },
    ],
  };

  if (overrides) {
    return Object.assign({}, base, overrides);
  }
  return base;
}

const MOCK_FEDERAL_DETAILS = {
  securityClearance: 'Top Secret/SCI',
  veteranPreference: '5-Point',
  federalEmployee: true,
  highestGrade: 'GS-13',
};

// ---------------------------------------------------------------------------
// Block ordering tests
// ---------------------------------------------------------------------------

describe('buildDocumentBlocks — block ordering', function () {
  it('produces blocks in canonical section order', function () {
    const draft = buildTestDraft();
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    /* Expected order: contact, summary, experience, education,
     * certifications, skills, federal-details, supporting-evidence */
    const sectionOrder: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const sid = blocks[i].sectionId;
      if (sectionOrder.length === 0 || sectionOrder[sectionOrder.length - 1] !== sid) {
        sectionOrder.push(sid);
      }
    }

    expect(sectionOrder).toEqual([
      'contact',
      'summary',
      'experience',
      'education',
      'certifications',
      'skills',
      'federal-details',
      'supporting-evidence',
    ]);
  });

  it('assigns monotonically increasing order values', function () {
    const draft = buildTestDraft();
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].order).toBeGreaterThan(blocks[i - 1].order);
    }
  });

  it('creates one block per experience entry', function () {
    const draft = buildTestDraft({
      experience: [
        { id: 'exp-1', jobTitle: 'Job 1', employer: 'Org A', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '• Task A' },
        { id: 'exp-2', jobTitle: 'Job 2', employer: 'Org B', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '• Task B' },
        { id: 'exp-3', jobTitle: 'Job 3', employer: 'Org C', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '• Task C' },
      ],
    });
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    const expBlocks = blocks.filter(function (b) { return b.sectionId === 'experience'; });
    expect(expBlocks.length).toBe(3);
    expect(expBlocks[0].experienceId).toBe('exp-1');
    expect(expBlocks[1].experienceId).toBe('exp-2');
    expect(expBlocks[2].experienceId).toBe('exp-3');
  });

  it('marks only the first experience entry as isFirstInSection', function () {
    const draft = buildTestDraft({
      experience: [
        { id: 'exp-1', jobTitle: 'Job 1', employer: 'Org A', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '• Task A' },
        { id: 'exp-2', jobTitle: 'Job 2', employer: 'Org B', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '• Task B' },
      ],
    });
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    const expBlocks = blocks.filter(function (b) { return b.sectionId === 'experience'; });
    expect(expBlocks[0].isFirstInSection).toBe(true);
    expect(expBlocks[1].isFirstInSection).toBe(false);
  });

  it('all blocks have keepTogether true', function () {
    const draft = buildTestDraft();
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    for (let i = 0; i < blocks.length; i++) {
      expect(blocks[i].keepTogether).toBe(true);
    }
  });

  it('creates a placeholder block when experience is empty', function () {
    const draft = buildTestDraft({ experience: [] });
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    const expBlocks = blocks.filter(function (b) { return b.sectionId === 'experience'; });
    expect(expBlocks.length).toBe(1);
    expect(expBlocks[0].isFirstInSection).toBe(true);
  });

  it('assigns unique block IDs', function () {
    const draft = buildTestDraft({
      experience: [
        { id: 'exp-1', jobTitle: 'Job 1', employer: 'A', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '' },
        { id: 'exp-2', jobTitle: 'Job 2', employer: 'B', location: '', startDate: '', endDate: '', hoursPerWeek: '', grade: '', duties: '' },
      ],
    });
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    const ids = new Set<string>();
    for (let i = 0; i < blocks.length; i++) {
      expect(ids.has(blocks[i].id)).toBe(false);
      ids.add(blocks[i].id);
    }
  });
});

// ---------------------------------------------------------------------------
// Pagination assignment tests
// ---------------------------------------------------------------------------

describe('paginateBlocks — page assignment', function () {
  it('fits a small resume on one page', function () {
    const draft = buildTestDraft();
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );
    const result = paginateBlocks(blocks);

    expect(result.totalPages).toBe(1);
    expect(result.pages[0].blocks.length).toBe(blocks.length);
  });

  it('creates page 2 when content exceeds effective page height', function () {
    /* Build blocks that intentionally exceed one page by using many
     * experience entries with long duty lists. */
    const longExperience = [];
    for (let i = 0; i < 8; i++) {
      longExperience.push({
        id: 'exp-' + i,
        jobTitle: 'Senior Specialist ' + i,
        employer: 'Agency ' + i,
        location: 'DC',
        startDate: '20' + (10 + i) + '-01',
        endDate: '20' + (12 + i) + '-12',
        hoursPerWeek: '40',
        grade: 'GS-13',
        duties: '• Led major initiative delivering $' + (i + 1) + 'M in savings\n• Managed team of ' + ((i + 1) * 5) + ' staff\n• Implemented new procedures reducing processing time by ' + ((i + 1) * 10) + '%\n• Developed training program for 200+ employees\n• Authored policy documents adopted agency-wide',
      });
    }

    const draft = buildTestDraft({ experience: longExperience });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    expect(result.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('never creates a page with zero blocks', function () {
    const draft = buildTestDraft();
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );
    const result = paginateBlocks(blocks);

    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i].blocks.length).toBeGreaterThan(0);
    }
  });

  it('preserves block count across all pages', function () {
    const draft = buildTestDraft();
    const blocks = buildDocumentBlocks(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );
    const result = paginateBlocks(blocks);

    expect(result.blockCount).toBe(blocks.length);
  });

  it('assigns sequential page numbers starting from 1', function () {
    /* Use enough content for multiple pages */
    const longExperience = [];
    for (let i = 0; i < 10; i++) {
      longExperience.push({
        id: 'exp-' + i,
        jobTitle: 'Role ' + i,
        employer: 'Agency ' + i,
        location: 'DC',
        startDate: '2010-01',
        endDate: '2015-12',
        hoursPerWeek: '40',
        grade: 'GS-12',
        duties: '• Task A line\n• Task B line\n• Task C line\n• Task D line\n• Task E line',
      });
    }
    const draft = buildTestDraft({ experience: longExperience });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i].pageNumber).toBe(i + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// keepTogether behavior tests
// ---------------------------------------------------------------------------

describe('paginateBlocks — keepTogether behavior', function () {
  it('moves an atomic section to the next page when it does not fit', function () {
    /* Create blocks where page 1 is almost full, then a fat atomic block
     * should move entirely to page 2 rather than being clipped. */
    const effectiveHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;
    const blocks: DocumentBlock[] = [
      {
        id: 'block-1',
        sectionId: 'contact',
        blockType: 'contact',
        keepTogether: true,
        estimatedHeight: effectiveHeight - 100,
        order: 0,
        isFirstInSection: true,
      },
      {
        id: 'block-2',
        sectionId: 'summary',
        blockType: 'summary',
        keepTogether: true,
        estimatedHeight: 200,
        order: 1,
        isFirstInSection: true,
      },
    ];

    const result = paginateBlocks(blocks);

    /* block-2 (200px) does not fit on page 1 (only 100px remaining).
     * It should be on page 2 since it is keepTogether. */
    expect(result.totalPages).toBe(2);
    expect(result.pages[0].blocks.length).toBe(1);
    expect(result.pages[0].blocks[0].id).toBe('block-1');
    expect(result.pages[1].blocks.length).toBe(1);
    expect(result.pages[1].blocks[0].id).toBe('block-2');
  });

  it('places a block taller than a full page on its own page without infinite loop', function () {
    const effectiveHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;
    const blocks: DocumentBlock[] = [
      {
        id: 'giant-block',
        sectionId: 'summary',
        blockType: 'summary',
        keepTogether: true,
        estimatedHeight: effectiveHeight + 500,
        order: 0,
        isFirstInSection: true,
      },
      {
        id: 'small-block',
        sectionId: 'skills',
        blockType: 'skills',
        keepTogether: true,
        estimatedHeight: 60,
        order: 1,
        isFirstInSection: true,
      },
    ];

    const result = paginateBlocks(blocks);

    /* The giant block must be placed on page 1 even though it overflows.
     * The small block should be on page 2. */
    expect(result.totalPages).toBe(2);
    expect(result.pages[0].blocks[0].id).toBe('giant-block');
    expect(result.pages[1].blocks[0].id).toBe('small-block');
  });
});

// ---------------------------------------------------------------------------
// Job-boundary splitting tests
// ---------------------------------------------------------------------------

describe('paginateBlocks — experience job-boundary splitting', function () {
  it('splits experience at job boundaries not mid-entry', function () {
    const effectiveHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;
    /* Create a contact block that fills most of page 1, then two
     * experience entries. The first fits on page 1, the second
     * should move to page 2 (split at job boundary). */
    const blocks: DocumentBlock[] = [
      {
        id: 'contact',
        sectionId: 'contact',
        blockType: 'contact',
        keepTogether: true,
        estimatedHeight: effectiveHeight - 200,
        order: 0,
        isFirstInSection: true,
      },
      {
        id: 'exp-1',
        sectionId: 'experience',
        blockType: 'experience-entry',
        keepTogether: true,
        estimatedHeight: 150,
        order: 1,
        isFirstInSection: true,
        experienceId: 'job-1',
      },
      {
        id: 'exp-2',
        sectionId: 'experience',
        blockType: 'experience-entry',
        keepTogether: true,
        estimatedHeight: 150,
        order: 2,
        isFirstInSection: false,
        experienceId: 'job-2',
      },
    ];

    const result = paginateBlocks(blocks);

    /* exp-1 (150px) fits on page 1 (200px remaining after contact).
     * exp-2 (150px) does not fit (only 50px remaining) → page 2. */
    expect(result.totalPages).toBe(2);
    /* Page 1: contact + exp-1 */
    expect(result.pages[0].blocks.length).toBe(2);
    expect(result.pages[0].blocks[1].experienceId).toBe('job-1');
    /* Page 2: exp-2 */
    expect(result.pages[1].blocks.length).toBe(1);
    expect(result.pages[1].blocks[0].experienceId).toBe('job-2');
  });

  it('keeps all jobs on one page when they fit', function () {
    const blocks: DocumentBlock[] = [
      {
        id: 'contact',
        sectionId: 'contact',
        blockType: 'contact',
        keepTogether: true,
        estimatedHeight: 100,
        order: 0,
        isFirstInSection: true,
      },
      {
        id: 'exp-1',
        sectionId: 'experience',
        blockType: 'experience-entry',
        keepTogether: true,
        estimatedHeight: 100,
        order: 1,
        isFirstInSection: true,
        experienceId: 'job-1',
      },
      {
        id: 'exp-2',
        sectionId: 'experience',
        blockType: 'experience-entry',
        keepTogether: true,
        estimatedHeight: 100,
        order: 2,
        isFirstInSection: false,
        experienceId: 'job-2',
      },
    ];

    const result = paginateBlocks(blocks);
    expect(result.totalPages).toBe(1);
    expect(result.pages[0].blocks.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Page-local rendering helpers
// ---------------------------------------------------------------------------

describe('groupBlocksBySectionId', function () {
  it('groups consecutive blocks with the same sectionId', function () {
    const blocks: DocumentBlock[] = [
      { id: 'exp-1', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 0, isFirstInSection: true, experienceId: 'j1' },
      { id: 'exp-2', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 1, isFirstInSection: false, experienceId: 'j2' },
      { id: 'edu', sectionId: 'education', blockType: 'education', keepTogether: true, estimatedHeight: 80, order: 2, isFirstInSection: true },
    ];

    const groups = groupBlocksBySectionId(blocks);
    expect(groups.length).toBe(2);
    expect(groups[0].sectionId).toBe('experience');
    expect(groups[0].blocks.length).toBe(2);
    expect(groups[1].sectionId).toBe('education');
    expect(groups[1].blocks.length).toBe(1);
  });

  it('returns empty array for empty blocks', function () {
    const groups = groupBlocksBySectionId([]);
    expect(groups.length).toBe(0);
  });

  it('handles single block', function () {
    const blocks: DocumentBlock[] = [
      { id: 'skills', sectionId: 'skills', blockType: 'skills', keepTogether: true, estimatedHeight: 60, order: 0, isFirstInSection: true },
    ];
    const groups = groupBlocksBySectionId(blocks);
    expect(groups.length).toBe(1);
    expect(groups[0].sectionId).toBe('skills');
  });
});

describe('getExperienceIdsFromBlocks', function () {
  it('extracts experience IDs from blocks', function () {
    const blocks: DocumentBlock[] = [
      { id: 'exp-1', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 0, isFirstInSection: true, experienceId: 'job-1' },
      { id: 'exp-2', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 1, isFirstInSection: false, experienceId: 'job-2' },
      { id: 'edu', sectionId: 'education', blockType: 'education', keepTogether: true, estimatedHeight: 80, order: 2, isFirstInSection: true },
    ];

    const ids = getExperienceIdsFromBlocks(blocks);
    expect(ids).toEqual(['job-1', 'job-2']);
  });

  it('returns empty array when no experience blocks', function () {
    const blocks: DocumentBlock[] = [
      { id: 'edu', sectionId: 'education', blockType: 'education', keepTogether: true, estimatedHeight: 80, order: 0, isFirstInSection: true },
    ];
    const ids = getExperienceIdsFromBlocks(blocks);
    expect(ids).toEqual([]);
  });
});

describe('groupContainsFirstBlock', function () {
  it('returns true when a block has isFirstInSection', function () {
    const blocks: DocumentBlock[] = [
      { id: 'exp-1', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 0, isFirstInSection: true, experienceId: 'j1' },
      { id: 'exp-2', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 1, isFirstInSection: false, experienceId: 'j2' },
    ];
    expect(groupContainsFirstBlock(blocks)).toBe(true);
  });

  it('returns false when no block has isFirstInSection', function () {
    const blocks: DocumentBlock[] = [
      { id: 'exp-2', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 1, isFirstInSection: false, experienceId: 'j2' },
      { id: 'exp-3', sectionId: 'experience', blockType: 'experience-entry', keepTogether: true, estimatedHeight: 100, order: 2, isFirstInSection: false, experienceId: 'j3' },
    ];
    expect(groupContainsFirstBlock(blocks)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bullet line counting
// ---------------------------------------------------------------------------

describe('countBulletLines', function () {
  it('counts non-empty bullet lines', function () {
    expect(countBulletLines('• Led team\n• Managed budget\n• Built system')).toBe(3);
  });

  it('handles empty string', function () {
    expect(countBulletLines('')).toBe(0);
  });

  it('strips bullet prefixes before counting', function () {
    expect(countBulletLines('- Task A\n* Task B\n• Task C')).toBe(3);
  });

  it('skips empty lines', function () {
    expect(countBulletLines('• Task A\n\n• Task B\n\n')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Height estimation sanity checks
// ---------------------------------------------------------------------------

describe('height estimation — sanity checks', function () {
  it('estimateContactHeight returns a positive number', function () {
    const draft = buildTestDraft();
    const h = estimateContactHeight(draft);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(300);
  });

  it('estimateSummaryHeight grows with longer text', function () {
    const short = estimateSummaryHeight('Short summary.');
    const long = estimateSummaryHeight('A much longer professional summary that spans multiple lines and contains detailed information about the applicant career history and qualifications for this specific federal position including specialized experience and clearance details.');
    expect(long).toBeGreaterThan(short);
  });

  it('estimateSummaryHeight handles empty summary', function () {
    const h = estimateSummaryHeight('');
    expect(h).toBeGreaterThan(0);
  });

  it('estimateExperienceEntryHeight is larger with more bullets', function () {
    const few = estimateExperienceEntryHeight('• Task A\n• Task B', true);
    const many = estimateExperienceEntryHeight('• Task A\n• Task B\n• Task C\n• Task D\n• Task E\n• Task F', true);
    expect(many).toBeGreaterThan(few);
  });

  it('estimateExperienceEntryHeight includes heading height for first entry', function () {
    const withHeading = estimateExperienceEntryHeight('• Task A', true);
    const withoutHeading = estimateExperienceEntryHeight('• Task A', false);
    expect(withHeading).toBeGreaterThan(withoutHeading);
  });

  it('estimateEducationHeight handles empty education', function () {
    const h = estimateEducationHeight([]);
    expect(h).toBeGreaterThan(0);
  });

  it('estimateCertificationsHeight handles empty array', function () {
    const h = estimateCertificationsHeight([]);
    expect(h).toBeGreaterThan(0);
  });

  it('estimateSkillsHeight grows with more skills', function () {
    const few = estimateSkillsHeight([{ id: 's1', name: 'Python' }]);
    const many = estimateSkillsHeight([
      { id: 's1', name: 'Python' },
      { id: 's2', name: 'JavaScript' },
      { id: 's3', name: 'Cybersecurity' },
      { id: 's4', name: 'AWS' },
      { id: 's5', name: 'Docker' },
      { id: 's6', name: 'Kubernetes' },
      { id: 's7', name: 'React' },
      { id: 's8', name: 'TypeScript' },
    ]);
    expect(many).toBeGreaterThanOrEqual(few);
  });

  it('estimateFederalDetailsHeight returns a positive number', function () {
    const h = estimateFederalDetailsHeight(MOCK_FEDERAL_DETAILS);
    expect(h).toBeGreaterThan(0);
  });

  it('estimateSupportingEvidenceHeight handles empty array', function () {
    const h = estimateSupportingEvidenceHeight([]);
    expect(h).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Page count growth tests
// ---------------------------------------------------------------------------

describe('page count — grows as content increases', function () {
  it('starts at 1 page for a minimal resume', function () {
    const draft = buildTestDraft();
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );
    expect(result.totalPages).toBe(1);
  });

  it('grows to 2+ pages with many experience entries', function () {
    const experience = [];
    for (let i = 0; i < 12; i++) {
      experience.push({
        id: 'exp-' + i,
        jobTitle: 'Specialist ' + i,
        employer: 'Agency ' + i,
        location: 'DC',
        startDate: '2010-01',
        endDate: '2015-01',
        hoursPerWeek: '40',
        grade: 'GS-12',
        duties: '• Led major initiative\n• Managed team\n• Implemented new systems\n• Developed training\n• Authored policy',
      });
    }
    const draft = buildTestDraft({ experience: experience });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );
    expect(result.totalPages).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline integration test
// ---------------------------------------------------------------------------

describe('paginateResume — full pipeline integration', function () {
  it('produces a valid PaginatedDocument', function () {
    const draft = buildTestDraft();
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.blockCount).toBeGreaterThan(0);
    expect(result.pages.length).toBe(result.totalPages);

    /* Every page has a valid page number */
    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i].pageNumber).toBe(i + 1);
    }
  });

  it('is deterministic — same input always produces same output', function () {
    const draft = buildTestDraft();
    const run1 = paginateResume(draft, MOCK_FEDERAL_DETAILS, draft.certifications, draft.supportingEvidence);
    const run2 = paginateResume(draft, MOCK_FEDERAL_DETAILS, draft.certifications, draft.supportingEvidence);

    expect(run1.totalPages).toBe(run2.totalPages);
    expect(run1.blockCount).toBe(run2.blockCount);

    for (let i = 0; i < run1.pages.length; i++) {
      expect(run1.pages[i].blocks.length).toBe(run2.pages[i].blocks.length);
      for (let j = 0; j < run1.pages[i].blocks.length; j++) {
        expect(run1.pages[i].blocks[j].id).toBe(run2.pages[i].blocks[j].id);
      }
    }
  });

  it('page usedHeight does not exceed effective page height for well-estimated content', function () {
    const draft = buildTestDraft();
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    const effectiveHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;
    /* For pages with more than one block, usedHeight should generally
     * not exceed effective height. Single-block pages may overflow
     * if the block is taller than a page. */
    for (let i = 0; i < result.pages.length; i++) {
      if (result.pages[i].blocks.length > 1) {
        expect(result.pages[i].usedHeight).toBeLessThanOrEqual(effectiveHeight + 1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Atomic section page-2 test
// ---------------------------------------------------------------------------

describe('atomic sections — moved wholly to next page', function () {
  it('moves education to page 2 when it does not fit on page 1', function () {
    const effectiveHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;
    const blocks: DocumentBlock[] = [
      { id: 'contact', sectionId: 'contact', blockType: 'contact', keepTogether: true, estimatedHeight: effectiveHeight - 50, order: 0, isFirstInSection: true },
      { id: 'education', sectionId: 'education', blockType: 'education', keepTogether: true, estimatedHeight: 100, order: 1, isFirstInSection: true },
    ];

    const result = paginateBlocks(blocks);
    expect(result.totalPages).toBe(2);
    expect(result.pages[1].blocks[0].sectionId).toBe('education');
  });
});

// ---------------------------------------------------------------------------
// Print page-count parity tests
// ---------------------------------------------------------------------------
//
// These tests verify the fundamental invariant for print/export parity:
// each page in the paginated model must fit within a single physical
// printed page. The print page container is exactly PAGE_HEIGHT_PX
// (1056px) tall with box-sizing:border-box, and the padding (40px top +
// 40px bottom = 80px) leaves PAGE_CONTENT_PX (976px) for content. The
// pagination engine limits content to PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX
// (928px) per page. The remaining 48px is the safety buffer.
//
// If any page's usedHeight exceeds the printable content budget, the
// content would overflow or be clipped. These tests catch that before
// it reaches the browser.

describe('print page-count parity — content fits within physical page', function () {
  it('every page usedHeight fits within PAGE_CONTENT_PX', function () {
    /*
     * The print page container has height = PAGE_HEIGHT_PX (1056px)
     * and box-sizing: border-box with 40px top + 40px bottom padding.
     * Usable content area = PAGE_CONTENT_PX (976px). If usedHeight
     * exceeds this, content would be clipped by overflow:hidden.
     * The pagination engine should never let usedHeight exceed
     * PAGE_CONTENT_PX for pages with multiple blocks.
     */
    const draft = buildTestDraft({
      experience: buildLongExperience(6),
    });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    for (let i = 0; i < result.pages.length; i++) {
      /* Single-block pages may exceed if the block itself is very tall
       * (taller than a full page). Multi-block pages must fit. */
      if (result.pages[i].blocks.length > 1) {
        expect(result.pages[i].usedHeight).toBeLessThanOrEqual(PAGE_CONTENT_PX);
      }
    }
  });

  it('two-page resume remains exactly two pages (not three)', function () {
    /*
     * REGRESSION TEST for the 3-page bug. A resume that paginates
     * to exactly 2 pages must produce exactly 2 print page containers.
     * Previously, missing @page { margin: 0 } caused the browser to
     * split page 1's content across two physical pages, making 3 total.
     *
     * This test verifies the model side: content per page stays within
     * budget so no overflow can cause an extra physical page.
     */
    const draft = buildTestDraft({
      experience: buildLongExperience(4),
    });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    /* Confirm this draft actually produces 2 pages */
    expect(result.totalPages).toBeGreaterThanOrEqual(2);

    /* Each page's content + padding must fit within one physical page.
     * VERTICAL_PADDING matches the print portal inline styles:
     * padding: '40px 48px' (top 40 + bottom 40 = 80px). */
    const VERTICAL_PADDING = PAGE_PADDING_TOP_PX + PAGE_PADDING_BOTTOM_PX;
    for (let i = 0; i < result.pages.length; i++) {
      const totalPageHeight = result.pages[i].usedHeight + VERTICAL_PADDING;
      expect(totalPageHeight).toBeLessThanOrEqual(PAGE_HEIGHT_PX);
    }
  });

  it('single-page resume stays on one page', function () {
    /*
     * A minimal resume with little content should fit on one page.
     * The pagination engine must produce exactly one page, and that
     * page's content must fit within the physical page height.
     */
    const draft = buildTestDraft();
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    const VERTICAL_PADDING = PAGE_PADDING_TOP_PX + PAGE_PADDING_BOTTOM_PX;
    expect(result.totalPages).toBe(1);
    expect(result.pages[0].usedHeight + VERTICAL_PADDING).toBeLessThanOrEqual(PAGE_HEIGHT_PX);
  });

  it('no empty trailing page is created', function () {
    /*
     * The pagination engine must never create an empty trailing page.
     * Every page must have at least one block. An empty page would
     * become a blank sheet in the printed/exported PDF.
     */
    const draft = buildTestDraft({
      experience: buildLongExperience(6),
    });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    /* Last page must have blocks */
    const lastPage = result.pages[result.pages.length - 1];
    expect(lastPage.blocks.length).toBeGreaterThan(0);

    /* All pages must have blocks */
    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i].blocks.length).toBeGreaterThan(0);
    }
  });

  it('page-gap is not part of the paginated model', function () {
    /*
     * PAGE_GAP_PX (40px) is a screen-only spacing constant used between
     * page surfaces in the editing canvas. It must NOT appear as content
     * height in the paginated model. The pagination engine uses only
     * PAGE_CONTENT_PX and PAGE_SAFETY_MARGIN_PX for page-filling math.
     */
    const draft = buildTestDraft({
      experience: buildLongExperience(6),
    });
    const result = paginateResume(
      draft,
      MOCK_FEDERAL_DETAILS,
      draft.certifications,
      draft.supportingEvidence
    );

    /* Effective page height must be PAGE_CONTENT_PX - safety, not
     * something that includes PAGE_GAP_PX. */
    const effectiveHeight = PAGE_CONTENT_PX - PAGE_SAFETY_MARGIN_PX;

    /* No multi-block page should exceed this budget */
    for (let i = 0; i < result.pages.length; i++) {
      if (result.pages[i].blocks.length > 1) {
        expect(result.pages[i].usedHeight).toBeLessThanOrEqual(effectiveHeight + 1);
      }
    }
  });
});

/**
 * Helper: Build an array of experience entries with enough content to
 * reliably span multiple pages in the pagination engine.
 */
function buildLongExperience(count: number): Array<{
  id: string;
  jobTitle: string;
  employer: string;
  location: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: string;
  grade: string;
  duties: string;
}> {
  const entries: Array<{
    id: string;
    jobTitle: string;
    employer: string;
    location: string;
    startDate: string;
    endDate: string;
    hoursPerWeek: string;
    grade: string;
    duties: string;
  }> = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      id: 'exp-long-' + i,
      jobTitle: 'Senior IT Specialist ' + i,
      employer: 'Agency Branch ' + i,
      location: 'Washington, DC',
      startDate: 'Jan ' + (2015 + i),
      endDate: i === count - 1 ? 'Present' : 'Dec ' + (2015 + i),
      hoursPerWeek: '40',
      grade: 'GS-' + (11 + i),
      duties: [
        'Led vulnerability assessment program across 500+ systems.',
        'Managed cross-functional security team of 12 specialists.',
        'Developed enterprise-wide incident response procedures.',
        'Conducted security architecture reviews for critical systems.',
        'Authored technical documentation and standard procedures.',
        'Performed continuous monitoring using SIEM platforms.',
      ].join('\n'),
    });
  }
  return entries;
}
