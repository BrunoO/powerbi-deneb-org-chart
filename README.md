# Power BI Interactive Collapsible Org Chart (Deneb & Vega)

A clean, interactive **Collapsible Organizational Chart** for Power BI built with the **Deneb** custom visual (Vega 5).

Designed for everything from executive overviews to large 1,000+ employee organizations—with zero overlapping cards, smooth pan & zoom, and one-click branch collapsing.

> **[🚀 Open Live Interactive Demo](https://brunoo.github.io/powerbi-deneb-org-chart/)** *(powered by GitHub Pages — click to expand, collapse, hover, pan, and zoom live in your browser)*

---

## 📸 Preview

### Executive Overview (12 Direct Reports, Standard Mode)
![Executive Overview](./images/org-chart-overview.png)

### Active Reporting-Line Highlighting & 2-Line Title Wrapping
![Active Reporting Line Highlighting](./images/org-chart-hover-lineage.png)

### Compact 2-Column Stacking (`Stacked` Mode)
![Compact 2-Column Stacked Mode](./images/org-chart-stacked-mode.png)

---

## ✨ Key Features

- **Clean Executive Design & Division Color Coding**: Rounded cards on a subtle dot-grid canvas, smooth curved branch connectors, an approachable **`★ CEO`** badge, and automatic per-division HSL color tinting based on each employee's Level-1 leader.
- **Unlimited Hierarchy Depth**: Uses Vega's `treeAncestors()` to compute depths, headcounts, and lineage across organizations of any depth.
- **2-Line Title Wrapping**: Long job titles wrap cleanly onto a second line at word boundaries instead of being cut off with `...`.
- **Total Team Headcount (`👥 N`)**: Every manager card displays its total downstream headcount.
- **Active Reporting-Line Highlighting**: Hover over any employee to highlight their full management chain up to the CEO and all of their direct/indirect reports, while gently dimming unrelated branches.
- **Interactive Branch Collapse & Expand**: Click **`−`** on any manager card to collapse their team, or **`+N`** to expand it again.
- **Floating Toolbar & Live Summary**:
  - **`⤢ Expand All`** / **`⤡ Collapse All`** for instant tree-wide control.
  - **`☵ Standard` / `☷ Stacked`** toggle to switch between a traditional horizontal tree and compact 2-column stacking for large individual-contributor teams (`> 6` direct reports, none of whom manage anyone). Stacked teams hang off a central spine from their **real manager**, so every connector always points to the correct boss.
  - **`[ − | Reset (100%) | + ]`** zoom controls, plus cursor-anchored mouse-wheel zoom, drag-anywhere panning, double-click reset, and touch pinch-to-zoom.
  - **Live Summary Pill** showing total headcount and hierarchy depth (e.g., `👥 85 People · 7 Levels`).
- **Collapsed by Default**: Opens with just the CEO and Level-1 leaders visible so large organizations load quickly without visual clutter.

---

## 📁 Files

- [`deneb-org-chart.json`](./deneb-org-chart.json): Ready-to-use Vega 5 specification (`v1.7.3`) to paste into Deneb in Power BI.
- [`sample-org-data.csv`](./sample-org-data.csv): Sample dataset (85 employees across 7 levels) that exercises every layout edge case: a 12-person executive team, leaf-only teams that stack (even and odd sizes, side-by-side, at Level 6), a large *mixed* team of managers and engineers (stays horizontal), a team exactly at the threshold, and IDs that cross digit boundaries (`17` vs `100` vs `1000`) in shuffled input order.
- [`preview.html`](./preview.html) & [`index.html`](./index.html): Standalone HTML preview for testing in any browser (no Power BI needed; requires internet for the Vega CDN).
- [`tools/verify-layout.js`](./tools/verify-layout.js): Automated layout checker (see [Development](#-development--layout-verification)).

---

## 🚀 Step-by-Step Power BI Setup

### 1. Install Deneb
1. Open **Power BI Desktop**.
2. In the **Visualizations** pane, click **`...`** → **Get more visuals**.
3. Search for **Deneb, Declarative Visualization in Power BI** (Microsoft-certified) and click **Add**.

### 2. Prepare Your Data Table
Your table needs four columns (or map your own column names to these):

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| **`ID`** | Text or Whole Number | Unique identifier for each employee | `1`, `"E101"` |
| **`ParentID`** | Text or Whole Number | Direct manager's ID (**must be `BLANK()` / `null` for the CEO**) | `null`, `1` |
| **`Name`** | Text | Employee's full name | `Sarah Jenkins` |
| **`Title`** | Text | Employee's job title | `Chief Executive Officer` |

> [!IMPORTANT]
> **Hierarchy Requirements:**
> 1. **Single Root**: Exactly one person (the CEO/top leader) must have a blank/`null` `ParentID`.
> 2. **No Orphans**: Every non-blank `ParentID` must match an existing `ID` in the table.
> 3. **No Loops**: An employee cannot report to someone who reports back to them.

### 3. Add Fields to Deneb
1. Add a **Deneb** visual to your report page.
2. Drag **`ID`**, **`ParentID`**, **`Name`**, and **`Title`** into Deneb's **Values** bucket.
3. Make sure summarization is set to **Don't summarize** (especially for numeric IDs).

### 4. Paste the Specification
1. Click **`...`** in the top-right corner of the Deneb visual → **Edit**.
2. Choose **Vega** *(not Vega-Lite)*, select **[empty]**, and click **Create**.
3. Replace the editor contents with [`deneb-org-chart.json`](./deneb-org-chart.json).
4. Click **Apply** (`Ctrl+Enter`), then **< Back to report**.

---

## ⚙️ Optional Configuration

You can adjust default behavior by editing the `signals` block at the top of [`deneb-org-chart.json`](./deneb-org-chart.json):

| Setting | Default | What It Controls |
| :--- | :---: | :--- |
| **`defaultCollapseDepth`** | `1` | Levels shown on initial load (`1` = CEO + Level-1 VPs; `2` = down to Directors; `99` = expand all). |
| **`enableStacking`** | `false` | Set to `true` to start in 2-column stacked mode for large teams. Users can also toggle this live in the toolbar. |
| **`gridThreshold`** | `6` | A team stacks into 2 columns when it has more direct reports than this **and none of them are managers** (mixed teams stay horizontal so peers never share a row with a colleague's reports). |
| **`stackMinDepth`** | `2` | Keeps top executives (Level 1) horizontal even when stacking is enabled. |
| **`zoomLevel`** | `1.0` | Starting zoom level (`0.4` to `1.6`). |

---

## ⚠️ Limitations & Data Prerequisites

Check these before publishing — the visual sanitizes sloppy inputs where it can, but a few cases still need clean data:

| # | Rule | What happens if you break it |
| :--- | :--- | :--- |
| 1 | **IDs must be unique and non-blank.** | The first occurrence wins; duplicates are dropped silently. |
| 2 | **Do not use `0` as an employee ID.** | `ParentID` `0` / `'0'` is treated as "no manager" (the common Power BI root sentinel), so a real `ID` of `0` would misattach its reports. |
| 3 | **Exactly one blank-`ParentID` root is supported.** | Orphan `ParentID`s (no matching `ID`) and extra roots are tolerated — they are attached under the elected root instead of erroring — but the layout verifier enforces a single root, so treat multiples as data to fix. |
| 4 | **No reporting loops.** | A dataset with *no* root at all (pure cycle, e.g. `A↔B`) renders via fallback-root election, but a loop in one branch *alongside* a valid root still breaks the visual. Validate with `node tools/verify-layout.js your-data.csv` before publishing. |
| 5 | **Exotic ID formats only affect sibling order.** | Numeric IDs over 15 digits, negatives, or scientific notation (e.g. `1e3`) still draw a correct hierarchy; only the left-to-right order of siblings may differ from numeric order — deterministically (same data, same layout). Comma-containing text IDs are fully supported. |

---

## 🧪 Development & Layout Verification

The repository ships a headless checker that renders the spec with Vega in Standard and Stacked mode (collapsed, fully expanded, and at several zoom levels) and fails if the chart becomes ambiguous:

- every connector must go from an employee's **real manager** to the employee (no peer-to-peer chains), and every visible reporting line must be drawn exactly once;
- no connector may pass through an unrelated card, no two managers' connector segments may overlap, and no cards may overlap;
- stacked teams must be leaf-only, above the threshold, and laid out in 2 aligned columns in numeric-aware ID order;
- hovering any card must highlight exactly its reporting chain (and its own reports);
- `preview.html` must embed the same spec as `deneb-org-chart.json`.

```bash
npm install                                  # once (installs vega)
npm test                                     # verify the built-in sample data
node tools/verify-layout.js my-org.csv       # verify your own ID,ParentID,Name,Title export
npm run sync-preview                         # copy deneb-org-chart.json into preview.html after editing
```

> [!NOTE]
> `npm run sync-preview` and the `preview.html` sync check locate the embedded spec by string matching (`const spec = ` … `\n};`). Do not reformat or move that block in `preview.html` — edit `deneb-org-chart.json` and re-run the sync instead. Note that `node tools/verify-layout.js your-data.csv` validates your data but skips the `preview.html` sync check; run plain `npm test` to include it.

---

## 🔒 Security & Row-Level Security (RLS)

- **Certified & Sandboxed**: Deneb is a Microsoft-certified Power BI visual. It runs in an isolated sandbox with zero external network calls or data exfiltration.
- **Safe Text Rendering**: Names and titles are rendered purely as text, preventing HTML/script injection.
- **Row-Level Security (RLS)**: Power BI RLS filters are automatically respected.
  > [!WARNING]
  > Make sure RLS rules do not hide an intermediate manager while leaving their subordinates visible, as every visible employee needs an unbroken path up to the root node.

---

## 🤖 Use of AI

This software was built almost entirely using automated code-generation tools. No human has fully reviewed the generated code for correctness or security. I have extensively tested the visual and use it daily, but there might be issues that I haven't encountered yet.

---

## 🙌 Credits

- Inspired in part by **Davide Bacci**'s [Organisation Tree Chart](https://github.com/PBI-David/Deneb-Showcase/tree/main/Organisation%20Tree%20Chart) in `PBI-David/Deneb-Showcase` (MIT License) for cursor-anchored pan/zoom patterns, `treeAncestors()` lineage calculation, and `hsl()` branch color tinting.

---

## 📄 License

Licensed under the MIT License — see [`LICENSE`](./LICENSE) for details.
