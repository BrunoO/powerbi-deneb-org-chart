# AGENTS.md

Guidance for coding agents working in this repository.

## Source of Truth & File Roles

- [`deneb-org-chart.json`](./deneb-org-chart.json): Primary Vega 5 specification pasted into Power BI's **Deneb** custom visual. Edit this file first.
- [`preview.html`](./preview.html): Standalone browser preview embedding the spec in `const spec = {...};`. **Never hand-edit the embedded spec**—run `npm run sync-preview` (`node tools/sync-preview.js`) after editing `deneb-org-chart.json`.
- [`sample-org-data.csv`](./sample-org-data.csv): CSV mirror (`ID,ParentID,Name,Title`) of the 85-employee built-in `dataset` in `deneb-org-chart.json`. Keep both in sync when updating sample data.
- [`tools/verify-layout.js`](./tools/verify-layout.js): Headless Vega layout & invariant test suite (`npm test`).
- [`README.md`](./README.md) & `images/`: Documentation and 2× Chrome-rendered showcase screenshots (`org-chart-overview.png`, `org-chart-hover-lineage.png`, `org-chart-stacked-mode.png`).

## Architecture & Layout Invariants

- **Separate layout parenting from link parenting**:
  - `tree_nodes` computes `layoutParentId` (`lag2Id`) only to arrange 2-column stacks in `stratify` → `tree`.
  - `tree_links` must **not** use Vega's `treelinks` transform (which follows `layoutParentId` and draws false peer-to-peer chains). Instead, `tree_links` looks up the real manager in `tree_nodes` by `parentId`, so connectors and hover lineage always match the true reporting hierarchy.
- **Leaf-only stacking & deterministic ordering**:
  - Only stack teams where `siblingManagerCount === 0`, `parentReportCount > gridThreshold`, and `rawDepth >= stackMinDepth`. Mixed teams (managers + individual contributors) must stay on a horizontal bus so peers never share a row with a colleague's reports.
  - Sort by numeric-aware `sortKey` (`pad(datum.id, 15, '0', 'left')` for numeric IDs) in both the `window` transform (`groupby: ["parentId", "isStacked"]`) and a `collect` transform before `stratify`.

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
