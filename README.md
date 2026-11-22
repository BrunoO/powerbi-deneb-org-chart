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

- **Clean Executive Design**: Rounded cards on a subtle dot-grid canvas, smooth curved branch connectors, and an approachable **`★ CEO`** badge that makes top leadership easy to spot.
- **2-Line Title Wrapping**: Long job titles wrap cleanly onto a second line at word boundaries instead of being cut off with `...`.
- **Total Team Headcount (`👥 N`)**: Every manager card displays its total downstream headcount.
- **Active Reporting-Line Highlighting**: Hover over any employee to highlight their full management chain up to the CEO and all of their direct/indirect reports, while gently dimming unrelated branches.
- **Interactive Branch Collapse & Expand**: Click **`−`** on any manager card to collapse their team, or **`+N`** to expand it again.
- **Floating Toolbar & Live Summary**:
  - **`⤢ Expand All`** / **`⤡ Collapse All`** for instant tree-wide control.
  - **`☵ Standard` / `☷ Stacked`** toggle to switch between a traditional horizontal tree and compact 2-column stacking for large teams (`> 6` direct reports).
  - **`[ − | Reset (100%) | + ]`** zoom controls, plus drag-to-pan and mouse-wheel zoom.
  - **Live Summary Pill** showing total headcount and hierarchy depth (e.g., `👥 42 People · 4 Levels`).
- **Collapsed by Default**: Opens with just the CEO and Level-1 leaders visible so large organizations load quickly without visual clutter.

---

## 📁 Files

- [`deneb-org-chart.json`](./deneb-org-chart.json): Ready-to-use Vega 5 specification (`v1.6.0`) to paste into Deneb in Power BI.
- [`sample-org-data.csv`](./sample-org-data.csv): Sample dataset (42 employees across 4 levels) for testing large executive teams and sub-trees.
- [`preview.html`](./preview.html) & [`index.html`](./index.html): Standalone HTML preview for testing offline in any browser.

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
| **`gridThreshold`** | `6` | Minimum direct reports before a team stacks into 2 columns (when stacking is enabled). |
| **`stackMinDepth`** | `2` | Keeps top executives (Level 1) horizontal even when stacking is enabled. |
| **`zoomLevel`** | `1.0` | Starting zoom level (`0.4` to `1.6`). |

---

## 🔒 Security & Row-Level Security (RLS)

- **Certified & Sandboxed**: Deneb is a Microsoft-certified Power BI visual. It runs in an isolated sandbox with zero external network calls or data exfiltration.
- **Safe Text Rendering**: Names and titles are rendered purely as text, preventing HTML/script injection.
- **Row-Level Security (RLS)**: Power BI RLS filters are automatically respected.
  > [!WARNING]
  > Make sure RLS rules do not hide an intermediate manager while leaving their subordinates visible, as every visible employee needs an unbroken path up to the root node.

---

## 📄 License

Licensed under the MIT License — see [`LICENSE`](./LICENSE) for details.
