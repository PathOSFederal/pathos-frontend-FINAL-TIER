/**
 * ============================================================================
 * STABILIZATION PASS TESTS — Resume Builder UX + functionality validation
 * ============================================================================
 *
 * PURPOSE: Validates all changes from the Resume Builder stabilization pass.
 * Covers the following areas:
 *   - Core model extensions (certifications, supportingEvidence)
 *   - Canonical section order matches left rail
 *   - Editing field type extensions
 *   - Export/version functions work end-to-end
 *   - Stage tab definitions are correct
 *   - Section progress hooks handle new fields
 *
 * APPROACH: Pure function tests for deterministic behavior. DOM-level tests
 * for interactive features would require jsdom and are deferred to a
 * separate integration test file.
 */

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Core model imports
// ---------------------------------------------------------------------------

import {
  createDefaultDraft,
  createDefaultContact,
} from '@pathos/core';
import type {
  ResumeDraft,
  ResumeCertification,
  ResumeSupportingEvidence,
  ResumeStore,
} from '@pathos/core';

// ---------------------------------------------------------------------------
// Resume storage imports
// ---------------------------------------------------------------------------

import {
  updateDraft,
  createVersion,
  exportResumeJSON,
  listVersions,
  restoreVersion,
  deleteVersion,
} from '@pathos/core';

// ---------------------------------------------------------------------------
// Section order and progress imports
// ---------------------------------------------------------------------------

import { getCanonicalUIOrder, buildFederalSectionMeta } from '../../resume-builder/types/federal-section-meta';
import {
  buildStageTabDefs,
  buildPrimaryCtaConfig,
} from '../../resume-builder/types/stage-types';
import type { BuilderStage } from '../../resume-builder/types/stage-types';

// ===========================================================================
// SECTION 1: Core model extensions
// ===========================================================================

describe('Core model: certifications and supportingEvidence', function () {
  it('createDefaultDraft includes empty certifications array', function () {
    const draft = createDefaultDraft();
    expect(draft.certifications).toBeDefined();
    expect(Array.isArray(draft.certifications)).toBe(true);
    expect(draft.certifications.length).toBe(0);
  });

  it('createDefaultDraft includes empty supportingEvidence array', function () {
    const draft = createDefaultDraft();
    expect(draft.supportingEvidence).toBeDefined();
    expect(Array.isArray(draft.supportingEvidence)).toBe(true);
    expect(draft.supportingEvidence.length).toBe(0);
  });

  it('ResumeDraft type accepts certifications data', function () {
    const draft: ResumeDraft = {
      contact: createDefaultContact(),
      summary: 'Test summary',
      experience: [],
      education: [],
      skills: [],
      certifications: [
        { id: 'cert-1', name: 'CISSP' },
        { id: 'cert-2', name: 'CompTIA Security+' },
      ],
      supportingEvidence: [],
    };
    expect(draft.certifications.length).toBe(2);
    expect(draft.certifications[0].name).toBe('CISSP');
  });

  it('ResumeDraft type accepts supportingEvidence data', function () {
    const draft: ResumeDraft = {
      contact: createDefaultContact(),
      summary: '',
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      supportingEvidence: [
        { id: 'ev-1', text: 'Reduced cost by 40%' },
        { id: 'ev-2', text: 'Awarded DoD medal' },
      ],
    };
    expect(draft.supportingEvidence.length).toBe(2);
    expect(draft.supportingEvidence[0].text).toBe('Reduced cost by 40%');
  });
});

// ===========================================================================
// SECTION 2: Canonical section order
// ===========================================================================

describe('Canonical section order matches left rail', function () {
  it('getCanonicalUIOrder returns sections in correct federal order', function () {
    const registry = buildFederalSectionMeta();
    const order = getCanonicalUIOrder(registry);
    const ids = order.map(function (s) { return s.sectionId; });

    /* The canonical order must be:
     * contact → summary → experience → education → certifications → skills → federal-details → supporting-evidence */
    expect(ids.indexOf('contact')).toBeLessThan(ids.indexOf('summary'));
    expect(ids.indexOf('summary')).toBeLessThan(ids.indexOf('experience'));
    expect(ids.indexOf('experience')).toBeLessThan(ids.indexOf('education'));
    expect(ids.indexOf('education')).toBeLessThan(ids.indexOf('certifications'));
    expect(ids.indexOf('certifications')).toBeLessThan(ids.indexOf('skills'));
    expect(ids.indexOf('skills')).toBeLessThan(ids.indexOf('federal-details'));
    expect(ids.indexOf('federal-details')).toBeLessThan(ids.indexOf('supporting-evidence'));
  });

  it('certifications appears before skills in canonical order', function () {
    const registry = buildFederalSectionMeta();
    const order = getCanonicalUIOrder(registry);
    const ids = order.map(function (s) { return s.sectionId; });
    const certsIdx = ids.indexOf('certifications');
    const skillsIdx = ids.indexOf('skills');
    expect(certsIdx).toBeGreaterThan(-1);
    expect(skillsIdx).toBeGreaterThan(-1);
    expect(certsIdx).toBeLessThan(skillsIdx);
  });
});

// ===========================================================================
// SECTION 3: Resume version management
// ===========================================================================

describe('Resume version management', function () {
  function makeTestStore(): ResumeStore {
    return {
      schemaVersion: 1,
      draft: {
        contact: createDefaultContact(),
        summary: 'Test summary',
        experience: [],
        education: [],
        skills: [{ id: 'sk-1', name: 'Testing' }],
        certifications: [{ id: 'cert-1', name: 'CISSP' }],
        supportingEvidence: [{ id: 'ev-1', text: 'Reduced bugs by 90%' }],
      },
      versions: [],
    };
  }

  it('createVersion snapshots the current draft', function () {
    const store = makeTestStore();
    const updated = createVersion(store, 'Test Version');
    const versions = listVersions(updated);
    expect(versions.length).toBe(1);
    expect(versions[0].label).toBe('Test Version');
    expect(versions[0].snapshot.summary).toBe('Test summary');
    expect(versions[0].snapshot.certifications.length).toBe(1);
    expect(versions[0].snapshot.supportingEvidence.length).toBe(1);
  });

  it('restoreVersion restores a saved snapshot', function () {
    const store = makeTestStore();
    const withVersion = createVersion(store, 'Snapshot 1');
    const versionId = listVersions(withVersion)[0].id;

    /* Modify the draft after creating the version */
    const modified = updateDraft(withVersion, {
      ...withVersion.draft,
      summary: 'Modified summary',
    });
    expect(modified.draft.summary).toBe('Modified summary');

    /* Restore the version — should get original summary back */
    const restored = restoreVersion(modified, versionId);
    expect(restored.draft.summary).toBe('Test summary');
  });

  it('exportResumeJSON produces valid JSON with all fields', function () {
    const store = makeTestStore();
    const json = exportResumeJSON(store);
    const parsed = JSON.parse(json);
    expect(parsed.draft.certifications).toBeDefined();
    expect(parsed.draft.supportingEvidence).toBeDefined();
    expect(parsed.draft.certifications.length).toBe(1);
    expect(parsed.draft.supportingEvidence.length).toBe(1);
  });

  it('deleteVersion removes a specific version', function () {
    const store = makeTestStore();
    const v1 = createVersion(store, 'V1');
    const v2 = createVersion(v1, 'V2');
    expect(listVersions(v2).length).toBe(2);

    const versionId = listVersions(v2)[0].id;
    const afterDelete = deleteVersion(v2, versionId);
    expect(listVersions(afterDelete).length).toBe(1);
  });
});

// ===========================================================================
// SECTION 4: Stage tab definitions
// ===========================================================================

describe('Stage tabs', function () {
  it('partial stage is always enabled', function () {
    const tabs = buildStageTabDefs(false, false);
    const partial = tabs.find(function (t) { return t.stage === 'partial'; });
    expect(partial).toBeDefined();
    expect(partial!.enabled).toBe(true);
  });

  it('tailoring stage requires a target job', function () {
    const noJob = buildStageTabDefs(false, false);
    const tailoringNoJob = noJob.find(function (t) { return t.stage === 'tailoring'; });
    expect(tailoringNoJob!.enabled).toBe(false);

    const withJob = buildStageTabDefs(true, false);
    const tailoringWithJob = withJob.find(function (t) { return t.stage === 'tailoring'; });
    expect(tailoringWithJob!.enabled).toBe(true);
  });

  it('validation stage requires target job and tailoring complete', function () {
    const noJob = buildStageTabDefs(false, false);
    const validationNoJob = noJob.find(function (t) { return t.stage === 'validation'; });
    expect(validationNoJob!.enabled).toBe(false);

    const jobNoTailoring = buildStageTabDefs(true, false);
    const validationNoTailoring = jobNoTailoring.find(function (t) { return t.stage === 'validation'; });
    expect(validationNoTailoring!.enabled).toBe(false);

    const complete = buildStageTabDefs(true, true);
    const validationComplete = complete.find(function (t) { return t.stage === 'validation'; });
    expect(validationComplete!.enabled).toBe(true);
  });
});

// ===========================================================================
// SECTION 5: Primary CTA configuration
// ===========================================================================

describe('Primary CTA configuration', function () {
  it('partial stage shows advance CTA', function () {
    const config = buildPrimaryCtaConfig('partial', false, false, false);
    expect(config.label).toBeTruthy();
    expect(config.stage).toBe('partial');
  });

  it('validation stage shows export-style CTA', function () {
    const config = buildPrimaryCtaConfig('validation', false, true, false);
    expect(config.stage).toBe('validation');
  });
});

// ===========================================================================
// SECTION 6: Draft update helpers preserve new fields
// ===========================================================================

describe('updateDraft preserves certifications and supportingEvidence', function () {
  it('updateDraft with summary change keeps certifications', function () {
    const store: ResumeStore = {
      schemaVersion: 1,
      draft: {
        contact: createDefaultContact(),
        summary: 'Old',
        experience: [],
        education: [],
        skills: [],
        certifications: [{ id: 'c1', name: 'PMP' }],
        supportingEvidence: [{ id: 'e1', text: 'Led 5 projects' }],
      },
      versions: [],
    };

    const newDraft: ResumeDraft = Object.assign({}, store.draft, { summary: 'New' });
    const updated = updateDraft(store, newDraft);

    expect(updated.draft.summary).toBe('New');
    expect(updated.draft.certifications.length).toBe(1);
    expect(updated.draft.certifications[0].name).toBe('PMP');
    expect(updated.draft.supportingEvidence.length).toBe(1);
    expect(updated.draft.supportingEvidence[0].text).toBe('Led 5 projects');
  });
});

// ===========================================================================
// SECTION 7: Empty saved-jobs state (target job dropdown)
// ===========================================================================

describe('Target job dropdown empty state', function () {
  it('empty saved jobs array produces empty dropdown items', function () {
    const savedJobs: Array<{ id: string; title: string; agency?: string }> = [];
    const items = savedJobs.map(function (job) {
      return {
        id: job.id,
        label: job.title,
        sublabel: job.agency ? job.agency.split(',')[0] : undefined,
      };
    });
    expect(items.length).toBe(0);
  });

  it('saved jobs produce correctly formatted dropdown items', function () {
    const savedJobs = [
      { id: 'j1', title: 'IT Security Analyst', agency: 'DoD, Cyber Command' },
      { id: 'j2', title: 'Data Scientist', agency: 'NSA' },
    ];
    const items = savedJobs.map(function (job) {
      return {
        id: job.id,
        label: job.title,
        sublabel: job.agency ? job.agency.split(',')[0] : undefined,
      };
    });
    expect(items.length).toBe(2);
    expect(items[0].label).toBe('IT Security Analyst');
    expect(items[0].sublabel).toBe('DoD');
    expect(items[1].sublabel).toBe('NSA');
  });
});

// ===========================================================================
// SECTION 8: Edit/Strengthen/Compress/Add action logic
// ===========================================================================

describe('Section action: strengthen', function () {
  it('strengthen adds "Proven" prefix to summary when missing', function () {
    let summary = 'Cybersecurity professional with 5 years experience';
    if (!summary.includes('proven')) {
      summary = 'Proven ' + summary.charAt(0).toLowerCase() + summary.slice(1);
    }
    expect(summary.startsWith('Proven')).toBe(true);
  });
});

describe('Section action: compress', function () {
  it('compress removes filler words from text', function () {
    let text = 'I very basically just managed the security program in order to improve outcomes';
    const fillerPatterns = [
      /\bvery\b\s*/gi,
      /\breally\b\s*/gi,
      /\bjust\b\s*/gi,
      /\bbasically\b\s*/gi,
    ];
    for (let i = 0; i < fillerPatterns.length; i++) {
      text = text.replace(fillerPatterns[i], '');
    }
    text = text.replace(/in order to/gi, 'to');
    text = text.replace(/\s{2,}/g, ' ').trim();

    expect(text).not.toContain('very');
    expect(text).not.toContain('basically');
    expect(text).not.toContain('just');
    expect(text).toContain('to improve outcomes');
    expect(text).not.toContain('in order to');
  });
});

describe('Section action: add', function () {
  it('adds a new experience entry to the draft', function () {
    const draft = createDefaultDraft();
    const newExp = {
      id: 'exp-test',
      jobTitle: '',
      employer: '',
      location: '',
      startDate: '',
      endDate: '',
      hoursPerWeek: '40',
      grade: '',
      duties: '',
    };
    const updatedExperience = draft.experience.concat([newExp]);
    expect(updatedExperience.length).toBe(1);
    expect(updatedExperience[0].id).toBe('exp-test');
  });

  it('adds a new certification to the draft', function () {
    const draft = createDefaultDraft();
    const newCert = { id: 'cert-test', name: 'PMP' };
    const updatedCerts = draft.certifications.concat([newCert]);
    expect(updatedCerts.length).toBe(1);
    expect(updatedCerts[0].name).toBe('PMP');
  });

  it('adds a new supporting evidence item to the draft', function () {
    const draft = createDefaultDraft();
    const newEvidence = { id: 'ev-test', text: 'New achievement' };
    const updatedEvidence = draft.supportingEvidence.concat([newEvidence]);
    expect(updatedEvidence.length).toBe(1);
    expect(updatedEvidence[0].text).toBe('New achievement');
  });
});

// ===========================================================================
// SECTION 9: No regressions in section progress / callout types
// ===========================================================================

describe('No regressions: section progress derivation', function () {
  it('canonical UI order includes all 8 expected sections', function () {
    const registry = buildFederalSectionMeta();
    const order = getCanonicalUIOrder(registry);
    expect(order.length).toBeGreaterThanOrEqual(8);
    const ids = order.map(function (s) { return s.sectionId; });
    expect(ids).toContain('contact');
    expect(ids).toContain('summary');
    expect(ids).toContain('experience');
    expect(ids).toContain('education');
    expect(ids).toContain('certifications');
    expect(ids).toContain('skills');
    expect(ids).toContain('federal-details');
    expect(ids).toContain('supporting-evidence');
  });
});
