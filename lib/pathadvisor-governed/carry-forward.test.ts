import { describe, expect, it } from 'vitest';

import {
  buildPathAdvisorCarryForwardContext,
  findMostRecentUserMessage,
  findPreviousUserMessage,
} from './carry-forward';

describe('PathAdvisor carry-forward transforms', function () {
  it('builds a one-step effective question for explicit same-thing-but transforms', function () {
    const context = buildPathAdvisorCarryForwardContext(
      'same thing but for GS-12 in Florida',
      'Are there law enforcement jobs available?'
    );

    expect(context).toEqual({
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      baseUserMessage: 'Are there law enforcement jobs available?',
      priorUserMessage: 'Are there law enforcement jobs available?',
      originalUserMessage: 'same thing but for GS-12 in Florida',
      effectiveUserMessage: 'Are there law enforcement jobs available for gs-12 in florida?',
      modifiers: [
        { kind: 'grade', value: 'gs-12' },
        { kind: 'location', value: 'florida' },
      ],
      modifierChanges: [
        { kind: 'grade', operation: 'add', value: 'gs-12', previousValue: null },
        { kind: 'location', operation: 'add', value: 'florida', previousValue: null },
      ],
    });
  });

  it('builds a structured modifier chain for multi-modifier transforms', function () {
    const context = buildPathAdvisorCarryForwardContext(
      'same thing but for GS-12 in Florida and remote only',
      'Are there law enforcement jobs available?'
    );

    expect(context).toEqual({
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      baseUserMessage: 'Are there law enforcement jobs available?',
      priorUserMessage: 'Are there law enforcement jobs available?',
      originalUserMessage: 'same thing but for GS-12 in Florida and remote only',
      effectiveUserMessage:
        'Are there law enforcement jobs available for gs-12 in florida that are remote only?',
      modifiers: [
        { kind: 'grade', value: 'gs-12' },
        { kind: 'location', value: 'florida' },
        { kind: 'work_arrangement', value: 'remote only' },
      ],
      modifierChanges: [
        { kind: 'grade', operation: 'add', value: 'gs-12', previousValue: null },
        { kind: 'location', operation: 'add', value: 'florida', previousValue: null },
        {
          kind: 'work_arrangement',
          operation: 'add',
          value: 'remote only',
          previousValue: null,
        },
      ],
    });
  });

  it('chains a modifier-only follow-up from the previous structured transform', function () {
    const priorContext = buildPathAdvisorCarryForwardContext(
      'same thing but for GS-12 in Florida',
      'Are there law enforcement jobs available?'
    );

    const context = buildPathAdvisorCarryForwardContext(
      'and remote only',
      'same thing but for GS-12 in Florida',
      priorContext
    );

    expect(context).toEqual({
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'modifier_follow_up',
      baseUserMessage: 'Are there law enforcement jobs available?',
      priorUserMessage: 'same thing but for GS-12 in Florida',
      originalUserMessage: 'and remote only',
      effectiveUserMessage:
        'Are there law enforcement jobs available for gs-12 in florida that are remote only?',
      modifiers: [
        { kind: 'grade', value: 'gs-12' },
        { kind: 'location', value: 'florida' },
        { kind: 'work_arrangement', value: 'remote only' },
      ],
      modifierChanges: [
        {
          kind: 'work_arrangement',
          operation: 'add',
          value: 'remote only',
          previousValue: null,
        },
      ],
    });
  });

  it('keeps chaining bounded modifier follow-ups from the latest structured transform in the thread', function () {
    const firstContext = buildPathAdvisorCarryForwardContext(
      'same thing but for GS-12 in Florida',
      'Are there law enforcement jobs available?'
    );
    const secondContext = buildPathAdvisorCarryForwardContext(
      'and remote only',
      'same thing but for GS-12 in Florida',
      firstContext
    );

    const thirdContext = buildPathAdvisorCarryForwardContext(
      'and 1811',
      'and remote only',
      secondContext
    );

    expect(thirdContext).toEqual({
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'modifier_follow_up',
      baseUserMessage: 'Are there law enforcement jobs available?',
      priorUserMessage: 'and remote only',
      originalUserMessage: 'and 1811',
      effectiveUserMessage:
        'Are there law enforcement jobs available for gs-12 1811 in florida that are remote only?',
      modifiers: [
        { kind: 'grade', value: 'gs-12' },
        { kind: 'series', value: '1811' },
        { kind: 'location', value: 'florida' },
        { kind: 'work_arrangement', value: 'remote only' },
      ],
      modifierChanges: [
        { kind: 'series', operation: 'add', value: '1811', previousValue: null },
      ],
    });
  });

  it('restarts from the preserved base question for a new same-thing-but transform after a prior transform', function () {
    const priorContext = buildPathAdvisorCarryForwardContext(
      'same thing but for GS-12 in Florida',
      'Are there law enforcement jobs available?'
    );

    const context = buildPathAdvisorCarryForwardContext(
      'same thing but for Texas',
      'same thing but for GS-12 in Florida',
      priorContext
    );

    expect(context).toEqual({
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      baseUserMessage: 'Are there law enforcement jobs available?',
      priorUserMessage: 'same thing but for GS-12 in Florida',
      originalUserMessage: 'same thing but for Texas',
      effectiveUserMessage: 'Are there law enforcement jobs available in texas?',
      modifiers: [{ kind: 'location', value: 'texas' }],
      modifierChanges: [
        { kind: 'grade', operation: 'remove', value: null, previousValue: 'gs-12' },
        {
          kind: 'location',
          operation: 'replace',
          value: 'texas',
          previousValue: 'florida',
        },
      ],
    });
  });

  it('does not treat modifier-only follow-ups as carry-forward without a prior structured transform', function () {
    expect(
      buildPathAdvisorCarryForwardContext(
        'and remote only',
        'Are there law enforcement jobs available?'
      )
    ).toBeNull();
  });

  it('returns null when there is no prior user turn to carry forward', function () {
    expect(
      buildPathAdvisorCarryForwardContext('same thing but for GS-12 in Florida', null)
    ).toBeNull();
  });

  it('returns null for non-transform follow-ups', function () {
    expect(
      buildPathAdvisorCarryForwardContext(
        'what does this mean?',
        'Are there law enforcement jobs available?'
      )
    ).toBeNull();
  });

  it('finds the most recent user message from a mixed conversation log', function () {
    expect(
      findMostRecentUserMessage([
        { role: 'user', content: 'Are there law enforcement jobs available?' },
        { role: 'assistant', content: 'I found current matches.' },
        { role: 'user', content: 'same thing but for Florida' },
      ])
    ).toBe('same thing but for Florida');
  });

  it('finds the immediately previous user message when the current turn is already in the thread', function () {
    expect(
      findPreviousUserMessage([
        { role: 'user', content: 'Are there law enforcement jobs available?' },
        { role: 'assistant', content: 'I found current matches.' },
        { role: 'user', content: 'same thing but for Florida' },
      ])
    ).toBe('Are there law enforcement jobs available?');
  });

  it('returns null for previous-user lookup when a new thread has only one user message', function () {
    expect(
      findPreviousUserMessage([
        { role: 'user', content: 'same thing but for Florida' },
      ])
    ).toBeNull();
  });
});
