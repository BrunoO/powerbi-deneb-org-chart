# AGENTS.md

Guidance for coding agents working in this repository.

## Source of Truth & File Roles

- [`deneb-org-chart.json`](./deneb-org-chart.json): Primary Vega 5 specification pasted into Power BI's **Deneb** custom visual. Edit this file first.
- [`preview.html`](./preview.html): Standalone browser preview embedding the spec in `const spec = {...};`. **Never hand-edit the embedded spec**—run `npm run sync-preview` (`node tools/sync-preview.js`) after editing `deneb-org-chart.json`.
- [`sample-org-data.csv`](./sample-org-data.csv): CSV mirror (`ID,ParentID,Name,Title`) of the 85-employee built-in `dataset` in `deneb-org-chart.json`. Keep both in sync when updating sample data.
- [`tools/verify-layout.js`](./tools/verify-layout.js): Headless Vega layout & invariant test suite (`npm test`).
- [`docs/SPEC_MAP.md`](./docs/SPEC_MAP.md): Spec map and dev checklist — read before changing signals, data pipeline, layout, interaction, or marks.
- [`README.md`](./README.md) & `images/`: Documentation and 2× Chrome-rendered showcase screenshots (`org-chart-overview.png`, `org-chart-hover-lineage.png`, `org-chart-stacked-mode.png`).

## Architecture & Layout Invariants

- **Separate layout parenting from link parenting**:
  - `tree_nodes` computes `layoutParentId` (`lag2Id`) only to arrange 2-column stacks in `stratify` → `tree`.
  - `tree_links` must **not** use Vega's `treelinks` transform (which follows `layoutParentId` and draws false peer-to-peer chains). Instead, `tree_links` looks up the real manager in `tree_nodes` by `parentId`, so connectors and hover lineage always match the true reporting hierarchy.
- **Leaf-only stacking & deterministic ordering**:
  - Only stack teams where `siblingManagerCount === 0`, `parentReportCount > gridThreshold`, and `rawDepth >= stackMinDepth`. Mixed teams (managers + individual contributors) must stay on a horizontal bus so peers never share a row with a colleague's reports.
  - Sort by numeric-aware `sortKey` (`pad(datum.id, 15, '0', 'left')` for numeric IDs) in both the `window` transform (`groupby: ["parentId", "isStacked"]`) and a `collect` transform before `stratify`.
- **Decoupled branch focus and branch-fit zoom**:
  - Single-click `@cardBody:click` sets `focusedId` and `focusedAncPath` (`activeHighlightId`), locking the active lineage highlight onto the branch with a 3px focus ring without shifting the view.
  - Double-click `@cardBody:dblclick` (guarded by 4px drag-slop) fits the clicked subtree via per-row `branchFitZ` and ratio-scaled centering. Because single-click does not move the card, the second click of a double-click lands on the exact same card rather than striking empty canvas and misfiring a canvas reset.
  - Empty canvas clicks (`@canvasBg:click`) clear focus; double-clicking canvas (`@canvasBg:dblclick`) resets zoom to 100% and pan to 0.
- **Tooltip enrichment & confidential ID gating**:
  - `cardBody.tooltip` looks up `managerName` from `clean_data` by `parentId` (omitted for the CEO/root) and includes non-empty `Extra 1 / 2 / 3` metadata, providing full un-truncated details on hover while keeping card layouts clean.
  - Employee `ID` in tooltip remains strictly gated behind the `showIdInTooltip` signal (default `false`) for confidentiality.
- **Filter button & anchor clearance**:
  - `filterBtn` has a solid floating background pill (`filterPillShadow`, `filterPillBg`) and hides with `opacity: 0` when `length(data('extra_filter_values')) === 0`.
  - Clicking `filterBtn` / `filterText` clears `anchorId` to prevent old toggle pinning offsets from shifting filtered layouts.
- **Focus pinning on toggle**:
  - `@toggleBtn/click` stores `anchorId/anchorX/anchorY/anchorZoom` (node id + screen pos + zoom); `cardX/cardY` add a rigid compensating shift (`anchor − anchorBase − pan`) while zoom matches, so the clicked node never moves on expand/collapse.
  - Presses (`@canvasBg/@cardBody/@toggleBtn:mousedown`, `touchstart`) fold the shift into `panX/panY` *before* clearing `anchorId`, so the press itself is pixel-identical — never clear-then-re-arm across separate pulses. Fit, zoom reset, double-click canvas reset, and Collapse All clear `anchorId` outright (they set pan absolutely).

## Domain Ontology (Canonical Terms)

Use these terms consistently; do not conflate them.

| Term | Meaning |
|---|---|
| **Real parent / manager** | `parentId` reporting relationship. Drives `tree_links`, tooltips, lineage, and semantics. |
| **Layout parent** | `layoutParentId` (`lag2Id` for stacked rows). Used only for `stratify/tree` placement; never for reporting links. |
| **Lineage / ancestors / descendants** | Reporting chain along `parentId` (`ancPath`, `descendant_counts`), not layout adjacency. |
| **Active highlight** | Unified highlight target (`activeHighlightId`/`activeHighlightAncPath`) from hover or locked focus. |
| **Focused node** | Card selected by single click; locks active lineage until cleared. |
| **Branch fit** | Double-click action that zooms/centers clicked subtree; uses `card_nodes.branchFitZ`. |
| **Branch leader** | Level-1 division owner (`branchLeaderId`) used for color/domain stability. |
| **Stacked team** | Leaf-only team with `parentReportCount > gridThreshold`, `rawDepth >= stackMinDepth`, and `siblingManagerCount === 0`, laid out in 2 columns. |
| **Visible node** | Node not removed by collapse/filter logic in `tree_nodes`. |
| **Filtered out** | Hidden by Extra 2 filter unless match or ancestor of a match. |
| **Anchor pinning** | Toggle-time compensation so clicked node stays at same screen position across re-layout. |

## Power BI Deneb Constraints (Do Not Regress)

- **Do not use `denebContainer` or `containerSize()` in canvas size signals**: Referencing `denebContainer` or `containerSize()` in `minCanvasWidth` / `minCanvasHeight` / `width` / `height` crashes Deneb's React editor in Power BI (`"an error occurred in the editor"`).
- **Keep canvas dimensions fixed (`1400 × 550`)**: `width` and `height` stay fixed at `minCanvasWidth` (`1400`) and `minCanvasHeight` (`550`) so the top toolbar (`toolbarOriginX`) remains centered during expand, zoom, and pan. Center `originX` (`((width - (datum.maxX - datum.minX + cardWidth)) / 2) - datum.minX`, without `max(40, ...)`) so the CEO starts centered under the toolbar.
- **Guard `extent` signals against empty datasets**: Deneb may initialize the Vega view with `dataset = []` before Power BI data arrives. Vega's `extent` transform returns `[undefined, undefined]` (truthy!) on empty data; any expression reading `treeExtentX` / `treeExtentY` must check `isFinite(...)` to avoid `NaN`.

## Verification & Release Checklist

1. Edit `deneb-org-chart.json`.
2. Bump version metadata when releasing a change: `description`, `signals[versionId].value`, `usermeta.version`, `usermeta.releaseDate` in `deneb-org-chart.json`, and the version reference in `README.md`.
3. Run:
   ```bash
   npm run sync-preview
   npm test
   ```
   `npm test` verifies Standard and Stacked modes (collapsed, expanded, and multiple zoom levels) for: real-manager links, zero card/segment overlaps, zero card crossings, 2-column stacking rules, hover lineage highlighting, and `preview.html` sync.
