# Power BI Interactive Collapsible Org Chart with Deneb & Vega

A production-ready, interactive, and beautifully designed **Collapsible Organizational Chart** visual for Power BI using the **Deneb: Declarative Visualization** custom visual and **Vega 5**.

---

## Key Features

- **Total Descendant Headcount Display**: Every manager card automatically calculates and displays their total descendant headcount in the bottom-right corner (e.g. `team 4` for David Chen, `team 11` for the CEO).
- **Interactive Branch Collapsing & Expanding**: Click the **`−`** button at the bottom of any manager card to collapse all their direct and indirect sub-reports. When collapsed, the button displays a **`+ N`** badge showing the total headcount hidden (e.g. `+4`). Clicking it expands the branch back.
- **Dynamic Re-layout & Re-centering**: When a branch collapses, the tree automatically re-packs horizontally and re-centers on the canvas, saving massive space for large organizations.
- **"Expand All" Reset Button**: A quick-action button in the top-left corner restores the full organization view in one click.
- **Zero-Overlap Architecture**: Built on Vega's `nodeSize` tidy layout and automatic dynamic centering, guaranteeing cards never collide regardless of how many branches are expanded or collapsed.
- **Compact Executive Card Styling**: Clean rounded 145×54px cards with subtle drop shadows, left color accents coded by organizational depth level (`L0`, `L1`, `L2`, etc.), and top-right level badges.
- **Orthogonal Branch Connectors**: Standard right-angled connectors branching neatly from parent cards to child cards.
- **Interactive Tooltips & Hover Effects**: Hovering over any card highlights its border in primary blue and renders a detailed Power BI tooltip showing employee details, direct report counts, and collapse status.

---

## File Overview

- [`deneb-org-chart.json`](./deneb-org-chart.json): The complete Vega specification ready to paste directly into Deneb.
- [`sample-org-data.csv`](./sample-org-data.csv): Sample hierarchy dataset matching the required table schema (28 employees across 4 levels, featuring a 15-node organization under VP David Chen to easily test large subtrees and horizontal scrolling).
- [`preview.html`](./preview.html): Standalone, self-contained HTML file to preview and test the visual directly in your browser.

---

## Step-by-Step Power BI Setup

### Step 1: Install Deneb in Power BI
1. Open **Power BI Desktop**.
2. In the **Visualizations** pane on the right, click the **`...`** (Get more visuals) icon and choose **Get more visuals**.
3. Search for **Deneb, Declarative Visualization in Power BI** (certified custom visual by Daniel Marsh-Patrick) and click **Add**.

### Step 2: Prepare Your Data Table
Ensure your data table has the following four fields (or map your own column names):

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| **`ID`** | Text or Whole Number | Unique identifier for each employee | `1`, `"E101"` |
| **`ParentID`** | Text or Whole Number | Direct manager's ID. **Must be `BLANK()` / `null` for the top executive (CEO/President)** | `null`, `1` |
| **`Name`** | Text | Full name of the employee | `Sarah Jenkins` |
| **`Title`** | Text | Job title / Role | `Chief Executive Officer` |

> [!IMPORTANT]
> **Hierarchy Rules for Vega Tree Stratification:**
> 1. **Single Root Node**: There must be exactly one person with a blank / null `ParentID`.
> 2. **No Orphaned IDs**: Every non-blank `ParentID` must exist in the `ID` column.
> 3. **No Circular Loops**: An employee cannot report to someone who reports back to them ($A \rightarrow B \rightarrow A$).

### Step 3: Add Fields to the Deneb Visual
1. Add a **Deneb** visual to your report canvas.
2. Drag `ID`, `ParentID`, `Name`, and `Title` from your data pane into the **Values** field bucket of Deneb.
3. Make sure summarization is set to **Don't summarize** (especially for numeric IDs).

### Step 4: Paste the Specification
1. In the top-right corner of the Deneb visual header, click **`...`** and select **Edit**.
2. Under **Specification type**, select **Vega** *(do NOT select Vega-Lite, as hierarchical tree transforms require Vega)*.
3. Under template choices, select **[empty]** and click **Create**.
4. Replace the entire code in the **Specification** editor with the contents of [`deneb-org-chart.json`](./deneb-org-chart.json).
5. Click the **Apply** button (play icon / `Ctrl+Enter`) in the toolbar.
6. Click **< Back to report** in the top left.

---

## Large Organization Features (1,000+ Employees)

Navigating a 1,000+ employee organization where single leaders have 50+ direct reports is made effortless through three built-in capabilities:

1. **Collapsed-by-Default (Progressive Disclosure)**:
   - On initial report load, only the executive team is visible (**Level 0** CEO and **Level 1** VPs / Department Heads).
   - All managers at Level 1 and below start collapsed (`+N`), displaying their total downstream headcount.
   - Users click into the specific department they wish to explore. Sibling departments stay collapsed, avoiding wide horizontal bloat.
   - Configured via the `defaultCollapseDepth` signal:
     - `1`: Shows Level 0 and Level 1 on load (default).
     - `2`: Shows Levels 0, 1, and 2.
     - `99`: Loads all levels expanded.
2. **Interactive Zooming (`+`, `−`, Mouse Wheel)**:
   - Use the **`+`** and **`−`** buttons on the top toolbar (or scroll your mouse wheel over the canvas) to zoom smoothly between `40%` and `160%`.
   - Cards, spacing, and typography scale proportionally.
   - Clicking **`Reset (100%)`** returns to normal scale immediately.
3. **Interactive Drag-to-Pan**:
   - Click and drag anywhere on the white canvas background to pan in any direction ($X$ and $Y$).
4. **Toolbar Controls**:
   - **`Expand All`**: Unrolls the entire organization hierarchy.
   - **`Collapse All`**: Collapses all branches back to the clean top-level executive view.
   - **`Reset`**: Resets pan offsets and zoom level back to `100%`.

---

## Customization & Tuning

Key visual dimensions are exposed as signals at the top of [`deneb-org-chart.json`](./deneb-org-chart.json):

```json
"signals": [
  { "name": "defaultCollapseDepth", "value": 1 },
  { "name": "zoomLevel", "value": 1.0 },
  { "name": "cardWidth", "update": "round(145 * zoomLevel)" },
  { "name": "cardHeight", "update": "round(54 * zoomLevel)" },
  { "name": "nodeSpacingX", "update": "round(175 * zoomLevel)" },
  { "name": "nodeSpacingY", "update": "round(95 * zoomLevel)" },
  { "name": "minCanvasWidth", "value": 1200 },
  { "name": "minCanvasHeight", "value": 550 }
]
```

- **Dynamic Canvas Auto-Sizing & Scrollbars**: 
  - The specification dynamically computes the horizontal (`treeExtentX`) and vertical (`treeExtentY`) span of the rendered hierarchy.
  - When the organization width exceeds `minCanvasWidth` (e.g. 15+ branches across), or depth exceeds `minCanvasHeight`, the canvas automatically expands to fit every single node with 40px margin on each side.
  - In Power BI Desktop, Deneb's overlay scrollbars allow scrolling over the **entire** expanded canvas so no nodes are ever cut off.
- **Scrollbar Styling in Power BI**: Under **Format visual** $\rightarrow$ **Scrollbars** card in Power BI's formatting pane, you can customize the overlay scrollbar thickness (`8px`–`16px`), opacity, color, and corner radius.

---

## Local Browser Preview

You can open [`preview.html`](./preview.html) directly in any browser (Chrome, Safari, Edge, Firefox) by double-clicking the file in Finder/File Explorer to interactively click, collapse, expand, and test the org chart offline.
