# Robustness review — Power BI / Deneb org chart

**Date:** 2026-11-23  
**Original Scope:** `deneb-org-chart.json`, `tools/verify-layout.js`, `tools/sync-preview.js`, docs, and sample data.  
**Status:** **Updated after `v1.8.3`.** All 5 critical items, `#6`, `#8`, `#9`, and several cleanup items are resolved and verified via `npm test`. Items `#7`, badge/toggle zoom scaling, and the `isCollapsed` duplication were fixed in `v1.7.2`; the no-root cycle fallback was fixed in `v1.7.3`. The branch palette, empty-dataset notice, and touch-mode documentation were addressed in `v1.7.4`. Double-click-to-center, zoom-to-fit, and level banding landed in `v1.7.5`. The Fit pill background fix, band centering, and the opt-in tooltip ID landed in `v1.7.6`. Optional `Extra 1-3` card lines with uniform auto-height landed in `v1.7.7`. Double-click centering was scoped to card body in `v1.7.8`. Toggle focus pinning landed in `v1.7.9`. Remaining open items are low/conditional priority.

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

## Resolved in `v1.7.2`

| # | Where | Resolution |
|---|---|---|
| 7 | `expandedIds`, `collapsedIds`, `ancPath` | State strings now use the unit separator (`U+001F`) instead of commas, so text IDs containing `,` no longer cause false expand/collapse/hover matches. Verified with comma-ID probes. |
| Cleanup | `deneb-org-chart.json` (`branchColor`) | Scale domain now reads `branchLeaderId` from `lineage_base` (full data) instead of visible `tree_nodes`, so collapsing or filtering a branch can no longer recolor the rest. |
| Cleanup | `deneb-org-chart.json` (scales) | Removed unused `levelColor` / `levelBg` scales. |
| Cleanup | `deneb-org-chart.json` (badges/toggles) | Toggle pill, toggle label, level/descendant badges, and their offsets now scale with `zoomLevel` (with readability minimums); summary pill widened `150` → `190` with recentered toolbar. |
| Cleanup | `deneb-org-chart.json` (`tree_nodes`) | `isCollapsed` is now a direct alias of `isSelfCollapsed` instead of a duplicated expression, so the two cannot drift apart. |

## Resolved in `v1.7.3`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (`fallback_root`, `sanitized_data`) | Pure-cycle datasets (every row has a valid `ParentID`, e.g. `A↔B`, so `primary_root` is empty) no longer throw `no root`: `fallback_root` elects the smallest-keyed node and `sanitized_data` nulls only its parent link. Verified with 2-cycle / 3-cycle verifier scenarios. |
| Cleanup | `tools/verify-layout.js` | Added built-in pure 2-cycle / 3-cycle scenarios (expanded + hover) to `npm test`. |

## Resolved in `v1.7.4`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (`branchColor`) | Palette extended from 12 to 20 colors (existing assignments preserved by appending) so the sample's 13 divisions no longer collide; the verifier now fails if divisions ever exceed the palette size. |
| New | `deneb-org-chart.json` (`emptyNoticeText`) | An empty dataset now shows a centered "No data to display — map ID, ParentID, Name and Title in Deneb" notice instead of a silent blank canvas. |
| Docs | `README.md` | Touch limitations documented: no reporting-line highlight on touch, gestures are provisional and untested by the author. |

## Resolved in `v1.7.5`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (signals) | Double-clicking a card body recenters it in view (`pan + viewport/2 − node center`); background double-click still resets. Zoom is preserved. Scoped to card body only: toggle re-layouts between a double-click's two clicks (measured ~1000px shifts), mistargeting the second click — verified by probe, guarded in the verifier. |
| New | `deneb-org-chart.json` (`fitZoom`, toolbar) | New Fit button zooms the whole tree into view (scalar `fitZoom` from live extents, clamped to zoom bounds) and centers via `panX = 0` + top-anchored `panY`; min/max Y extents added to the existing `joinaggregate`. |
| New | `deneb-org-chart.json` (`depth_bands`, `levelBand`) | One full-width band rect per distinct `rawY` (alternating wash, `panY`-aware in encode so no re-layout, `interactive: false` so canvas gestures pass through). |
| Cleanup | `tools/verify-layout.js` | New `fit` check (`fitZoom` finite and within bounds) and `bands` check (one band per distinct depth) in every scenario. |

## Resolved in `v1.7.6`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (toolbar) | Fit button moved inside the white toolbar pill (background widened 447 → 489) so it stays visible on any report background. |
| Cleanup | `deneb-org-chart.json` (`levelBand`) | Bands shifted up by half the row/card slack so cards sit vertically centered in their band. |
| New | `deneb-org-chart.json` (`showIdInTooltip`, tooltip) | Employee ID removed from the default tooltip (confidential); opt back in with `"showIdInTooltip": true`. Verifier asserts the gate and the `false` default. |

## Resolved in `v1.7.7`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (`Extra 1-3`, `extra_stats`, `maxExtraLines`) | Optional extra card lines from columns literally named `Extra 1/2/3` (blank when unmapped). Global uniform height (`58`, or `67+12·maxExtra`) via `cardHeight`; `nodeSpacingY` tracks it so pitch never overlaps. Text Y switched to absolute scaled offsets (identical output when unused). Verifier gains an extras scenario plus a `cardHeight` regression guard. |

## Resolved in `v1.7.8`

| # | Where | Resolution |
|---|---|---|
| Fix | `deneb-org-chart.json` (signals) + `tools/verify-layout.js` | Double-click centering scoped to `@cardBody:dblclick` only. Probe proved toggle re-layout shifts sibling toggles ~1000px between a double-click's clicks, mistargeting click 2 and the dblclick; new `checkDblclick` guard fails if centering ever listens to toggle marks again. |

## Resolved in `v1.7.9`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (`anchorId/anchorZoom/anchorX/anchorY`, `cardX/cardY`) | Toggle expand/collapse now pins the clicked node: anchor (id + screen pos + zoom) captured on toggle click, `cardX/cardY` add a rigid compensating shift (`anchor − anchorBase − pan`) while zoom matches. Presses fold the shift into pan before clearing (no jump); drag, Fit, reset, center, collapse-all clear it. New `checkAnchor` verifier test toggles node 2 both ways and requires 0px drift. |

## Resolved in `v1.7.10`

| # | Where | Resolution |
|---|---|---|
| Fix | `deneb-org-chart.json` (press handlers) + `tools/verify-layout.js` | Clearing the anchor on `mousedown` jumped the view mid-gesture because the shift vanished a pulse before the click re-armed it (visible on collapse-after-expand). Presses now fold the shift into `panX/panY` atomically before clearing, so the press itself is pixel-identical; `checkAnchor` covers the full press-then-toggle sequence. |

## Resolved in `v1.7.11`

| # | Where | Resolution |
|---|---|---|
| Change | `deneb-org-chart.json` (`enableStacking`) | Stacked mode is now the default (`true`); Standard tree is one toolbar toggle away. InitialCollapsed view is unchanged (CEO + L1 never stack), stacking appears as branches expand. README settings table and Step 5 recipe updated. |

## Resolved in `v1.7.12`

| # | Where | Resolution |
|---|---|---|
| Fix | `deneb-org-chart.json` (card/body/badge tints) | L1 divisions were indistinguishable: card wash `0.97` / badge `0.93` are near-white for any hue. Deepened to card `0.93`, badge `0.88`, stroke `0.82` → `0.78` — pastel kept, divisions tellable apart. |

## Resolved in `v1.7.13`

| # | Where | Resolution |
|---|---|---|
| Fix | `deneb-org-chart.json` (`treeLinkCasing`, `treeLinkPath`) | Links were unreadable on level bands (`#CBD5E1` on `#F1F5F9`). Core darkened to `#94A3B8` at 2px with a 4.5px white casing underneath (same dimming logic), so connectors separate from any background. |

## Resolved in `v1.8.0`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (`subtree_members`, `subtree_boxes`, `card_nodes`, click handlers) | Click-to-focus branch zoom: clicking a card fits its whole visible branch, centered, via per-row `branchFitZ` and ratio-scaled centering. Subtree bounds can't feed back into `tree_nodes` (sources must precede use), so `card_nodes` (source `tree_nodes` + box lookup) exists solely as `cardBody`'s datum; every other mark stays on `tree_nodes`. New `checkBranchFit` verifier test (unclamped fixture, all cards in view, bbox centered). |

## Resolved in `v1.8.1`

| # | Where | Resolution |
|---|---|---|
| New | `deneb-org-chart.json` (`gestureHint`) | Persistent eyebrow caption just above the toolbar documenting click / double-click / drag / scroll gestures (non-interactive, paints under cards). New `checkCaption` verifier guard. |

## Resolved in `v1.8.2`

| # | Where | Resolution |
|---|---|---|
| Docs | `deneb-org-chart.json` (`description`, `usermeta.repository`) | GitHub source URL embedded in the spec itself (description + `usermeta.repository`), so anyone holding only the pasted JSON can trace it back. Canvas text is not clickable in Deneb, so no in-visual link was added. |

## Resolved in `v1.8.3`

| # | Where | Resolution |
|---|---|---|
| Polish | `deneb-org-chart.json` (`gestureHint`, toolbar) | Caption settled as an eyebrow above the toolbar: centered on the button pill, slate `#64748B` with `ⓘ` prefix; toolbar shifted down 4px for breathing room. |

## Remaining Open Items (Low / Conditional Priority)

| # | Where | Issue | Notes / Assessment |
|---|---|---|---|
| 2 | `deneb-org-chart.json` (`clean_data`) | `ParentID` `0` / `'0'` is treated as "no manager" | **Intentional Power BI trade-off:** many Power BI parent-child tables use `0` as the root sentinel. Changing this blindly would break existing reports; if needed, gate behind a config signal. |
| 10 | `sortKey` in `tree_nodes` | Lexical 15-digit zero-padding only handles non-negative integers up to 15 digits cleanly | Restricting the numeric branch to `/^[0-9]{1,15}$/` or adding a numeric sort field would cover negatives/decimals/16+ digits. |
| New | `deneb-org-chart.json` (`full_tree`) | A cycle in a *detached* component alongside a valid root (e.g. CEO + `A↔B`) still throws in `stratify` | Needs option 3 (bounded ancestor-walk breaker) or upstream repair; the pure-cycle (no-root) case is fixed in `v1.7.3`. |
| Cleanup | `deneb-org-chart.json` | Title-wrap fallback when no early space exists | Minor visual polish; long single-token titles truncate via `limit`. |
| Cleanup | `preview.html` / `tools/` | `verify-layout.js` skips `checkPreview` when given an external CSV; `sync-preview.js` matches `const spec = ` / `\n};` | Minor tooling polish. |
