# Power BI Interactive Collapsible Org Chart with Deneb & Vega

A production-ready, interactive, and beautifully designed **Collapsible Organizational Chart** visual for Power BI using the **Deneb: Declarative Visualization** custom visual and **Vega 5**.

---

## Key Features

- **Approachable Executive CEO Distinction**: Level 0 (CEO) is framed with a crisp white card body, warm royal blue accent border (`#3B82F6`), soft royal aura glow, and a distinctive **`👑 CEO`** prestige badge—distinguished and approachable without heavy, ominous dark fills.
- **Total Descendant Headcount Badge (`👥 N`)**: Every manager card automatically calculates and displays their total descendant headcount with a modern people icon pill badge in the bottom-right corner (e.g. `👥 15` for David Chen, `👥 41` for the CEO).
- **Interactive Branch Collapsing & Expanding**: Click the **`−`** button at the bottom of any manager card to collapse all their direct and indirect sub-reports. When collapsed, the button displays a **`+ N`** badge showing the total headcount hidden (e.g. `+15`). Clicking it expands the branch back.
- **Two-Column Vertical Grid Stacking for Large Teams**: Teams with more than 6 direct reports automatically stack child nodes into two neat vertical columns, dramatically condensing wide horizontal sprawl.
- **Active Reporting Line Hover Highlighting**: Hovering over any employee card highlights their entire chain of command all the way to the CEO in vibrant blue (`#2563EB`), softly dimming unrelated branches.
- **Interactive Card Elevation on Hover**: Cards dynamically float upward with an expanded soft cobalt glow aura when hovered.
- **Floating Glassmorphic Toolbar**: Quick controls docked at the top center for Expand All (`⤢`), Collapse All (`⤡`), Zoom In (`+`), Zoom Out (`−`), and Reset (`100%`).
- **Dynamic Re-layout & Re-centering**: When a branch collapses or expands, the tree automatically re-packs and smoothly aligns on the canvas.
- **Zero-Overlap Architecture**: Built on Vega's `nodeSize` tidy layout and automatic dynamic centering, guaranteeing cards never collide regardless of how many branches are expanded or collapsed.
- **165×56px Cards for Breathing Room**: Generous width with left color accents coded by organizational depth level (`L0`, `L1`, `L2`, etc.), preventing awkward title truncations.
- **Orthogonal Branch Connectors**: Standard right-angled connectors branching neatly from parent cards to child cards with subpixel alignment across all zoom scales.
- **Version Identifier (`v1.4.1`)**: Embedded version tracker in `signals` and root `usermeta` for quick verification inside Power BI projects.

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

Navigating a 1,000+ employee organization where single leaders have 50+ direct reports is made effortless through seven built-in capabilities:

1. **Active Reporting Line Highlighting on Hover**:
   - Hovering over any employee card illuminates their **entire upward reporting path up to the CEO** and all **downward direct/indirect reports** in vibrant primary blue (`#2563EB`).
   - The exact branch connectors light up in bold blue with double thickness (`2.5px`).
   - All unrelated sibling departments and links gently dim to **35% opacity**, providing instant spatial clarity without losing context in large 500+ org trees.
2. **Modern Floating Glassmorphic Toolbar**:
   - Clean floating dock pill container pinned at the top-left with rounded corners (`cornerRadius: 16`), soft shadow, and crisp icons:
     - **`⤢ Expand All`** & **`⤡ Collapse All`** action buttons.
     - Thin vertical hairline divider rule.
     - Segmented Zoom Control: **`[ − | Reset (100%) | + ]`**.
3. **Canvas Dot-Matrix Background**:
   - Subtle spatial dot-matrix background (similar to Linear, FigJam, or Miro) providing tactile orientation when panning and zooming.
4. **Vertical Grid Stacking for Large Teams (> 6 direct reports)**:
   - When a manager has $> 6$ direct reports (e.g. 10 to 50 individual contributors or reps), they are **automatically arranged in 2 neat vertical columns** directly underneath that manager, rather than stretching across thousands of pixels in a single horizontal line.
   - A team of 50 people occupies only **~350px wide** instead of **8,750px wide** (a 95% width reduction!).
   - Smaller teams ($\le 6$ direct reports) remain in clean standard horizontal rows.
   - **Executive Protection**: Level 1 executive teams (VPs / C-Suite reporting to the CEO) and managers with sub-teams are **never vertically stacked**; they always flow in a clean horizontal department row across the top.
   - Configurable via `gridThreshold` (default: `6`) and `stackMinDepth` (default: `2`). Set `gridThreshold` to `999` to disable.
5. **Collapsed-by-Default (Progressive Disclosure)**:
   - On initial report load, only the executive team is visible (**Level 0** CEO and **Level 1** VPs / Department Heads).
   - All managers at Level 1 and below start collapsed (`+N`), displaying their total downstream headcount.
   - Users click into the specific department they wish to explore. Sibling departments stay collapsed, avoiding wide horizontal bloat.
   - Configured via the `defaultCollapseDepth` signal:
     - `1`: Shows Level 0 and Level 1 on load (default).
     - `2`: Shows Levels 0, 1, and 2.
     - `99`: Loads all levels expanded.
6. **Interactive Zooming (`+`, `−`, Mouse Wheel)**:
   - Use the **`+`** and **`−`** buttons on the top toolbar (or scroll your mouse wheel over the canvas) to zoom smoothly between `40%` and `160%`.
   - Cards, spacing, and typography scale proportionally.
   - Clicking **`Reset (100%)`** returns to normal scale immediately.
7. **Interactive Drag-to-Pan**:
   - Click and drag anywhere on the canvas background to pan in any direction ($X$ and $Y$).

---

## Customization & Tuning

Key visual dimensions are exposed as signals at the top of [`deneb-org-chart.json`](./deneb-org-chart.json):

```json
"signals": [
  { "name": "versionId", "value": "v1.4.0" },
  { "name": "defaultCollapseDepth", "value": 1 },
  { "name": "gridThreshold", "value": 6 },
  { "name": "stackMinDepth", "value": 2 },
  { "name": "zoomLevel", "value": 1.0 },
  { "name": "cardWidth", "update": "round(165 * zoomLevel)" },
  { "name": "cardHeight", "update": "round(56 * zoomLevel)" },
  { "name": "nodeSpacingX", "update": "round(195 * zoomLevel)" },
  { "name": "nodeSpacingY", "update": "round(118 * zoomLevel)" },
  { "name": "minCanvasWidth", "value": 1200 },
  { "name": "minCanvasHeight", "value": 550 }
]
```

- **True Orthogonal Midpoint Bus Line Routing**:
  - Connector links drop vertically from the parent card through a dedicated stem into the exact midpoint of the corridor ($31\text{px}$ down) before branching horizontally.
  - The horizontal bus line runs cleanly through the open space between rows, completely separated from sibling cards and their toggle buttons, ensuring unmistakable parent-child lineage.
- **Dynamic Canvas Auto-Sizing & Scrollbars**: 
  - The specification dynamically computes the horizontal (`treeExtentX`) and vertical (`treeExtentY`) span of the rendered hierarchy.
  - When the organization width exceeds `minCanvasWidth` (e.g. 15+ branches across), or depth exceeds `minCanvasHeight`, the canvas automatically expands to fit every single node with 40px margin on each side.
  - In Power BI Desktop, Deneb's overlay scrollbars allow scrolling over the **entire** expanded canvas so no nodes are ever cut off.
- **Scrollbar Styling in Power BI**: Under **Format visual** $\rightarrow$ **Scrollbars** card in Power BI's formatting pane, you can customize the overlay scrollbar thickness (`8px`–`16px`), opacity, color, and corner radius.

---

## Local Browser Preview

You can open [`preview.html`](./preview.html) directly in any browser (Chrome, Safari, Edge, Firefox) by double-clicking the file in Finder/File Explorer to interactively click, collapse, expand, and test the org chart offline.

---

## Security, Governance & Compliance Analysis

This solution is designed for enterprise environments and introduces no technical vulnerabilities. The breakdown below details the security, sandboxing, and data governance profile when running inside Power BI:

### 1. Visual Execution & Sandboxing (AppSource & Certification)
- **Microsoft AppSource Certified Visual**: Deneb (by Daniel Marsh-Patrick) is a Microsoft-certified custom visual.
- **Zero External Data Exfiltration**: Certified custom visuals are audited by Microsoft and strictly prohibited from accessing external network resources, making arbitrary HTTP/API requests, or transmitting telemetry/data outside the tenant.
- **Sandboxed `<iframe>` Isolation**: The visual runs inside an isolated browser iframe (`sandbox="allow-scripts"`). It has no access to parent DOM tokens, cookies, `localStorage`, `sessionStorage`, or user session credentials.
- **Enterprise Tenant Compliance**: Fully complies with corporate tenant policies configured to *"Allow only certified visuals"*.

### 2. Vega Runtime & Code Injection (XSS / RCE Defense)
- **Declarative AST Interpretation (No `eval`)**: Deneb uses Vega 5, which interprets visual specifications through an isolated declarative AST parser (`vega-expression`), rather than executing arbitrary JavaScript.
- **Native SVG / Canvas Escaping**: Employee names, titles, and IDs are rendered via native Vega `<text>` SVG tags or Canvas `fillText()`. Any potential injection payload (e.g., `<script>` tags or SQL-like syntax) is rendered as harmless raw string text, preventing Stored Cross-Site Scripting (XSS).

### 3. Data Governance, RLS & HR Confidentiality
- **Row-Level Security (RLS) Compatibility**: Deneb operates strictly downstream of Power BI's DAX query engine. It only receives rows permitted by the active user's RLS role.
  > [!WARNING]
  > **Hierarchy Integrity with RLS**: Vega's `stratify` transform requires an unbroken path from the root node (CEO) down to visible subordinates. If RLS rules filter out an intermediate manager, Vega will encounter an orphaned node and fail to render the tree. When implementing RLS, ensure hierarchy chains are preserved or dynamically rooted for each viewer.
- **PII & Data Export Management**: Org charts inherently display organizational structures and employee metadata. Do not drag sensitive unneeded columns (e.g., compensation bands, personal phone numbers) into the visual's data bucket. Use Power BI tenant/report settings to restrict *"Export data"* permissions if required.

### 4. Client-Side Performance & Availability
- **Browser Memory Protection**: Rendering large trees (10,000+ employees) can strain browser memory. This visual mitigates client lag via `defaultCollapseDepth: 1` (collapsed by default) and two-column vertical grid stacking, ensuring only active branches are rendered into the DOM at any given time.

### Security Risk Assessment Matrix

| Security Dimension | Risk Level | Assessment & Defense |
| :--- | :---: | :--- |
| **Data Exfiltration** | 🟢 **None** | Deneb is Microsoft-certified; external network requests are strictly blocked. |
| **Code Injection / XSS** | 🟢 **None** | Vega declarative runtime is sandboxed; text marks render without HTML evaluation. |
| **Session / Token Theft** | 🟢 **None** | Isolated sandbox iframe prevents access to tenant cookies, tokens, or parent DOM. |
| **Row-Level Security (RLS)** | 🟡 **Low (Operational)** | Fully respected; intermediate manager nodes must not be severed by RLS rules. |
| **PII / Data Exposure** | 🟡 **Low (Governance)** | Only bind authorized fields to the visual; manage report-level export controls. |

---

## License

This project is licensed under the MIT License - see the [LICENSE](file:///Users/brunoorsier/dev/org_chart/LICENSE) file for details.

