# Power BI Organizational Chart with Deneb & Vega

A production-ready, interactive, and beautifully designed **Organizational Chart** visual for Power BI using the **Deneb: Declarative Visualization** custom visual and **Vega 5**.

![Preview](preview.html)

---

## Features

- **Zero-Overlap Architecture**: Uses Vega's `nodeSize` tidy layout and automatic dynamic centering, guaranteeing cards never collide or overlap regardless of team size.
- **Executive Card Styling**: Clean rounded cards, ambient drop shadows, left color accents coded by organizational depth level (`L0`, `L1`, `L2`, etc.), and top-right level pill badges.
- **Compact & Space-Efficient**: Sleek 145×54px cards with generous text limits and auto-ellipsis truncation.
- **Orthogonal Branch Connectors**: Standard right-angled connectors branching neatly from parent cards to child cards.
- **Interactive Tooltips & Hover Effects**: Hovering over any card highlights its border in primary blue and renders a detailed Power BI tooltip.

---

## File Overview

- [`deneb-org-chart.json`](./deneb-org-chart.json): The complete Vega specification ready to paste directly into Deneb.
- [`sample-org-data.csv`](./sample-org-data.csv): Sample hierarchy dataset matching the required table schema.
- [`preview.html`](./preview.html): Standalone, self-contained HTML file to preview the visual directly in your browser.

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

## Customization & Tuning

All key visual dimensions are exposed as signals at the very top of [`deneb-org-chart.json`](./deneb-org-chart.json):

```json
"signals": [
  { "name": "cardWidth", "value": 145 },
  { "name": "cardHeight", "value": 54 },
  { "name": "nodeSpacingX", "value": 175 },
  { "name": "nodeSpacingY", "value": 95 },
  { "name": "topMargin", "value": 25 }
]
```

- **Preventing Overlaps**: Keep `nodeSpacingX` greater than `cardWidth` (e.g. `175` vs `145` gives a `30px` gap between sibling cards).
- **Vertical Spacing**: Adjust `nodeSpacingY` to increase or decrease the distance between hierarchy levels.
- **Color Palette**: Under `"scales" -> "levelColor"`, adjust the hex colors for levels `0` through `4+` to match your organization's brand colors.
- **Enabling Scrollbars for Large Organizations**:
  In Power BI Desktop:
  1. Select the Deneb visual.
  2. Go to **Format visual** tab $\rightarrow$ **Vega** (or **Canvas**).
  3. Turn on **Scrollbars** so users can smoothly pan horizontally and vertically across wider company trees.

---

## Local Browser Preview

You can open [`preview.html`](./preview.html) directly in any browser (Chrome, Safari, Edge, Firefox) by double-clicking the file in Finder/File Explorer to preview and inspect the org chart offline.
