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
 * - Only explicit `same thing but ...` style transforms or one bounded
 *   modifier-only follow-up after a prior structured transform are supported.
 * - The helper returns both the original turn and the effective rewritten
 *   question so transport can stay auditable.
 */

export interface PathAdvisorCarryForwardContext {
  sourceKind: 'immediately_previous_user_turn';
  transformKind: 'same_thing_but' | 'modifier_follow_up';
  baseUserMessage: string;
  priorUserMessage: string;
  originalUserMessage: string;
  effectiveUserMessage: string;
  modifiers: PathAdvisorCarryForwardModifier[];
  modifierChanges: PathAdvisorCarryForwardModifierChange[];
}

export interface PathAdvisorCarryForwardMessageLike {
  role: string;
  content: string;
}

export interface PathAdvisorCarryForwardModifier {
  kind: 'grade' | 'series' | 'location' | 'work_arrangement' | 'freeform';
  value: string;
}

export interface PathAdvisorCarryForwardModifierChange {
  kind: 'grade' | 'series' | 'location' | 'work_arrangement' | 'freeform';
  operation: 'add' | 'replace' | 'remove';
  value: string | null;
  previousValue: string | null;
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

const MODIFIER_KIND_ORDER: Record<PathAdvisorCarryForwardModifier['kind'], number> = {
  grade: 0,
  series: 1,
  location: 2,
  work_arrangement: 3,
  freeform: 4,
};
const ORDERED_NON_FREEFORM_KINDS: Array<
  Exclude<PathAdvisorCarryForwardModifier['kind'], 'freeform'>
> = ['grade', 'series', 'location', 'work_arrangement'];

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

function appendModifierToQuestion(
  currentQuestion: string,
  modifier: PathAdvisorCarryForwardModifier,
  hasTargetRefinement: boolean
): string {
  if (modifier.kind === 'grade' || modifier.kind === 'series') {
    return hasTargetRefinement
      ? `${currentQuestion} ${modifier.value}`
      : `${currentQuestion} for ${modifier.value}`;
  }

  if (modifier.kind === 'location') {
    return `${currentQuestion} in ${modifier.value}`;
  }

  if (modifier.kind === 'work_arrangement') {
    return `${currentQuestion} that are ${modifier.value}`;
  }

  return `${currentQuestion} ${modifier.value}`;
}

function parseModifierSegment(segment: string): PathAdvisorCarryForwardModifier[] {
  const normalizedSegment = canonicalizeSuffix(segment);
  if (normalizedSegment === '') {
    return [];
  }

  if (normalizedSegment.startsWith('for ')) {
    return parseModifierSegment(normalizedSegment.slice(4));
  }

  const gradeWithLocationMatch = normalizedSegment.match(
    /^(gs[\s-]?\d{1,2})\s+in\s+(.+)$/
  );
  if (gradeWithLocationMatch !== null) {
    const modifiers: PathAdvisorCarryForwardModifier[] = [
      { kind: 'grade', value: gradeWithLocationMatch[1] },
    ];
    const locationValue = gradeWithLocationMatch[2].trim();
    if (LOCATION_VALUES.has(locationValue)) {
      modifiers.push({ kind: 'location', value: locationValue });
    } else {
      modifiers.push({ kind: 'freeform', value: `in ${locationValue}` });
    }
    return modifiers;
  }

  const seriesWithLocationMatch = normalizedSegment.match(
    /^((?:series\s+)?\d{4})\s+in\s+(.+)$/
  );
  if (seriesWithLocationMatch !== null) {
    const modifiers: PathAdvisorCarryForwardModifier[] = [
      { kind: 'series', value: seriesWithLocationMatch[1].replace(/^series\s+/, '') },
    ];
    const locationValue = seriesWithLocationMatch[2].trim();
    if (LOCATION_VALUES.has(locationValue)) {
      modifiers.push({ kind: 'location', value: locationValue });
    } else {
      modifiers.push({ kind: 'freeform', value: `in ${locationValue}` });
    }
    return modifiers;
  }

  if (/^gs[\s-]?\d{1,2}$/.test(normalizedSegment)) {
    return [{ kind: 'grade', value: normalizedSegment }];
  }

  if (/^(?:series\s+)?\d{4}$/.test(normalizedSegment)) {
    return [
      {
        kind: 'series',
        value: normalizedSegment.replace(/^series\s+/, ''),
      },
    ];
  }

  if (normalizedSegment.startsWith('in ')) {
    const locationValue = normalizedSegment.slice(3).trim();
    if (LOCATION_VALUES.has(locationValue)) {
      return [{ kind: 'location', value: locationValue }];
    }
  }

  if (LOCATION_VALUES.has(normalizedSegment)) {
    return [{ kind: 'location', value: normalizedSegment }];
  }

  if (WORK_ARRANGEMENTS.has(normalizedSegment)) {
    return [{ kind: 'work_arrangement', value: normalizedSegment }];
  }

  return [{ kind: 'freeform', value: normalizedSegment }];
}

function buildCarryForwardModifiers(suffix: string): PathAdvisorCarryForwardModifier[] {
  const normalizedSuffix = canonicalizeSuffix(suffix);
  if (normalizedSuffix === '') {
    return [];
  }

  const modifiers: PathAdvisorCarryForwardModifier[] = [];
  const segments = normalizedSuffix.split(/\s+and\s+/);

  for (let i = 0; i < segments.length; i += 1) {
    const parsedSegmentModifiers = parseModifierSegment(segments[i]);
    for (let j = 0; j < parsedSegmentModifiers.length; j += 1) {
      modifiers.push(parsedSegmentModifiers[j]);
    }
  }

  return modifiers;
}

function sortCarryForwardModifiers(
  modifiers: readonly PathAdvisorCarryForwardModifier[]
): PathAdvisorCarryForwardModifier[] {
  return [...modifiers].sort(function (left, right) {
    return MODIFIER_KIND_ORDER[left.kind] - MODIFIER_KIND_ORDER[right.kind];
  });
}

function sortCarryForwardModifierChanges(
  changes: readonly PathAdvisorCarryForwardModifierChange[]
): PathAdvisorCarryForwardModifierChange[] {
  return [...changes].sort(function (left, right) {
    return MODIFIER_KIND_ORDER[left.kind] - MODIFIER_KIND_ORDER[right.kind];
  });
}

function buildEffectiveQuestion(
  baseUserMessage: string,
  suffix: string,
  modifiers: readonly PathAdvisorCarryForwardModifier[]
): string {
  const baseQuestion = stripTrailingPunctuation(baseUserMessage);
  const normalizedSuffix = canonicalizeSuffix(suffix);

  if (modifiers.length > 0) {
    let transformedQuestion = baseQuestion;
    let hasTargetRefinement = false;

    for (let i = 0; i < modifiers.length; i += 1) {
      transformedQuestion = appendModifierToQuestion(
        transformedQuestion,
        modifiers[i],
        hasTargetRefinement
      );
      if (modifiers[i].kind === 'grade' || modifiers[i].kind === 'series') {
        hasTargetRefinement = true;
      }
    }

    return `${transformedQuestion}?`;
  }

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

function isUsablePriorCarryForwardContext(
  priorUserMessage: string,
  priorCarryForwardContext: PathAdvisorCarryForwardContext | null | undefined
): priorCarryForwardContext is PathAdvisorCarryForwardContext {
  if (priorCarryForwardContext === null || priorCarryForwardContext === undefined) {
    return false;
  }

  return (
    normalizeWhitespace(priorUserMessage) ===
    normalizeWhitespace(priorCarryForwardContext.originalUserMessage)
  );
}

function buildMergedCarryForwardModifiers(
  priorModifiers: readonly PathAdvisorCarryForwardModifier[],
  nextModifiers: readonly PathAdvisorCarryForwardModifier[]
): PathAdvisorCarryForwardModifier[] {
  const merged: PathAdvisorCarryForwardModifier[] = [];
  const nonFreeformIndexes = new Map<string, number>();

  for (let i = 0; i < priorModifiers.length; i += 1) {
    merged.push(priorModifiers[i]);
    if (priorModifiers[i].kind !== 'freeform') {
      nonFreeformIndexes.set(priorModifiers[i].kind, merged.length - 1);
    }
  }

  for (let i = 0; i < nextModifiers.length; i += 1) {
    const modifier = nextModifiers[i];
    if (modifier.kind === 'freeform') {
      merged.push(modifier);
      continue;
    }

    const existingIndex = nonFreeformIndexes.get(modifier.kind);
    if (existingIndex === undefined) {
      nonFreeformIndexes.set(modifier.kind, merged.length);
      merged.push(modifier);
      continue;
    }

    merged[existingIndex] = modifier;
  }

  return merged;
}

function buildCarryForwardModifierChanges(
  previousModifiers: readonly PathAdvisorCarryForwardModifier[],
  nextModifiers: readonly PathAdvisorCarryForwardModifier[]
): PathAdvisorCarryForwardModifierChange[] {
  const changes: PathAdvisorCarryForwardModifierChange[] = [];
  const previousByKind = new Map<
    Exclude<PathAdvisorCarryForwardModifier['kind'], 'freeform'>,
    string
  >();
  const nextByKind = new Map<
    Exclude<PathAdvisorCarryForwardModifier['kind'], 'freeform'>,
    string
  >();
  const previousFreeformValues: string[] = [];
  const nextFreeformValues: string[] = [];

  for (let i = 0; i < previousModifiers.length; i += 1) {
    if (previousModifiers[i].kind === 'freeform') {
      previousFreeformValues.push(previousModifiers[i].value);
      continue;
    }

    previousByKind.set(previousModifiers[i].kind, previousModifiers[i].value);
  }

  for (let i = 0; i < nextModifiers.length; i += 1) {
    if (nextModifiers[i].kind === 'freeform') {
      nextFreeformValues.push(nextModifiers[i].value);
      continue;
    }

    nextByKind.set(nextModifiers[i].kind, nextModifiers[i].value);
  }

  for (let i = 0; i < ORDERED_NON_FREEFORM_KINDS.length; i += 1) {
    const kind = ORDERED_NON_FREEFORM_KINDS[i];
    const previousValue = previousByKind.get(kind) ?? null;
    const nextValue = nextByKind.get(kind) ?? null;

    if (previousValue === null && nextValue === null) {
      continue;
    }

    if (previousValue === null && nextValue !== null) {
      changes.push({
        kind: kind,
        operation: 'add',
        value: nextValue,
        previousValue: null,
      });
      continue;
    }

    if (previousValue !== null && nextValue === null) {
      changes.push({
        kind: kind,
        operation: 'remove',
        value: null,
        previousValue: previousValue,
      });
      continue;
    }

    if (previousValue !== nextValue) {
      changes.push({
        kind: kind,
        operation: 'replace',
        value: nextValue,
        previousValue: previousValue,
      });
    }
  }

  for (let i = 0; i < nextFreeformValues.length; i += 1) {
    if (previousFreeformValues.indexOf(nextFreeformValues[i]) === -1) {
      changes.push({
        kind: 'freeform',
        operation: 'add',
        value: nextFreeformValues[i],
        previousValue: null,
      });
    }
  }

  for (let i = 0; i < previousFreeformValues.length; i += 1) {
    if (nextFreeformValues.indexOf(previousFreeformValues[i]) === -1) {
      changes.push({
        kind: 'freeform',
        operation: 'remove',
        value: null,
        previousValue: previousFreeformValues[i],
      });
    }
  }

  return sortCarryForwardModifierChanges(changes);
}

function buildModifierFollowUpModifiers(
  originalUserMessage: string
): PathAdvisorCarryForwardModifier[] | null {
  let normalizedOriginal = canonicalizeSuffix(originalUserMessage);
  if (normalizedOriginal === '') {
    return null;
  }

  if (normalizedOriginal.startsWith('and ')) {
    normalizedOriginal = normalizedOriginal.slice(4).trim();
  } else if (normalizedOriginal.startsWith('also ')) {
    normalizedOriginal = normalizedOriginal.slice(5).trim();
  }

  if (normalizedOriginal === '') {
    return null;
  }

  const modifiers = buildCarryForwardModifiers(normalizedOriginal);
  if (modifiers.length === 0) {
    return null;
  }

  for (let i = 0; i < modifiers.length; i += 1) {
    if (modifiers[i].kind === 'freeform') {
      return null;
    }
  }

  return modifiers;
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
  priorUserMessage: string | null,
  priorCarryForwardContext: PathAdvisorCarryForwardContext | null = null
): PathAdvisorCarryForwardContext | null {
  if (priorUserMessage === null) {
    return null;
  }

  const normalizedOriginal = canonicalizeSuffix(originalUserMessage);
  const matchedPrefix = startsWithAnyPrefix(normalizedOriginal);
  if (matchedPrefix !== null) {
    const suffix = normalizedOriginal.slice(matchedPrefix.length).trim();
    if (suffix === '') {
      return null;
    }
    const modifiers = sortCarryForwardModifiers(buildCarryForwardModifiers(suffix));
    const previousModifiers =
      isUsablePriorCarryForwardContext(priorUserMessage, priorCarryForwardContext)
        ? priorCarryForwardContext.modifiers
        : [];
    const baseUserMessage = isUsablePriorCarryForwardContext(
      priorUserMessage,
      priorCarryForwardContext
    )
      ? priorCarryForwardContext.baseUserMessage
      : priorUserMessage;

    return {
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      baseUserMessage: normalizeWhitespace(baseUserMessage),
      priorUserMessage: normalizeWhitespace(priorUserMessage),
      originalUserMessage: normalizeWhitespace(originalUserMessage),
      effectiveUserMessage: buildEffectiveQuestion(baseUserMessage, suffix, modifiers),
      modifiers: modifiers,
      modifierChanges: buildCarryForwardModifierChanges(previousModifiers, modifiers),
    };
  }

  if (
    !isUsablePriorCarryForwardContext(priorUserMessage, priorCarryForwardContext)
  ) {
    return null;
  }

  const followUpModifiers = buildModifierFollowUpModifiers(originalUserMessage);
  if (followUpModifiers === null) {
    return null;
  }

  const mergedModifiers = sortCarryForwardModifiers(
    buildMergedCarryForwardModifiers(
      priorCarryForwardContext.modifiers,
      followUpModifiers
    )
  );

  return {
    sourceKind: 'immediately_previous_user_turn',
    transformKind: 'modifier_follow_up',
    baseUserMessage: normalizeWhitespace(priorCarryForwardContext.baseUserMessage),
    priorUserMessage: normalizeWhitespace(priorUserMessage),
    originalUserMessage: normalizeWhitespace(originalUserMessage),
    effectiveUserMessage: buildEffectiveQuestion(
      priorCarryForwardContext.baseUserMessage,
      '',
      mergedModifiers
    ),
    modifiers: mergedModifiers,
    modifierChanges: buildCarryForwardModifierChanges(
      priorCarryForwardContext.modifiers,
      mergedModifiers
    ),
  };
}
