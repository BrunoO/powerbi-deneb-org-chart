# Power BI Org Chart with Deneb & Vega

This repository contains a production-ready **Organizational Chart** visual for Power BI using the **Deneb: Declarative Visualization** custom visual and **Vega** specification.

## Files
- [`deneb-org-chart.json`](./deneb-org-chart.json): The full Vega specification to paste into Deneb.
- [`sample-org-data.csv`](./sample-org-data.csv): Sample hierarchy dataset matching the required schema.
- [`preview.html`](./preview.html): Standalone browser preview file.

## Requirements
- Power BI Desktop
- Deneb custom visual (free on Microsoft AppSource)
- Table with columns: `ID`, `ParentID`, `Name`, `Title`
