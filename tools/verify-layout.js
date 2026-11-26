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
  const mode = sc.mode || (sc.stacking ? 'stacked' : 'standard');
  for (const s of spec.signals) {
    if (s.name === 'defaultCollapseDepth') s.value = sc.collapseDepth;
    if (s.name === 'layoutMode') s.value = mode;
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
    const shouldStack = mode !== 'standard' && team.length > threshold && leafOnly && team[0].rawDepth >= minDepth;
    const stacked = team.filter(n => n.isStacked).length;
    if (shouldStack && stacked !== team.length) fail('stacking', `team of ${name(mgr)} should be stacked (${stacked}/${team.length})`);
    if (!shouldStack && stacked) fail('stacking', `team of ${name(mgr)} must not be stacked (${stacked}/${team.length})`);
    if (shouldStack) {
      const ordered = [...team].sort(numericAware);
      const cols = ordered[0].stackCols || 2;
      const colX = Array.from({ length: Math.min(cols, ordered.length) }, (_, c) => ordered[c].cardX);
      ordered.forEach((n, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        if (Math.abs(n.cardX - colX[col]) > 0.5 || Math.abs(n.cardTop - (ordered[0].cardTop + row * spacingY)) > 0.5)
          fail('stacking', `${name(n)} is not at row ${row}, column ${col} of ${name(mgr)}'s ${cols}-column stack`);
      });
      for (let c = 1; c < colX.length; c++) {
        if (!(colX[c - 1] < colX[c])) fail('stacking', `${name(mgr)}'s stack columns are not ordered left -> right`);
      }
    } else if (mode === 'compact' && team.some(n => n.isSubRowLower)) {
      const spacingX = view.signal('nodeSpacingX');
      const upperYs = new Set(team.filter(n => !n.isSubRowLower).map(n => n.cardTop));
      if (upperYs.size !== 1) fail('stacking', `compact upper sub-row of ${name(mgr)} spans ${upperYs.size} rows`);
      for (const n of team.filter(n => n.isSubRowLower)) {
        const prev = byId.get(n.prevLeafId);
        const expectedX = prev ? prev.cardX - (n.isShiftedSubRow ? spacingX / 2 : 0) : NaN;
        if (!prev || Math.abs(n.cardX - expectedX) > 0.5 || Math.abs(n.cardTop - (prev.cardTop + spacingY)) > 0.5)
          fail('stacking', `lower sub-row ${name(n)} is not aligned beneath ${prev ? name(prev) : n.prevLeafId}`);
      }
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
  if (!values && (sc.mode || (sc.stacking ? 'stacked' : 'standard')) !== 'standard' && sc.collapseDepth === 99 && stackedTeams === 0) {
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

function checkVersionMetadata() {
  const issues = [];
  const signalVersion = (baseSpec.signals.find(s => s.name === 'versionId') || {}).value;
  const metaVersion = baseSpec.usermeta && baseSpec.usermeta.version;
  const releaseDate = baseSpec.usermeta && baseSpec.usermeta.releaseDate;
  const desc = baseSpec.description || '';
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const norm = v => String(v || '').replace(/^v/, '');
  if (!signalVersion) issues.push('[version] signals.versionId.value is missing');
  if (!metaVersion) issues.push('[version] usermeta.version is missing');
  if (norm(signalVersion) !== norm(metaVersion)) {
    issues.push(`[version] signals.versionId (${signalVersion}) != usermeta.version (${metaVersion})`);
  }
  if (signalVersion && !desc.includes(signalVersion) && !desc.includes(norm(signalVersion))) {
    issues.push(`[version] description does not include ${signalVersion}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(releaseDate || ''))) {
    issues.push(`[version] usermeta.releaseDate (${releaseDate}) must be YYYY-MM-DD`);
  }
  const versionToken = signalVersion || metaVersion;
  if (versionToken && !readme.includes(versionToken) && !readme.includes(norm(versionToken))) {
    issues.push(`[version] README.md does not reference ${versionToken}`);
  }
  return issues;
}

function checkCaption() {
  const mark = baseSpec.marks.find(m => m.name === 'gestureHint');
  const issues = [];
  if (!mark) issues.push('[caption] gestureHint mark is missing');
  else {
    if (mark.interactive !== false) issues.push('[caption] gestureHint must be interactive:false so cards paint over it');
    const enc = (mark.encode && mark.encode.update) || {};
    if (!enc.x || !enc.y) issues.push('[caption] gestureHint needs canvas-anchored x/y');
  }
  return issues;
}

async function checkTooltip() {
  const mark = baseSpec.marks.find(m => m.name === 'cardBody');
  const expr = mark && mark.encode && mark.encode.update && mark.encode.update.tooltip && mark.encode.update.tooltip.signal;
  const issues = [];
  if (!expr || !expr.includes('showIdInTooltip')) issues.push('[tooltip] cardBody tooltip must be gated by the showIdInTooltip signal');
  if ((baseSpec.signals.find(s => s.name === 'showIdInTooltip') || {}).value !== false)
    issues.push('[tooltip] showIdInTooltip must default to false (IDs can be confidential)');
  if (!expr || !expr.includes('Direct Manager') || !expr.includes('managerName'))
    issues.push('[tooltip] cardBody tooltip must include Direct Manager via managerName lookup');
  if (!expr || !expr.includes('Reporting Line') || !expr.includes('managerLine'))
    issues.push('[tooltip] cardBody tooltip must include Reporting Line via managerLine lookup');
  if (!expr || !expr.includes('showReportingLineInTooltip'))
    issues.push('[tooltip] Reporting Line must be gated by showReportingLineInTooltip');
  if ((baseSpec.signals.find(s => s.name === 'showReportingLineInTooltip') || {}).value !== true)
    issues.push('[tooltip] showReportingLineInTooltip must default to true');
  if (expr && expr.includes("'Status':"))
    issues.push('[tooltip] Redundant UI "Status" field should be removed from tooltip');

  try {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    const view = new vega.View(vega.parse(spec), { renderer: 'none' });
    await view.runAsync();
    const cardMark = view.scenegraph().root.items[0].items.find(m => m.name === 'cardBody');
    const ceoItem = cardMark && cardMark.items.find(it => it.datum.rawDepth === 0);
    const vpItem = cardMark && cardMark.items.find(it => it.datum.id === '2');

    if (ceoItem && ceoItem.tooltip['Direct Manager'])
      issues.push('[tooltip] CEO must not have a Direct Manager in tooltip');
    if (ceoItem && ceoItem.tooltip['Reporting Line'])
      issues.push('[tooltip] CEO must not have a Reporting Line in tooltip');
    if (ceoItem && ceoItem.tooltip['Status'])
      issues.push('[tooltip] CEO tooltip must not contain "Status"');
    if (vpItem && vpItem.tooltip['Direct Manager'] !== 'Sarah Jenkins')
      issues.push(`[tooltip] VP Direct Manager [${vpItem ? vpItem.tooltip['Direct Manager'] : 'none'}] != 'Sarah Jenkins'`);
    if (vpItem && vpItem.tooltip['Reporting Line'])
      issues.push('[tooltip] Level 1 (VP) must not duplicate Direct Manager in Reporting Line');
    if (vpItem && vpItem.tooltip['Status'])
      issues.push('[tooltip] VP tooltip must not contain "Status"');

    // Test expanded tree for Level 2+ reporting lines
    const expSpec = JSON.parse(JSON.stringify(baseSpec));
    expSpec.signals.find(s => s.name === 'expandAllOverride').value = true;
    const expView = new vega.View(vega.parse(expSpec), { renderer: 'none' });
    await expView.runAsync();
    const expCards = expView.scenegraph().root.items[0].items.find(m => m.name === 'cardBody');
    const dirItem = expCards && expCards.items.find(it => it.datum.id === '5');
    const empItem = expCards && expCards.items.find(it => it.datum.id === '12');

    if (dirItem && dirItem.tooltip['Reporting Line'] !== 'David Chen → Sarah Jenkins')
      issues.push(`[tooltip] Director Reporting Line [${dirItem ? dirItem.tooltip['Reporting Line'] : 'none'}] != 'David Chen → Sarah Jenkins'`);
    if (empItem && empItem.tooltip['Reporting Line'] !== 'Alex Rivera → David Chen → Sarah Jenkins')
      issues.push(`[tooltip] Emp Reporting Line [${empItem ? empItem.tooltip['Reporting Line'] : 'none'}] != 'Alex Rivera → David Chen → Sarah Jenkins'`);

    // Test showReportingLineInTooltip = false gating
    const gatedSpec = JSON.parse(JSON.stringify(expSpec));
    gatedSpec.signals.find(s => s.name === 'showReportingLineInTooltip').value = false;
    const gatedView = new vega.View(vega.parse(gatedSpec), { renderer: 'none' });
    await gatedView.runAsync();
    const gatedCards = gatedView.scenegraph().root.items[0].items.find(m => m.name === 'cardBody');
    const gatedEmp = gatedCards && gatedCards.items.find(it => it.datum.id === '12');
    if (gatedEmp && gatedEmp.tooltip['Reporting Line'])
      issues.push('[tooltip] Reporting Line was present even when showReportingLineInTooltip was false');
  } catch (e) { issues.push(`[tooltip] threw: ${String(e.message || e).split('\n')[0]}`); }
  return issues;
}

function checkDblclick() {
  // Single-click on card selects/focuses the branch without shifting geometry.
  // Double-clicking card fits and centers the branch (@cardBody:dblclick).
  // Double-clicking canvas resets the view (@canvasBg:dblclick).
  // Toggle buttons must never listen to dblclick.
  const issues = [];
  for (const s of baseSpec.signals) {
    if (s.name !== 'panX' && s.name !== 'panY') continue;
    for (const h of s.on || []) {
      const ev = String(h.events || '');
      if (ev.includes('dblclick') && !ev.includes('@canvasBg:dblclick') && !ev.includes('@cardBody:dblclick'))
        issues.push(`[dblclick] ${s.name} listens to invalid dblclick mark (${ev})`);
    }
  }
  return issues;
}

async function checkAnchor() {
  // Simulates exactly what a toggle click does (state flip + anchor capture) and
  // requires the toggled node to stay pixel-identical across the re-layout.
  const issues = [];
  const fail = (m) => issues.push(`[anchor] ${m}`);
  try {
    const US = String.fromCharCode(31);
    const spec = JSON.parse(JSON.stringify(baseSpec));
    const view = new vega.View(vega.parse(spec), { renderer: 'none' });
    await view.runAsync();
    const pos = (id) => view.data('tree_nodes').find(n => n.id === id);
    if (!pos('2')) return ['[anchor] sample data missing node 2'];
    const snap = () => { const n = pos('2'); return { x: n.cardX, y: n.cardY }; };
    const arm = (p) => {
      view.signal('anchorId', '2'); view.signal('anchorX', p.x); view.signal('anchorY', p.y);
      view.signal('anchorZoom', view.signal('zoomLevel'));
    };
    const before = snap();
    view.signal('expandedIds', US + '2' + US); arm(before);
    await view.runAsync();
    let d = { x: Math.abs(pos('2').cardX - before.x), y: Math.abs(pos('2').cardY - before.y) };
    if (d.x > 1 || d.y > 1) fail(`expanding node 2 moved it by ${d.x.toFixed(1)},${d.y.toFixed(1)}px`);
    // press with active anchor (mousedown fold + clear): must not move anything
    const t0 = view.data('tree_nodes');
    if (t0.length && t0[0].anchorBaseX != null && view.signal('zoomLevel') === view.signal('anchorZoom'))
      view.signal('panX', view.signal('anchorX') - t0[0].anchorBaseX);
    if (t0.length && t0[0].anchorBaseY != null && view.signal('zoomLevel') === view.signal('anchorZoom'))
      view.signal('panY', view.signal('anchorY') - t0[0].anchorBaseY);
    view.signal('anchorId', null);
    await view.runAsync();
    d = { x: Math.abs(pos('2').cardX - before.x), y: Math.abs(pos('2').cardY - before.y) };
    if (d.x > 1 || d.y > 1) fail(`press with active anchor moved node 2 by ${d.x.toFixed(1)},${d.y.toFixed(1)}px`);
    const mid = snap();
    view.signal('expandedIds', US); arm(mid);
    await view.runAsync();
    d = { x: Math.abs(pos('2').cardX - mid.x), y: Math.abs(pos('2').cardY - mid.y) };
    if (d.x > 1 || d.y > 1) fail(`re-collapsing node 2 moved it by ${d.x.toFixed(1)},${d.y.toFixed(1)}px`);
  } catch (e) { fail(`threw: ${String(e.message || e).split('\n')[0]}`); }
  return issues;
}

async function checkBranchFit() {  // Replicates a card click on a VP with 6 visible reports: zoom must equal the
  // row's branchFitZ (unclamped for this fixture), every card must land in view,
  // and the subtree bbox must be centered (tolerance covers integer rounding).
  const issues = [];
  const fail = (m) => issues.push(`[branch] ${m}`);
  const US = String.fromCharCode(31);
  try {
    const vals = [
      { ID: '1', ParentID: null, Name: 'CEO', Title: 'c' },
      { ID: '2', ParentID: '1', Name: 'VP', Title: 'v' }
    ];
    for (let i = 0; i < 6; i++) vals.push({ ID: 'L' + i, ParentID: '2', Name: 'Leaf' + i, Title: 't' });
    const spec = JSON.parse(JSON.stringify(baseSpec));
    spec.data.find(d => d.name === 'dataset').values = vals;
    spec.signals.find(s => s.name === 'defaultCollapseDepth').value = 99;
    const view = new vega.View(vega.parse(spec), { renderer: 'none' });
    await view.runAsync();
    const W = view.signal('width'), H = view.signal('height');
    const d = view.data('card_nodes').find(n => n.id === '2');
    if (!d) return ['[branch] fixture missing node 2'];
    const cw0 = view.signal('cardWidth'), ch0 = view.signal('cardHeight');
    if (!(d.branchFitZ > 0.4 && d.branchFitZ < 1.6)) fail(`fixture is clamped (fitZoom ${d.branchFitZ}) - resize it`);
    view.signal('zoomLevel', d.branchFitZ);
    view.signal('panX', (d.branchFitZ * 165 / Math.max(1, cw0)) * ((d.maxX + d.minX) / 2 - (d.bMinX + d.bMaxX) / 2));
    view.signal('panY', H / 2 - view.signal('topMargin') - (d.branchFitZ * 165 / Math.max(1, cw0)) * ((d.bMinY + d.bMaxY) / 2 + ch0 / 2));
    view.signal('anchorId', null);
    await view.runAsync();
    const tn = view.data('tree_nodes'), cw = view.signal('cardWidth');
    const sub = tn.filter(n => n.id === '2' || (n.ancPath && n.ancPath.indexOf(US + '2' + US) >= 0));
    if (!sub.length) fail('no nodes in VP subtree');
    const bad = sub.filter(n => n.cardX < -3 || n.cardX + cw > W + 3 || n.cardTop < -3 || n.cardBottom > H + 3);
    if (bad.length) fail(`${bad.length} cards outside viewport after branch fit`);
    const xs = sub.flatMap(n => [n.cardX, n.cardX + cw]), ys = sub.flatMap(n => [n.cardTop, n.cardBottom]);
    const dx = Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - W / 2);
    const dy = Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - H / 2);
    if (dx > 3 || dy > 3) fail(`branch not centered (dx ${dx.toFixed(1)}, dy ${dy.toFixed(1)})`);
  } catch (e) { fail(`threw: ${String(e.message || e).split('\n')[0]}`); }
  return issues;
}

async function checkExtraFilter() {
  // Filter fixed on Extra 2: keep-set must be exactly matches + ancestors
  // (strict: non-matching descendants hide), links must stay real-manager,
  // clearing restores all.
  const issues = [];
  const fail = (m) => issues.push(`[filter] ${m}`);
  try {
    const vals = [
      { ID: '1', ParentID: null, Name: 'CEO', Title: 'c' },
      { ID: '2', ParentID: '1', Name: 'VP1', Title: 'v', 'Extra 2': 'Paris' },
      { ID: '3', ParentID: '2', Name: 'A1', Title: 't', 'Extra 2': 'Paris' },
      { ID: '4', ParentID: '2', Name: 'A2', Title: 't', 'Extra 2': 'Lyon' },
      { ID: '5', ParentID: '1', Name: 'VP2', Title: 'v', 'Extra 2': 'London' },
      { ID: '6', ParentID: '5', Name: 'B1', Title: 't', 'Extra 2': 'London' },
      { ID: '7', ParentID: '5', Name: 'B2', Title: 't', 'Extra 2': 'London' }
    ];
    const spec = JSON.parse(JSON.stringify(baseSpec));
    spec.data.find(d => d.name === 'dataset').values = vals;
    spec.signals.find(s => s.name === 'defaultCollapseDepth').value = 99;
    const view = new vega.View(vega.parse(spec), { renderer: 'none' });
    await view.runAsync();
    const distinct = view.data('extra_filter_values').map(d => d.Extra2_clean);
    if (JSON.stringify(distinct) !== JSON.stringify(['London', 'Lyon', 'Paris']))
      fail(`distinct values ${JSON.stringify(distinct)} != ["London","Lyon","Paris"]`);
    const ids = () => view.data('tree_nodes').map(n => n.id).sort().join(',');
    view.signal('extraFilterIdx', distinct.indexOf('Paris'));
    await view.runAsync();
    if (ids() !== '1,2,3') fail(`Paris filter visible [${ids()}] != [1,2,3] (A2 is Lyon: hidden in strict mode)`);
    if (view.signal('extraFilterValue') !== 'Paris') fail(`filter value ${view.signal('extraFilterValue')} != Paris`);
    const bad = view.data('tree_links').filter(l => (l.source || {}).id !== (l.target || l).parentId);
    if (bad.length) fail(`${bad.length} links do not point at the real manager`);
    view.signal('extraFilterIdx', distinct.indexOf('London'));
    await view.runAsync();
    if (ids() !== '1,5,6,7') fail(`London filter visible [${ids()}] != [1,5,6,7]`);
    view.signal('extraFilterIdx', -1);
    await view.runAsync();
    if (ids() !== '1,2,3,4,5,6,7') fail(`clearing filter visible [${ids()}] != full tree`);
  } catch (e) { fail(`threw: ${String(e.message || e).split('\n')[0]}`); }
  return issues;
}

async function checkBranchFocus() {
  // Focus mode: when focusedId is set, activeHighlightId and lineage lock to
  // the focused node, even if another node triggers hoveredId.
  const issues = [];
  const fail = (m) => issues.push(`[focus] ${m}`);
  try {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    const view = new vega.View(vega.parse(spec), { renderer: 'none' });
    await view.runAsync();
    const nodes = view.data('tree_nodes');
    const nodeA = nodes.find(n => n.id === '2');
    const nodeB = nodes.find(n => n.id === '3');
    if (!nodeA || !nodeB) fail('fixture missing test nodes');

    // Focus node A
    view.signal('focusedId', nodeA.id).signal('focusedAncPath', nodeA.ancPath);
    await view.runAsync();

    if (view.signal('activeHighlightId') !== nodeA.id)
      fail(`activeHighlightId ${view.signal('activeHighlightId')} != ${nodeA.id}`);

    // Simulate resting cursor over node B
    view.signal('hoveredId', nodeB.id).signal('hoveredAncPath', nodeB.ancPath);
    await view.runAsync();

    // activeHighlightId MUST stay locked to node A, ignoring hover on node B
    if (view.signal('activeHighlightId') !== nodeA.id)
      fail(`hover on node B hijacked activeHighlightId: got ${view.signal('activeHighlightId')}, expected ${nodeA.id}`);
    if (view.signal('activeHighlightAncPath') !== nodeA.ancPath)
      fail(`hover on node B hijacked activeHighlightAncPath`);

    // Verify gesture hint reflects active focus mode
    const hintMark = findMark(view.scenegraph().root, 'gestureHint');
    if (!hintMark || !hintMark.items.length || !hintMark.items[0].text.startsWith('◎ Focused on branch'))
      fail('gesture hint text did not update to indicate active focus mode');

    // Clear focus -> activeHighlightId must now revert to hoveredId (node B)
    view.signal('focusedId', null).signal('focusedAncPath', '');
    await view.runAsync();
    if (view.signal('activeHighlightId') !== nodeB.id)
      fail(`clearing focus did not revert activeHighlightId to hoveredId`);
  } catch (e) { fail(`threw: ${String(e.message || e).split('\n')[0]}`); }
  return issues;
}

async function checkFilterPill() {
  // Filter pill background, visibility guard, and anchor reset
  const issues = [];
  const fail = (m) => issues.push(`[filterPill] ${m}`);
  try {
    // 1. Dataset without Extra 2: filter pill marks must have opacity 0
    const noExtraVals = [
      { ID: '1', ParentID: null, Name: 'CEO', Title: 'c' },
      { ID: '2', ParentID: '1', Name: 'VP', Title: 'v' }
    ];
    const specNoExtra = JSON.parse(JSON.stringify(baseSpec));
    specNoExtra.data.find(d => d.name === 'dataset').values = noExtraVals;
    const viewNoExtra = new vega.View(vega.parse(specNoExtra), { renderer: 'none' });
    await viewNoExtra.runAsync();

    const pillBgNoExtra = findMark(viewNoExtra.scenegraph().root, 'filterPillBg');
    const pillShadowNoExtra = findMark(viewNoExtra.scenegraph().root, 'filterPillShadow');
    const filterBtnNoExtra = findMark(viewNoExtra.scenegraph().root, 'filterBtn');
    const filterTextNoExtra = findMark(viewNoExtra.scenegraph().root, 'filterText');

    if (!pillBgNoExtra || !pillBgNoExtra.items.length || pillBgNoExtra.items[0].opacity !== 0)
      fail('filterPillBg should have opacity 0 when Extra 2 is unmapped');
    if (!pillShadowNoExtra || !pillShadowNoExtra.items.length || pillShadowNoExtra.items[0].opacity !== 0)
      fail('filterPillShadow should have opacity 0 when Extra 2 is unmapped');
    if (!filterBtnNoExtra || !filterBtnNoExtra.items.length || filterBtnNoExtra.items[0].opacity !== 0)
      fail('filterBtn should have opacity 0 when Extra 2 is unmapped');
    if (!filterTextNoExtra || !filterTextNoExtra.items.length || filterTextNoExtra.items[0].opacity !== 0)
      fail('filterText should have opacity 0 when Extra 2 is unmapped');

    // 2. Dataset with Extra 2: filter pill marks must have opacity 1 and solid fill
    const withExtraVals = [
      { ID: '1', ParentID: null, Name: 'CEO', Title: 'c' },
      { ID: '2', ParentID: '1', Name: 'VP', Title: 'v', 'Extra 2': 'Dept A' }
    ];
    const specWithExtra = JSON.parse(JSON.stringify(baseSpec));
    specWithExtra.data.find(d => d.name === 'dataset').values = withExtraVals;
    const viewWithExtra = new vega.View(vega.parse(specWithExtra), { renderer: 'none' });
    await viewWithExtra.runAsync();

    const pillBgWithExtra = findMark(viewWithExtra.scenegraph().root, 'filterPillBg');
    if (!pillBgWithExtra || !pillBgWithExtra.items.length || pillBgWithExtra.items[0].opacity !== 1)
      fail('filterPillBg should have opacity 1 when Extra 2 is mapped');
    if (pillBgWithExtra.items[0].fill !== '#FFFFFF')
      fail(`filterPillBg fill ${pillBgWithExtra.items[0].fill} != #FFFFFF`);

    // 3. Anchor reset on filter click event
    const anchorSignal = baseSpec.signals.find(s => s.name === 'anchorId');
    const hasFilterClear = anchorSignal && anchorSignal.on && anchorSignal.on.some(
      h => h.events && h.events.includes('@filterBtn:click') && h.update === 'null'
    );
    if (!hasFilterClear) fail('anchorId signal missing @filterBtn:click clear event');
  } catch (e) { fail(`threw: ${String(e.message || e).split('\n')[0]}`); }
  return issues;
}

function checkAccordion() {
  const issues = [];
  const accSig = baseSpec.signals.find(s => s.name === 'accordionMode');
  if (!accSig || accSig.value !== true) issues.push('accordionMode signal missing or default != true');
  const btn = baseSpec.marks.find(m => m.name === 'accordionBtn');
  const txt = baseSpec.marks.find(m => m.name === 'accordionText');
  if (!btn || !txt) issues.push('accordionBtn or accordionText toolbar mark missing');
  const expSig = baseSpec.signals.find(s => s.name === 'expandedIds');
  const hasAcc = expSig && expSig.on && expSig.on.some(h => h.update && h.update.includes('accordionMode') && h.update.includes('ancList'));
  if (!hasAcc) issues.push('expandedIds toggle handler missing accordionMode sibling collapse');
  return issues;
}

(async () => {
  const ext = process.argv[2];
  const values = ext ? loadExternal(ext) : null;
  const scenarios = [];
  for (const mode of ['standard', 'compact']) {
    scenarios.push({ mode, collapseDepth: 1, zoom: 1, hover: false });
    for (const zoom of [1, 0.4, 1.6]) scenarios.push({ mode, collapseDepth: 99, zoom, hover: zoom === 1 });
  }
  if (!ext) {
    const fiftyDirectors = [
      { ID: '1', ParentID: null, Name: 'CEO', Title: 'CEO' },
      { ID: '2', ParentID: '1', Name: 'VP', Title: 'VP' }
    ];
    for (let i = 3; i <= 52; i++) {
      fiftyDirectors.push({ ID: String(i), ParentID: '2', Name: 'Dir ' + i, Title: 'Director' });
      fiftyDirectors.push({ ID: String(100 + i), ParentID: String(i), Name: 'Rep ' + i, Title: 'Eng' });
    }
    scenarios.push({ mode: 'compact', collapseDepth: 2, zoom: 1, hover: false, values: fiftyDirectors, tag: '50 collapsed dirs' });
    const fiftyLeaves = [{ ID: '1', ParentID: null, Name: 'CEO', Title: 'CEO' }, { ID: '2', ParentID: '1', Name: 'Dir', Title: 'Dir' }];
    for (let i = 3; i <= 52; i++) fiftyLeaves.push({ ID: String(i), ParentID: '2', Name: 'IC ' + i, Title: 'Eng' });
    scenarios.push({ mode: 'compact', collapseDepth: 99, zoom: 1, hover: false, values: fiftyLeaves, tag: '50 leaf reports' });
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
      { ID: '3', ParentID: '2', Name: 'A', Title: 't', 'Extra 1': 'Paris', 'Extra 2': 'FR', 'Extra 3': 'HQ' },
      { ID: '4', ParentID: '2', Name: 'B', Title: 't', 'Extra 1': 'Lyon' }
    ];
    scenarios.push({ stacking: false, collapseDepth: 99, zoom: 1, hover: true, values: EXTRA_ROWS, tag: 'extra fields' });
  }
  let total = 0;
  for (const sc of scenarios) {
    const mName = sc.mode || (sc.stacking ? 'stacked' : 'standard');
    const label = `${sc.tag ? sc.tag + ' | ' : ''}${mName.padEnd(8)} | ${sc.collapseDepth === 99 ? 'expanded ' : 'collapsed'} | zoom ${sc.zoom.toFixed(2)}`;
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
  const vm = checkVersionMetadata();
  total += vm.length;
  console.log(`${vm.length ? '✗' : '✓'} version metadata consistent across spec and README`);
  vm.forEach(i => console.log('    ' + i));
  const t = await checkTooltip();
  total += t.length;
  console.log(`${t.length ? '✗' : '✓'} tooltip includes Direct Manager, Reporting Line, Extra metadata & gated ID`);
  t.forEach(i => console.log('    ' + i));
  const dc = checkDblclick();
  total += dc.length;
  console.log(`${dc.length ? '✗' : '✓'} double-click scoped cleanly (card centers branch, canvas resets view)`);
  dc.forEach(i => console.log('    ' + i));
  const gc = checkCaption();
  total += gc.length;
  console.log(`${gc.length ? '✗' : '✓'} gesture hint caption present and non-interactive`);
  gc.forEach(i => console.log('    ' + i));
  const an = await checkAnchor();
  total += an.length;
  console.log(`${an.length ? '✗' : '✓'} toggled node stays pinned across re-layout`);
  an.forEach(i => console.log('    ' + i));
  const br = await checkBranchFit();
  total += br.length;
  console.log(`${br.length ? '✗' : '✓'} double-click fits branch in view, centered`);
  br.forEach(i => console.log('    ' + i));
  const fl = await checkExtraFilter();
  total += fl.length;
  console.log(`${fl.length ? '✗' : '✓'} Extra 2 filter keeps matches + hierarchy`);
  fl.forEach(i => console.log('    ' + i));
  const bf = await checkBranchFocus();
  total += bf.length;
  console.log(`${bf.length ? '✗' : '✓'} branch focus locks active lineage against resting hover`);
  bf.forEach(i => console.log('    ' + i));
  const fp = await checkFilterPill();
  total += fp.length;
  console.log(`${fp.length ? '✗' : '✓'} filter pill solid background, unmapped guard & anchor reset`);
  fp.forEach(i => console.log('    ' + i));
  const ac = checkAccordion();
  total += ac.length;
  console.log(`${ac.length ? '✗' : '✓'} accordion mode pill present (default on) & wired to sibling collapse`);
  ac.forEach(i => console.log('    ' + i));
  console.log(total ? `\nFAILED: ${total} issue(s)` : '\nAll layout checks passed.');
  process.exit(total ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
