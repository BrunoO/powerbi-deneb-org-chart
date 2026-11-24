# Spec Map & Dev Checklist

Quick reference for navigating and safely changing `deneb-org-chart.json` (Vega 5, Deneb/Power BI).

## Source-of-truth files

| File | Role | Rule |
|---|---|---|
| `deneb-org-chart.json` | Primary Vega spec | Edit first. |
| `preview.html` | Standalone browser preview | **Never hand-edit** embedded spec; run `npm run sync-preview`. |
| `sample-org-data.csv` | CSV mirror of built-in sample dataset | Keep in sync when sample data changes. |
| `tools/verify-layout.js` | Headless layout/invariant tests | Run `npm test` before committing spec changes. |
| `README.md`, `images/` | User docs/screenshots | Update when behavior/UI changes. |

## Top-level spec structure

- **`signals`**: config, interaction state, layout constants, styling constants.
- **`data`**: sanitization, lineage, layout, filtering, and derived render datasets.
- **`scales`**: branch color palette.
- **`marks`**: canvas/background, bands, toolbar, links, cards, badges, labels, toggles.

## Signals (key groups)

### Config / metadata
- `versionId`, `defaultCollapseDepth`, `enableStacking`, `gridThreshold`, `stackMinDepth`, `showIdInTooltip`.
- Style constants: `activeColor`, `dimOpacity`, `fontUi`, `fontEmoji`.

### Pointer / gesture state
- `downXY`, `didPan`, `panStartX`, `panStartY`, `pinchStartZoom`, `pinchDist1`, `pinchDist2`.
- `panX`, `panY`, `zoomLevel`, `fitZoom`.

### Layout / sizing
- `cardWidth`, `cardHeight`, `nodeSpacingX`, `nodeSpacingY`, `topMargin`, `minCanvasWidth`, `minCanvasHeight`, `width`, `height`, `toolbarOriginX`.

### Filtering / expand-collapse / focus
- `extraFilterIdx`, `extraFilterValue`.
- `expandAllOverride`, `expandedIds`, `collapsedIds`.
- `hoveredId`, `hoveredAncPath`, `focusedAncPath`, `focusedId`.
- Derived active highlight: `activeHighlightId`, `activeHighlightAncPath`.
- Toolbar hover: `hoveredToolbarBtn`, `hoveredToggleId`.
- Toggle pinning: `anchorId`, `anchorZoom`, `anchorX`, `anchorY`.

## Data pipeline (major datasets)

| Dataset | Purpose | Key dependency notes |
|---|---|---|
| `dataset` | Raw input rows (Power BI/embedded sample). | Expected fields: `ID`, `ParentID`, `Name`, `Title`, optional `Extra 1-3`. |
| `clean_data` | Trim IDs/names, dedupe IDs, normalize extra fields. | First row per ID wins. |
| `sanitized_parents` / `primary_root` / `fallback_root` / `sanitized_data` | Handle orphans, multiple roots, pure cycles. | Fallback root election prevents pure-cycle crash. |
| `extra_stats` / `extra_filter_values` | Max extra lines and Extra 2 filter values. | Drives `cardHeight` and filter UI visibility. |
| `report_counts` / `full_tree` / `lineage_base` | Reporting counts, stratified tree, ancestors/descendants. | `lineage_base` is full-data; keeps branch colors stable. |
| `descendant_counts` / `org_summary` / `data_with_lineage` | Totals and lineage-enriched rows. | Summary pill uses org totals. |
| `collapsed_nodes` / `collapsed_descendants` | Collapse state expansion. | Uses unit separator (`\u001F`) for comma-safe IDs. |
| `filter_matches` / `filter_ancestors` | Extra 2 filter visibility set. | Keeps matches + management chain. |
| `tree_nodes` | Main visible layout/model dataset. | Computes layout, card coords, badges, labels, toggle, and highlight booleans. |
| `depth_bands` | Alternating row bands. | Pan-aware, non-interactive. |
| `subtree_members` / `subtree_boxes` | Subtree bounds for branch-fit zoom. | Used by `card_nodes`. |
| `card_nodes` | `tree_nodes` + subtree box lookup. | **Exists only for card click branch-fit**; avoids feedback cycle with `tree_nodes`. |
| `tree_links` | Real manager -> report connectors. | **Must not use `treelinks`**; looks up real manager by `parentId` to avoid false peer chains. |

## Layout / interaction invariants

- **Real-manager links:** `tree_links` follows `parentId`, not `layoutParentId`.
- **Leaf-only stacking:** stack only when `siblingManagerCount === 0`, `parentReportCount > gridThreshold`, `rawDepth >= stackMinDepth`, and stacking enabled.
- **Deterministic order:** numeric-aware `sortKey`; used in window/collect before stratify.
- **Branch focus vs. branch fit:**
  - Single click (`@cardBody:click`): sets focus/active lineage, no pan/zoom shift.
  - Double click (`@cardBody:dblclick`): branch-fit zoom/center via `card_nodes.branchFitZ`.
  - Canvas click clears focus; canvas dblclick resets view.
- **Anchor pinning:** toggle clicks capture anchor and compensate layout shift; presses fold anchor into pan before clear.
- **Filter button:** solid pill background; hidden when no Extra 2 values; clears `anchorId` on click.
- **Highlight booleans:** `isActiveNode`, `isFocusedNode`, `isInActiveLineage`, `isDimmedByActive` are precomputed in `tree_nodes`; prefer them over repeating lineage expressions.

## Marks (render order / responsibility)

| Mark(s) | Responsibility |
|---|---|
| `canvasBg` | Background, pan/zoom/reset interactions. |
| `levelBand` | Alternating depth bands. |
| `gestureHint` | Non-interactive usage hint. |
| `toolbar*` | Toolbar chrome, buttons, labels, filter pill, summary/version. |
| `emptyNoticeText` | Empty-dataset message. |
| `treeLinkCasing`, `treeLinkPath` | Link casing and visible connectors. |
| `cardShadow`, `cardBody`, `cardLeftAccent` | Card chrome and interaction target. |
| `levelBadge*`, `descendantBadge*` | Level and total descendant badges. |
| `employeeName`, `employeeTitle*`, `extraText1-3` | Card text. |
| `toggleBtn`, `toggleText` | Expand/collapse control. |
| `linkAnchorDot` | Connector anchor dot. |

## Dev checklist

### Before changing
- [ ] Read relevant section of this map and `AGENTS.md`.
- [ ] Identify whether change affects layout, interaction, data sanitization, or styling.
- [ ] Check for existing invariants/tests in `tools/verify-layout.js`.

### Spec change
- [ ] Edit `deneb-org-chart.json` first.
- [ ] Keep `tree_links` based on real `parentId`, not layout parent.
- [ ] Preserve comma-safe ID handling (`\u001F` separators).
- [ ] Preserve confidential ID default (`showIdInTooltip` false).
- [ ] If adding highlight behavior, reuse `tree_nodes` highlight booleans where possible.

### Release/version bump (when releasing)
- [ ] Bump `description` version.
- [ ] Bump `signals[versionId].value`.
- [ ] Bump `usermeta.version` and `usermeta.releaseDate`.
- [ ] Update README version reference.
- [ ] `npm test` includes a version-metadata consistency check.

### Validate
- [ ] `npm run sync-preview`
- [ ] `npm test`
- [ ] For UI-visible changes, update screenshots/README/docs as needed.
- [ ] For behavior changes, add/adjust checks in `tools/verify-layout.js`.

### Commit hygiene
- [ ] Commit focused changes separately (spec/refactor/docs/tests as appropriate).
- [ ] Do not hand-edit `preview.html` embedded spec.
- [ ] Avoid unrelated file changes.