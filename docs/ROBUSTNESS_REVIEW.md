# Robustness review — Power BI / Deneb org chart

**Date:** 2026-11-23  
**Original Scope:** `deneb-org-chart.json`, `tools/verify-layout.js`, `tools/sync-preview.js`, docs, and sample data.  
**Status:** **Updated after `v1.7.1` (`0eff0b3`).** All 5 critical items, `#6`, `#8`, `#9`, and several cleanup items are resolved and verified via `npm test`. Remaining open items are low/conditional priority.

## Summary

The initial review identified gaps around dirty Power BI inputs (`stratify` aborts on orphans, duplicates, and multiple roots), touch pan/pinch signals, invisible leaf toggle hit-testing, and vacuous verifier passes. In `v1.7.1`, the high-relevance and touch fixes were implemented and verified; the remaining items below are lower-priority or intentional trade-offs.

## Resolved in `v1.7.1` (`0eff0b3`)

| # | Original Issue | Resolution |
|---|---|---|
| 1 & 6 | Orphan `ParentID`, multiple blank parents, or duplicate IDs crashing `stratify` | Added `clean_data` trimming + `window` (`row_number === 1`) deduplication, `sanitized_parents`, `primary_root`, and `sanitized_data` before `full_tree` (`stratify`). Verified with orphan, multi-root, duplicate-ID, sliced-CEO, and empty-dataset probes. |
| 3 | Two-finger pinch zoom was a no-op (`pinchDist1` copied `pinchDist2` before `zoomLevel` evaluated) | Added `pinchStartZoom`, captured `pinchDist1` on 2-finger `touchstart`, and reset `pinchDist1`/`pinchDist2` on `touchend`. |
| 4 | One-finger touch pan compounded `current - touchstart` on every `touchmove` | Added `panStartX`/`panStartY` captured on `mousedown, touchstart` and computed absolute `panStart + (x() - downXY)` on 1-finger `touchmove`. |
| 5 | Invisible leaf `toggleBtn`/`toggleText` still hit-tested for clicks and blocked wheel/dblclick | Gated toggle updates on `datum.reportCount > 0`; added `toggleBtn`/`toggleText` to `wheel!`, `dblclick`, and hover (`hoveredId`/`hoveredAncPath`) handlers to also fix hover flicker. |
| 8 | `touchend` cleared `downXY`, skipping click-vs-drag guard; round-trip drags toggled | Stopped clearing `downXY` on `touchend` and added a `didPan` flag required to be `false` on toggle clicks. |
| 9 | `tools/verify-layout.js` passed vacuously on empty/malformed CSVs | Added required header validation (`ID`, `ParentID`, `Name`, `Title`), sanity assertions (`nodes >= 2`, `links === nodes - 1`, `roots === 1`, non-empty path geometry, `stackedTeams > 0`), and `0.40`/`1.60` zoom boundary coverage. |
| Cleanup | Unused `treeExtentX`/`treeExtentY`, duplicated `treeLinkPath` formula, leaf tooltip `Status: Collapsed` | Removed unused `extent` transforms, pointed `treeLinkPath` at `{ "field": "path" }`, and updated leaf tooltip status to `Leaf`. |

## Remaining Open Items (Low / Conditional Priority)

| # | Where | Issue | Notes / Assessment |
|---|---|---|---|
| 2 | `deneb-org-chart.json` (`clean_data`) | `ParentID` `0` / `'0'` is treated as "no manager" | **Intentional Power BI trade-off:** many Power BI parent-child tables use `0` as the root sentinel. Changing this blindly would break existing reports; if needed, gate behind a config signal. |
| 7 | `expandedIds`, `collapsedIds`, `ancPath` | Comma-delimited strings are ambiguous if text IDs contain `,` | Low risk for typical employee IDs; could switch to array-based state / `indexof` or a rarer delimiter if comma-containing IDs are expected. |
| 10 | `sortKey` in `tree_nodes` | Lexical 15-digit zero-padding only handles non-negative integers up to 15 digits cleanly | Restricting the numeric branch to `/^[0-9]{1,15}$/` or adding a numeric sort field would cover negatives/decimals/16+ digits. |
| Cleanup | `deneb-org-chart.json` | `isSelfCollapsed` (`data_with_lineage`) and `isCollapsed` (`tree_nodes`) duplicate the same expression | Minor cleanup; kept readable. |
| Cleanup | `deneb-org-chart.json` | Badge/toggle sizing at extreme zoom (`0.4×` / `1.6×`) and title-wrap fallback when no early space exists | Minor visual polish. |
| Cleanup | `README.md` / `preview.html` / `tools/` | `README.md` mentions "offline" though `preview.html` loads Vega from CDN; `verify-layout.js` skips `checkPreview` when given an external CSV; `sync-preview.js` matches `const spec = ` / `\n};` | Minor docs/tooling polish. |
