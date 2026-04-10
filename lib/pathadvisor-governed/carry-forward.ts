/**
 * ============================================================================
 * PATHADVISOR CARRY-FORWARD TRANSFORMS
 * ============================================================================ 
 *
 * PURPOSE:
 * Detect one-step follow-ups like `same thing but for GS-12 in Florida` and
 * turn them into an effective full question without introducing open-ended
 * history or free-form memory.
 *
 * BOUNDARY:
 * - Only the immediately previous user turn may be carried forward.
 * - Only explicit `same thing but ...` style transforms are supported.
 * - The helper returns both the original turn and the effective rewritten
 *   question so transport can stay auditable.
 */

export interface PathAdvisorCarryForwardContext {
  sourceKind: 'immediately_previous_user_turn';
  transformKind: 'same_thing_but';
  priorUserMessage: string;
  originalUserMessage: string;
  effectiveUserMessage: string;
}

export interface PathAdvisorCarryForwardMessageLike {
  role: string;
  content: string;
}

const SAME_THING_BUT_PREFIXES = [
  'same thing but for ',
  'same question but for ',
  'same thing but ',
  'same question but ',
  'same but ',
] as const;

const WORK_ARRANGEMENTS = new Set([
  'remote',
  'remote only',
  'fully remote',
  'hybrid',
  'hybrid work',
  'onsite',
  'on site',
  'on-site',
  'telework',
  'teleworking',
  'in person',
  'in-person',
  'only remote',
  'only remote work',
  'only telework',
  'only hybrid',
]);

const LOCATION_VALUES = new Set([
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'district of columbia',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'washington dc',
  'west virginia',
  'wisconsin',
  'wyoming',
  'northern virginia',
]);

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[?!.,]+$/g, '').trim();
}

function startsWithAnyPrefix(value: string): string | null {
  for (let i = 0; i < SAME_THING_BUT_PREFIXES.length; i += 1) {
    if (value.startsWith(SAME_THING_BUT_PREFIXES[i])) {
      return SAME_THING_BUT_PREFIXES[i];
    }
  }
  return null;
}

function canonicalizeSuffix(value: string): string {
  return normalizeWhitespace(value.toLowerCase().replace(/[?!.,]+$/g, ''));
}

function buildEffectiveQuestion(priorUserMessage: string, suffix: string): string {
  const baseQuestion = stripTrailingPunctuation(priorUserMessage);
  const normalizedSuffix = canonicalizeSuffix(suffix);

  if (/^gs[\s-]?\d{1,2}(?:\s+in\s+.+)?$/.test(normalizedSuffix)) {
    return `${baseQuestion} for ${normalizedSuffix}?`;
  }

  if (/^\d{4}(?:\s+in\s+.+)?$/.test(normalizedSuffix)) {
    return `${baseQuestion} for ${normalizedSuffix}?`;
  }

  if (LOCATION_VALUES.has(normalizedSuffix)) {
    return `${baseQuestion} in ${normalizedSuffix}?`;
  }

  if (WORK_ARRANGEMENTS.has(normalizedSuffix)) {
    return `${baseQuestion} that are ${normalizedSuffix}?`;
  }

  return `${baseQuestion} ${normalizedSuffix}?`;
}

export function findMostRecentUserMessage(
  messages: readonly PathAdvisorCarryForwardMessageLike[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }

  return null;
}

export function findPreviousUserMessage(
  messages: readonly PathAdvisorCarryForwardMessageLike[]
): string | null {
  let userMessagesSeen = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') {
      continue;
    }

    userMessagesSeen += 1;
    if (userMessagesSeen === 2) {
      return messages[i].content;
    }
  }

  return null;
}

export function buildPathAdvisorCarryForwardContext(
  originalUserMessage: string,
  priorUserMessage: string | null
): PathAdvisorCarryForwardContext | null {
  if (priorUserMessage === null) {
    return null;
  }

  const normalizedOriginal = canonicalizeSuffix(originalUserMessage);
  const matchedPrefix = startsWithAnyPrefix(normalizedOriginal);
  if (matchedPrefix === null) {
    return null;
  }

  const suffix = normalizedOriginal.slice(matchedPrefix.length).trim();
  if (suffix === '') {
    return null;
  }

  return {
    sourceKind: 'immediately_previous_user_turn',
    transformKind: 'same_thing_but',
    priorUserMessage: normalizeWhitespace(priorUserMessage),
    originalUserMessage: normalizeWhitespace(originalUserMessage),
    effectiveUserMessage: buildEffectiveQuestion(priorUserMessage, suffix),
  };
}
