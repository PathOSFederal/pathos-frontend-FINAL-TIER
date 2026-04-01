# Change Brief: PDF Polish and UI Cleanup for Resume Builder

## What changed

The exported PDF resume now has better spacing and visual hierarchy. The header (name, contact info, citizenship) has more breathing room, section headings are easier to scan, and experience entries are no longer cramped. The "Export JSON" button has been removed from the preview screen since it was a developer tool, not something a normal user needs.

## Why

The deterministic PDF export was functional but the document felt dense and cramped — especially the header block where the candidate name, contact details, and citizenship line were too close together. Section headings and experience entries also needed more visual separation to make the resume easy to scan. The Export JSON button was visible in the action bar alongside "Export Resume PDF" and "Print", creating confusion about which option to use.

## How it works now

### PDF spacing

All vertical spacing in the exported PDF is controlled by 11 named constants in one place. Each constant is named for the gap it controls (e.g. "gap after candidate name", "gap between experience entries"), making it easy to tune the document's feel without hunting through rendering code.

Key improvements:
- **Header block**: 4pt gap after the name, 2pt after the contact line, 6pt before the separator, 10pt after the separator
- **Section headings**: 4pt from heading text to underline, 8pt from underline to content
- **Experience entries**: 2pt after job title row, 4pt after employer row, 1pt between bullets, 8pt between entries
- **Between sections**: 20pt (up from 18pt) for clearer section boundaries

### Export UI

The preview overlay action bar now shows three buttons:
1. **Export Resume PDF** — primary action, generates a clean PDF directly
2. **Print** — fallback for browser print dialog
3. **Close** (X) — closes the preview

The Export JSON option is no longer visible. The code path is retained internally for developer/debugging use.

## What the user sees

- Exported PDFs have more breathing room and are easier to read
- The preview action bar is cleaner with fewer buttons
- Export Resume PDF remains the primary action
- No change to how the PDF is generated or downloaded
- No change to page count or content

## ATS safety

No change — the PDF still uses real, selectable text (not images). All content remains searchable and ATS-compatible.

## What was not changed

- Scoring logic
- PathAdvisor flows
- Pagination engine (page assignments are identical)
- Top-bar workspace controls (Edit, Review Resume, Preview, Versions)
- Multi-page export behavior
- Print fallback
