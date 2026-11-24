#!/usr/bin/env node
/*
 * Layout verifier for the Deneb org chart spec.
 *
 * Runs the Vega spec headlessly in several scenarios (Standard / Stacked mode,
 * collapsed / fully expanded, several zoom levels) and checks that the drawn
 * chart is unambiguous:
 *
 *   links    every drawn link goes from the employee's real manager to the employee,
 *            and every visible manager -> report relation has exactly one link
 *   crossing no link segment passes through an unrelated card
 *   buses    no horizontal / vertical link segments from different managers overlap
 *   cards    no two cards overlap
 *   stacking stacked teams are leaf-only, larger than gridThreshold, laid out in
 *            2 aligned columns in numeric-aware ID order; mixed or small teams stay on one row
 *   hover    hovering any card highlights exactly the reporting chain up to the CEO
 *   preview  preview.html embeds exactly the same spec as deneb-org-chart.json
 *
 * Usage:
 *   npm install            # once, installs vega
 *   npm test               # verify built-in sample data
 *   node tools/verify-layout.js path/to/data.csv   # verify your own ID,ParentID,Name,Title data
 */
const fs = require('fs');
const path = require('path');
const vega = require('vega');

const root = path.join(__dirname, '..');
const specPath = path.join(root, 'deneb-org-chart.json');
const baseSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const HIGHLIGHT = '#2563EB';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const [head, ...body] = rows;
  const cols = head.map(h => h.replace(/^\uFEFF/, '').trim());
  for (const req of ['ID', 'ParentID', 'Name', 'Title']) {
    if (!cols.includes(req)) throw new Error(`CSV is missing required column "${req}" (found: ${cols.join(', ')})`);
  }
  return body.map(r => Object.fromEntries(cols.map((h, i) => [h, r[i] === '' || r[i] === undefined ? null : r[i]])));
}

function loadExternal(file) {
  const text = fs.readFileSync(file, 'utf8');
  return file.endsWith('.json') ? JSON.parse(text) : parseCsv(text);
}

function findMark(scene, name) {
  if (!scene) return null;
  if (scene.marktype && scene.name === name) return scene;
  for (const it of scene.items || []) {
    const r = findMark(it, name);
    if (r) return r;
  }
  return null;
}

function segmentsOf(link) {
  const segs = [];
  let x = 0, y = 0;
  for (const t of link.path.match(/[MVHQ][^MVHQ]*/g) || []) {
    const v = t.slice(1).split(',').map(Number);
    switch (t[0]) {
      case 'M': [x, y] = v; break;
      case 'V': segs.push({ link, x1: x, y1: y, x2: x, y2: v[0] }); y = v[0]; break;
      case 'H': segs.push({ link, x1: x, y1: y, x2: v[0], y2: y }); x = v[0]; break;
      case 'Q': segs.push({ link, x1: x, y1: y, x2: v[2], y2: v[3], curve: true }); x = v[2]; y = v[3]; break;
    }
  }
  return segs;
}

async function runScenario(sc, values) {
  const spec = JSON.parse(JSON.stringify(baseSpec));
  spec.width = 4000;
  spec.height = 2400;
  for (const s of spec.signals) {
    if (s.name === 'defaultCollapseDepth') s.value = sc.collapseDepth;
    if (s.name === 'enableStacking') s.value = sc.stacking;
    if (s.name === 'zoomLevel') s.value = sc.zoom;
  }
  const rows = sc.values !== undefined ? sc.values : values;
  if (rows) spec.data.find(d => d.name === 'dataset').values = rows;

  const view = new vega.View(vega.parse(spec), { renderer: 'none' });
  await view.runAsync();
  const nodes = view.data('tree_nodes');
  // normalise: supports both node-based links (datum = report, datum.source = manager)
  // and Vega treelinks tuples ({source, target})
  const linkOf = d => ({ source: d.source, target: d.target || d, path: d.path });
  const links = view.data('tree_links').map(linkOf);
  const cw = view.signal('cardWidth');
  const threshold = view.signal('gridThreshold');
  const minDepth = view.signal('stackMinDepth');
  const spacingY = view.signal('nodeSpacingY');
  const byId = new Map(nodes.map(n => [n.id, n]));
  const name = n => `${n.Name_clean} (#${n.id})`;
  const issues = [];
  const fail = (check, msg) => issues.push(`[${check}] ${msg}`);

  // ---- sanity: prevent vacuous passes ----
  if (nodes.length < 2) fail('sanity', `expected >= 2 visible cards, got ${nodes.length}`);
  if (links.length !== Math.max(0, nodes.length - 1)) fail('sanity', `expected ${Math.max(0, nodes.length - 1)} links for ${nodes.length} cards, got ${links.length}`);
  const roots = nodes.filter(n => !n.parentId);
  if (roots.length !== 1) fail('sanity', `expected exactly 1 root card, got ${roots.length}`);
  const fz = view.signal('fitZoom');
  if (!isFinite(fz) || fz < 0.4 || fz > 1.6) fail('fit', `fitZoom ${fz} out of [0.4, 1.6]`);
  const maxExtra = view.data('extra_stats').length ? view.data('extra_stats')[0].maxExtra : 0;
  const expectedH = Math.round((maxExtra === 0 ? 58 : 67 + 12 * maxExtra) * view.signal('zoomLevel'));
  if (view.signal('cardHeight') !== expectedH) fail('extras', `cardHeight ${view.signal('cardHeight')} != expected ${expectedH} for maxExtra ${maxExtra}`);
  const bands = view.data('depth_bands');
  const depths = new Set(nodes.map(n => n.rawY));
  if (bands.length !== depths.size) fail('bands', `expected ${depths.size} level bands, got ${bands.length}`);
  const palette = (baseSpec.scales.find(s => s.name === 'branchColor') || {}).range || [];
  const branches = new Set(view.data('lineage_base').map(n => n.branchLeaderId));
  if (branches.size > palette.length) fail('colors', `${branches.size} divisions exceed the ${palette.length}-color branch palette; branch colors will repeat`);

  // ---- links: semantics ----
  const pairs = new Map();
  for (const l of links) {
    if (l.source.id !== l.target.parentId) fail('links', `${name(l.source)} -> ${name(l.target)} but real manager is #${l.target.parentId}`);
    const k = l.source.id + '>' + l.target.id;
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  for (const n of nodes) {
    if (!n.parentId || !byId.has(n.parentId)) continue;
    const c = pairs.get(n.parentId + '>' + n.id) || 0;
    if (c !== 1) fail('links', `${name(byId.get(n.parentId))} -> ${name(n)} drawn ${c} times`);
  }

  // ---- geometry ----
  const inset = 1;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (a.cardX < b.cardX + cw - inset && b.cardX < a.cardX + cw - inset &&
        a.cardTop < b.cardBottom - inset && b.cardTop < a.cardBottom - inset)
      fail('cards', `${name(a)} overlaps ${name(b)}`);
  }
  const segs = links.flatMap(segmentsOf);
  if (links.length > 0 && segs.length === 0) fail('sanity', 'links exist but no path geometry was generated');
  for (const s of segs) {
    const xa = Math.min(s.x1, s.x2), xb = Math.max(s.x1, s.x2);
    const ya = Math.min(s.y1, s.y2), yb = Math.max(s.y1, s.y2);
    for (const n of nodes) {
      if (n === s.link.target || n === s.link.source) continue;
      if (xb > n.cardX + inset && xa < n.cardX + cw - inset && yb > n.cardTop + inset && ya < n.cardBottom - inset)
        fail('crossing', `link ${name(s.link.source)} -> ${name(s.link.target)} crosses card ${name(n)}`);
    }
  }
  const straight = segs.filter(s => !s.curve);
  for (let i = 0; i < straight.length; i++) for (let j = i + 1; j < straight.length; j++) {
    const a = straight[i], b = straight[j];
    if (a.link.source === b.link.source) continue; // shared bus / spine of one manager is intended
    const horiz = a.y1 === a.y2 && b.y1 === b.y2 && a.x1 !== a.x2 && b.x1 !== b.x2 && Math.abs(a.y1 - b.y1) < 0.5;
    const vert = a.x1 === a.x2 && b.x1 === b.x2 && a.y1 !== a.y2 && b.y1 !== b.y2 && Math.abs(a.x1 - b.x1) < 0.5;
    if (!horiz && !vert) continue;
    const [p1, p2, q1, q2] = horiz ? [a.x1, a.x2, b.x1, b.x2] : [a.y1, a.y2, b.y1, b.y2];
    const overlap = Math.min(Math.max(p1, p2), Math.max(q1, q2)) - Math.max(Math.min(p1, p2), Math.min(q1, q2));
    if (overlap > 1) fail('buses', `${horiz ? 'horizontal' : 'vertical'} segments of ${name(a.link.source)} and ${name(b.link.source)} overlap by ${Math.round(overlap)}px`);
  }

  // ---- stacking rules ----
  const teams = new Map();
  for (const n of nodes) if (n.parentId && byId.has(n.parentId)) {
    if (!teams.has(n.parentId)) teams.set(n.parentId, []);
    teams.get(n.parentId).push(n);
  }
  const numericAware = (a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);
  for (const [pid, team] of teams) {
    const mgr = byId.get(pid);
    const leafOnly = team.every(n => !n.reportCount);
    const shouldStack = sc.stacking && team.length > threshold && leafOnly && team[0].rawDepth >= minDepth;
    const stacked = team.filter(n => n.isStacked).length;
    if (shouldStack && stacked !== team.length) fail('stacking', `team of ${name(mgr)} should be stacked (${stacked}/${team.length})`);
    if (!shouldStack && stacked) fail('stacking', `team of ${name(mgr)} must not be stacked (${stacked}/${team.length})`);
    if (shouldStack) {
      const ordered = [...team].sort(numericAware);
      const colX = [ordered[0].cardX, ordered[1].cardX];
      ordered.forEach((n, i) => {
        const row = Math.floor(i / 2), col = i % 2;
        if (Math.abs(n.cardX - colX[col]) > 0.5 || Math.abs(n.cardTop - (ordered[0].cardTop + row * spacingY)) > 0.5)
          fail('stacking', `${name(n)} is not at row ${row}, column ${col} of ${name(mgr)}'s stack`);
      });
      if (!(colX[0] < colX[1])) fail('stacking', `${name(mgr)}'s stack columns are not ordered left -> right`);
    } else {
      const ys = new Set(team.map(n => n.cardTop));
      if (ys.size !== 1) fail('stacking', `non-stacked team of ${name(mgr)} spans ${ys.size} rows`);
    }
  }

  // ---- hover lineage ----
  if (sc.hover) {
    for (const n of nodes) {
      view.signal('hoveredId', n.id).signal('hoveredAncPath', n.ancPath);
      await view.runAsync();
      const mark = findMark(view.scenegraph().root, 'treeLinkPath');
      const lit = new Set(mark.items.filter(it => it.stroke === HIGHLIGHT).map(it => { const l = linkOf(it.datum); return l.source.id + '>' + l.target.id; }));
      const expected = new Set();
      for (let c = n; c && c.parentId && byId.has(c.parentId); c = byId.get(c.parentId)) expected.add(c.parentId + '>' + c.id);
      // descendants of the hovered node are highlighted too
      for (const l of links) if (l.target.ancPath && l.target.ancPath.includes('\u001F' + n.id + '\u001F')) expected.add(l.target.parentId + '>' + l.target.id);
      const missing = [...expected].filter(k => !lit.has(k));
      const extra = [...lit].filter(k => !expected.has(k));
      if (missing.length || extra.length)
        fail('hover', `hovering ${name(n)}: ${missing.length} reporting links not highlighted, ${extra.length} unrelated links highlighted`);
    }
    view.signal('hoveredId', null).signal('hoveredAncPath', '');
  }
  const stackedTeams = [...teams.values()].filter(t => t[0].isStacked).length;
  if (!values && sc.stacking && sc.collapseDepth === 99 && stackedTeams === 0) {
    fail('sanity', 'expected at least 1 stacked team in expanded Stacked mode on sample data');
  }
  return { nodes: nodes.length, links: links.length, stackedTeams, issues };
}

function checkPreview() {
  const html = fs.readFileSync(path.join(root, 'preview.html'), 'utf8');
  const start = html.indexOf('const spec = ');
  const end = html.indexOf('\n};', start);
  if (start < 0 || end < 0) return ['[preview] could not locate embedded spec in preview.html'];
  const embedded = JSON.parse(html.slice(start + 'const spec = '.length, end + 2));
  return JSON.stringify(embedded) === JSON.stringify(baseSpec)
    ? [] : ['[preview] preview.html spec differs from deneb-org-chart.json (run: npm run sync-preview)'];
}

function checkTooltip() {
  const mark = baseSpec.marks.find(m => m.name === 'cardBody');
  const expr = mark && mark.encode && mark.encode.update && mark.encode.update.tooltip && mark.encode.update.tooltip.signal;
  const issues = [];
  if (!expr || !expr.includes('showIdInTooltip')) issues.push('[tooltip] cardBody tooltip must be gated by the showIdInTooltip signal');
  if ((baseSpec.signals.find(s => s.name === 'showIdInTooltip') || {}).value !== false)
    issues.push('[tooltip] showIdInTooltip must default to false (IDs can be confidential)');
  return issues;
}

(async () => {
  const ext = process.argv[2];
  const values = ext ? loadExternal(ext) : null;
  const scenarios = [];
  for (const stacking of [false, true]) {
    scenarios.push({ stacking, collapseDepth: 1, zoom: 1, hover: false });
    for (const zoom of [1, 0.4, 1.6]) scenarios.push({ stacking, collapseDepth: 99, zoom, hover: zoom === 1 });
  }
  if (!ext) {
    // Pure-cycle datasets (no blank ParentID): fallback_root elects a root so the chart renders.
    const CYCLE_TWO = [
      { ID: 'A', ParentID: 'B', Name: 'A', Title: 't' },
      { ID: 'B', ParentID: 'A', Name: 'B', Title: 't' }
    ];
    const CYCLE_THREE = [
      { ID: 'A', ParentID: 'C', Name: 'A', Title: 't' },
      { ID: 'B', ParentID: 'A', Name: 'B', Title: 't' },
      { ID: 'C', ParentID: 'B', Name: 'C', Title: 'y' }
    ];
    for (const [tag, rows] of [['pure 2-cycle', CYCLE_TWO], ['pure 3-cycle', CYCLE_THREE]]) {
      scenarios.push({ stacking: false, collapseDepth: 99, zoom: 1, hover: true, values: rows, tag });
    }
    // Extra info lines (Extra 1/2): card height grows uniformly, geometry must still hold.
    const EXTRA_ROWS = [
      { ID: '1', ParentID: null, Name: 'CEO', Title: 'c' },
      { ID: '2', ParentID: '1', Name: 'VP', Title: 'v' },
      { ID: '3', ParentID: '2', Name: 'A', Title: 't', 'Extra 1': 'Paris', 'Extra 2': 'FR' },
      { ID: '4', ParentID: '2', Name: 'B', Title: 't', 'Extra 1': 'Lyon' }
    ];
    scenarios.push({ stacking: false, collapseDepth: 99, zoom: 1, hover: true, values: EXTRA_ROWS, tag: 'extra fields' });
  }
  let total = 0;
  for (const sc of scenarios) {
    const label = `${sc.tag ? sc.tag + ' | ' : ''}${sc.stacking ? 'Stacked ' : 'Standard'} | ${sc.collapseDepth === 99 ? 'expanded ' : 'collapsed'} | zoom ${sc.zoom.toFixed(2)}`;
    const r = await runScenario(sc, values);
    total += r.issues.length;
    console.log(`${r.issues.length ? '✗' : '✓'} ${label} | ${r.nodes} cards, ${r.links} links, ${r.stackedTeams} stacked teams${r.issues.length ? ` | ${r.issues.length} issues` : ''}`);
    r.issues.slice(0, 25).forEach(i => console.log('    ' + i));
    if (r.issues.length > 25) console.log(`    ... ${r.issues.length - 25} more`);
  }
  if (!ext) {
    const p = checkPreview();
    total += p.length;
    console.log(`${p.length ? '✗' : '✓'} preview.html in sync with deneb-org-chart.json`);
    p.forEach(i => console.log('    ' + i));
  }
  const t = checkTooltip();
  total += t.length;
  console.log(`${t.length ? '✗' : '✓'} tooltip hides ID by default (showIdInTooltip)`);
  t.forEach(i => console.log('    ' + i));
  console.log(total ? `\nFAILED: ${total} issue(s)` : '\nAll layout checks passed.');
  process.exit(total ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
