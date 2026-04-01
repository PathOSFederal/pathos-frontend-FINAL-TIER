# Change Brief: Resume Builder Severity/Health Reconciliation

## What Changed

The Resume Builder's color system for section status, callout endpoints, and guidance cards
has been reconciled so they work together coherently instead of contradicting each other.

## Why This Matters

Previously, users could see confusing mixed signals:

- The left rail might show a section as **green** (all fields filled)
- But clicking a callout endpoint might show an **amber** circle
- And the guidance card might display with a **red** border

This happened because three different parts of the system used three different rules
to choose colors. Field fill rate alone decided the rail color. The annotation class
(evidence / alignment / compression) decided the card color. And the issue severity
(high / medium / low) decided the endpoint color. These never coordinated.

## What's Different Now

### Section health now considers real issues, not just field fill rate

The left rail badge color no longer relies solely on how many fields are filled. If a
section has all fields filled (100%) but still has unresolved high-severity issues, the
badge correctly shows amber or red instead of green. This prevents the misleading
"everything looks fine" signal when real problems exist.

### Callout endpoints and guidance cards now share one color source

When you click a callout endpoint, the guidance card that opens now uses the same
severity color as the endpoint circle. A red endpoint always opens a red-accented card.
An amber endpoint always opens an amber-accented card. They can no longer disagree.

### Section health and issue severity are shown without conflict

The guidance card now shows two distinct signals:

1. **Primary accent** (border, action buttons): the active issue's severity, matching
   the endpoint color
2. **Secondary badge** (small dot + label at the top): the overall section health,
   matching the rail color

These two signals can be different — a section might be overall healthy (green) while
viewing a low-priority informational callout. Or a section might be amber overall while
viewing a critical issue. Both signals are visible, clearly distinguished, and neither
contradicts the other.

### Contact / Eligibility no longer shows false green

The Contact / Eligibility section specifically had a problem where all basic fields
(name, email, phone, location, citizenship) were filled, making it show 100% green.
But at the same time, the card would say "missing eligibility information." Now, if
a high-severity eligibility issue exists, the section correctly shows amber even at
100% field fill.

## What Didn't Change

- The overall Resume Builder layout and interaction model remain the same
- The annotation classes (evidence / alignment / compression) still exist as labels
- The callout line overlay, endpoint positioning, and section rail structure are unchanged
- No routes, persistence, or shell behavior were modified
- The 5-tier color band system (critical / poor / fair / good / strong) is preserved

## Trust Impact

These changes make the builder easier to trust. When the rail says a section is healthy,
it genuinely is. When a card says there's a critical issue, the endpoint and rail agree.
Users can rely on the color signals to guide their attention without second-guessing
whether the system is confused.
