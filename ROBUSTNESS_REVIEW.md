# Robustness review — Power BI / Deneb org chart

**Date:** 2026-11-23  
**Scope:** `deneb-org-chart.json`, `tools/verify-layout.js`, `tools/sync-preview.js`, docs, and sample data.  
**Status:** Review only — no production code was changed. Baseline `npm test` passes and `preview.html` is in sync.

## Summary

The shipped tests only exercise well-formed sample data. Several realistic Power BI inputs either abort the visual with a raw Vega error or silently produce wrong interaction state. The highest-value work is upstream of `stratify` (normalize and validate IDs/ParentIDs), followed by the touch interaction signals and the verifier's vacuous-pass problem.

## Critical — fix before trusting arbitrary report data

| # | Where | Trigger | What happens | Suggested fix |
|---|---|---|---|---|
| 1 | `deneb-org-chart.json:870-881`, `:943-951`, `:1214-1217` | Orphan `ParentID`, multiple blank parents, a cycle, or a duplicated ID used as a parent | `stratify` throws raw Vega errors: `missing: 999`, `multiple roots`, `cycle`, `ambiguous: 2`. The visual aborts. | Add a sanitization stage before both `stratify` calls: normalize IDs, drop rows whose `parentId` is not in the ID set, deduplicate IDs, keep exactly one root. Cycles generally still need an upstream data-quality gate, but the common Power BI cases can be prevented. |
| 2 | `:880` | Employee ID `0` with children, or IDs like `01` / `1.0` / `' 1 '` | `ParentID 0`/`'0'` is hard-coded to “no manager”, so children of employee `0` become extra roots → crash. Loose `!=` and verbatim stringification also mis-match mixed-type IDs. | Treat only blank/null/whitespace as “no manager”. Use trimmed, strict string comparisons and canonicalize numeric-looking strings. |
| 3 | `:56-72`, `:163-168` | Two-finger pinch | **Pinch zoom is a no-op.** `pinchDist1` has an `on signal pinchDist2` handler that copies `pinchDist2` before `zoomLevel` computes the ratio, so `pinchDist2 / pinchDist1` is always `1`. Confirmed with a headless signal probe. | Remove the handler at `:66-71`; keep `pinchDist1` captured on `touchstart` and reset both distance signals on `touchend`. Pinch would then zoom around layout center, not finger midpoint — a separate UX improvement. |
| 4 | `:98-104`, `:125-131`, `:41-53` | One-finger touch pan | Every `touchmove` adds `current − touchstart`, so movement is re-applied across the whole gesture: moves of 10, 20, 30 px produce `panX += 60` instead of `30`. Vega’s `x()` is the current touch point. | Use a rolling previous-touch signal declared after `panX`/`panY`, or store a gesture-start pan offset and compute an absolute value. Don’t reuse `downXY`; it is needed for click detection. |
| 5 | `:3010-3022`, `:3075-3087`; event selectors `:106`, `:133`, `:156-162` | Clicking/wheeling the bottom strip of a leaf card | `toggleBtn`/`toggleText` are hidden only with `opacity: 0`; Vega still hit-tests them. Leaf toggles mutate collapse state, and wheel/double-click over them does not zoom/reset because handlers only cover `canvasBg`/`cardBody`. | Gate toggle updates with `datum.reportCount > 0`, or make leaf toggles non-interactive/undrawn. Add toggle mark names to wheel and reset selectors. |

## High — silent wrong behavior or weak verification

| # | Where | Issue | Fix |
|---|---|---|---|
| 6 | `:870-881`, `:1046-1074`, `:1214-1217` | Duplicate IDs are not always caught. Two leaf rows with ID `2` render two cards sharing one hover/toggle ID and inflated counts; if a child references `2`, stratify throws `ambiguous: 2`. | Deduplicate by normalized ID with a `window`+`row_number` and keep the first row deterministically. |
| 7 | `:235-270`, `:978-981`, and every `indexof(..., ',' + id + ',')` check, e.g. `:2261`, `:2355`, `:2417`, `:2453` | Comma-delimited `expandedIds`, `collapsedIds`, and `ancPath` are ambiguous for text IDs containing commas. Confirmed: IDs `2` and `1,2` can both be expanded by the same state string, and `replace()` can corrupt state. Hover lineage can false-positive. | Store ID sets as arrays with `indexof(array, id)`, or reject commas in IDs at ingest. Use a delimiter that cannot occur in IDs for `ancPath`. |
| 8 | `:41-53`, `:238-242`, `:257-261` | `touchend` sets `downXY = null`, so the click/drag guard is skipped for touch taps. A mouse drag that returns to its origin within 4 px also toggles because no “did pan” flag exists. | Don’t clear `downXY` on `touchend`; clear it on a later click. Track a `didPan` flag set by drag handlers and require `!didPan` in toggle updates. |
| 9 | `tools/verify-layout.js:33-54`, `:86-104`, `:216-241` | **Verifier passes vacuously.** A header-only CSV, lowercase headers, or a row missing `Title` all produce `0 cards` and “All layout checks passed.” Since `README.md:113` recommends running this on your own export, a bad export gets a green result. | Assert `nodes.length >= 2`, `links.length === nodes.length - 1`, exactly one root, non-empty link geometry, and `stackedTeams > 0` for stacked sample scenarios. Validate required CSV headers and row widths. |
| 10 | `:1148` | “Numeric-aware” `sortKey` is lexical padding: `-1` sorts before `-2`, `10` before `1.5` and `1e3`, 16-digit numbers before 15-digit numbers, and `1`/`01` collide. | Restrict the numeric branch to non-negative integers up to 15 digits, or add a numeric sort field for `collect`. |

## Lower priority / cleanup

- **Tooltip/status:** `:1077`, `:1394-1400`, `:2449` mark leaf nodes as `Collapsed` with a hidden `+0` label. Gate status on `reportCount > 0`.
- **Unvalidated config:** `:15-18` — `defaultCollapseDepth = NaN` silently expands everything; negative/0 values are undocumented. Derive a clamped effective depth.
- **Dead/misleading code:** `treeExtentX/Y` at `:1238-1246` are written but never read; `:1429` has an unreachable `: ''` branch; `isSelfCollapsed` (`:1077`) and `isCollapsed` (`:1394`) duplicate the same expression; the link path formula is duplicated in data (`:1429`) and mark (`:2257`), so they can drift.
- **Zoom-scale visual issues:** badge heights stay 11 px while badge fonts scale up to 13 px at 1.6× (`:2526-2528`, `:2601-2603`, `:2650-2652`, `:2717-2719`); toggle stays 28×14 inside a 23 px card at 0.4× (`:2947-2952`, `:3049-3051`).
- **Hover flicker:** moving onto a toggle fires `cardBody:mouseout`, clearing `hoveredId` (`:277-299`, overlays at `:2934+`). Add toggle names to hover handlers.
- **Reset label:** `'Reset (55%)'` at `:2004-2006` reads like “reset to 55%”; use `Reset 100%`.
- **Title wrap fallback:** `:895-916` can produce a line longer than 20 characters when no early space exists.
- **Docs/tooling:** `README.md:45` says the preview works offline, but `preview.html:7-8` loads Vega from a CDN. `verify-layout.js:88-89` sets a 4000×2400 canvas that the spec’s `width`/`height` signals immediately override. `checkPreview` is skipped when an external CSV is supplied. Preview block matching (`verify-layout.js:206-213`, `sync-preview.js:10-13`) breaks under harmless reindentation. Scenario matrix omits documented zoom limits `0.4`/`1.6` and `defaultCollapseDepth = 2` — those cases currently pass, so they are regression-test gaps rather than live bugs.

## Verified non-issues

- Wheel cursor anchoring (`panX`/`panY` vs `zoomLevel` ordering) is correct.
- `report_counts` / `parentReportCount` lookup directions are correct.
- `treeAncestors` ordering, depth math, and branch color derivation are consistent.
- Collapse-state math is internally consistent for valid string IDs.
- The fixed 1400×550 canvas behavior matches the repository constraints.
- Sample-data layout invariants, version metadata, and CSV quoted-field/CRLF/BOM handling are sound.

## Suggested next step

Implement the five critical fixes plus regression scenarios in `tools/verify-layout.js`, then bump the version metadata as required by `AGENTS.md`.
