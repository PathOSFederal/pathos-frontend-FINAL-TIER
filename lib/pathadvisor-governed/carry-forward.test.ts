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
      priorUserMessage: 'Are there law enforcement jobs available?',
      originalUserMessage: 'same thing but for GS-12 in Florida',
      effectiveUserMessage: 'Are there law enforcement jobs available for gs-12 in florida?',
    });
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
