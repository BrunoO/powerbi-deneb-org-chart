# Search Text — Future Feature Proposal

## Status

- **Status:** Proposed / not implemented
- **Date:** 2026-11-24
- **Related gap:** "Find person" quick win identified in user-needs research (common request in Power BI org chart visuals: xViz, SmartVisuals, MAQ, Reddit feedback).

## Problem

Users with medium/large orgs need to locate a person quickly. Today they must pan/zoom and visually scan the tree. There is no in-canvas search/find capability in `deneb-org-chart.json`.

## Goal

Allow a report author/consumer to enter a search term and immediately see matching employee cards highlighted in the existing org chart, without breaking layout, focus, filter, or collapse behavior.

## Non-goals (initial version)

- No layout reflow/filtering of `tree_nodes` by search (avoid fighting collapse/focus/anchor/stack logic).
- No dependency on Vega HTML `bind` text input as the primary Power BI report-view UX.
- No fuzzy/semantic search; start with simple case-insensitive contains matching.
- No keyboard navigation/accessibility model beyond current Vega/Deneb constraints.

## Proposed UX

| State | Behavior |
|---|---|
| `searchText` is empty/whitespace | No change to current visuals. |
| `searchText` has value | Matching visible cards remain prominent; non-matching cards dim (e.g. opacity ~0.2) unless needed for active focus context. Matches get a subtle highlight (outline/badge), distinct from the focused-card 3px ring. |
| No matches | Show a clear indicator near toolbar/gesture hint, e.g. `No matches for "..."`. |
| Match count | Optional indicator, e.g. `🔎 3 matches for "alex"`. |

## Matching rules (initial)

- Normalize: `lower(trim(toString(...)))`.
- Empty/whitespace => inactive.
- Default fields: `Name_clean`, `Title_clean`.
- Optional: include `id` only when `showIdInTooltip == true` or an explicit opt-in signal is enabled, to avoid confidential-ID leakage through search behavior.
- Optional later: `Extra1_clean`, `Extra2_clean`, `Extra3_clean`, configurable field list.

## Spec design sketch

### Signal

Read search text from an optional dataset field passed through Deneb Values:

```json
{
  "name": "searchText",
  "update": "length(data('dataset')) > 0 && isValid(data('dataset')[0]['Search Query']) ? lower(trim(toString(data('dataset')[0]['Search Query']))) : ''"
}
```

For authoring/debug only, a temporary Vega bind may be used:

```json
{
  "name": "searchText",
  "value": "",
  "bind": {"input": "text", "placeholder": "Find person..."}
}
```

Do not rely on the bind as the primary published Power BI consumer experience.

### Node formula

Compute once in `tree_nodes` (after clean fields exist):

```json
{
  "type": "formula",
  "as": "searchMatch",
  "expr": "searchText === '' ? false : indexof(lower(datum.Name_clean), searchText) >= 0 || indexof(lower(datum.Title_clean), searchText) >= 0"
}
```

### Visual precedence

Define precedence to avoid state collisions:

1. **Extra 2 filter** controls visibility/data inclusion (existing behavior).
2. **Search** controls match highlight/dimming on visible nodes.
3. **Branch focus** (`focusedId` / `activeHighlightId`) keeps its 3px focus ring and active lineage semantics.

When search is active, dim non-matches but preserve readability of the active focused path if needed; keep the focused ring visually distinct from search match styling.

## Power BI configuration (recommended)

1. Create a disconnected table, e.g. `SearchInput[Query]`, not related to the employee table.
2. Add a Text Filter visual (AppSource) or other input control bound to `SearchInput[Query]`.
3. Create a measure:
   ```dax
   Search Query = SELECTEDVALUE ( 'SearchInput'[Query], "" )
   ```
4. Add `Search Query` to the Deneb visual **Values** well, alongside `ID`, `ParentID`, `Name`, `Title`, optional extras.
5. Ensure the field display name matches the spec (`Search Query` in the example). Deneb exposes Values by their field names.
6. Because the source is disconnected, typing search text should not filter org rows out of Deneb; the spec uses the value only for highlighting.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| No reliable report-consumer text input via Vega bind | Feature unusable/confusing in published reports | Use disconnected Values field/measure as primary input; bind only for authoring/debug. |
| Search collides with focus/filter/collapse state | Wrong dimming, confusing highlight, regressions | Make search a visual overlay, not a data filter; define precedence; keep `focusedId` ring distinct. |
| Confidential ID leakage | Searching ID may reveal hidden IDs | Only include ID when explicitly allowed (`showIdInTooltip` or dedicated opt-in). |
| Matching semantics disappointment | Users miss expected results | Start with documented contains match on name/title; normalize case/trim; consider extras/accent handling later. |
| Performance/spec complexity | Slow or brittle spec | Compute `searchText` once, `searchMatch` once per node; use `indexof`, not regex/data scans in encodes. |
| Discoverability/reset confusion | Users think data is missing | Add visible match/no-match indicator; document clear behavior; do not silently clear external search field. |

## Implementation plan

1. **Spec**: add `searchText` signal, `searchMatch` formula, and encode changes for card/body/text opacity and optional match stroke.
2. **UX**: add subtle toolbar/hint indicator for active search and match count.
3. **Docs**: update `README.md` with setup steps, limitations, and confidentiality note.
4. **Verification**: extend `tools/verify-layout.js` with search scenarios (match count, dimming behavior, no layout shift, interaction with focus/filter).
5. **Preview sync**: run `npm run sync-preview` after spec change.

## Acceptance criteria

- Empty search leaves rendering and behavior unchanged.
- Non-empty search highlights matches and dims non-matches without moving nodes.
- Search does not break Extra 2 filter, branch focus, collapse/expand, zoom/pan, or anchor pinning.
- Works with disconnected `Search Query` Values field in Power BI; no dependency on Vega bind for consumer UX.
- `npm test` passes, including new search checks.
- `README.md` documents setup and limitations.
