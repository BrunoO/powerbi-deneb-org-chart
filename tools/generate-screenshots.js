const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const specPath = path.join(rootDir, 'deneb-org-chart.json');
const vegaJsPath = path.join(rootDir, 'node_modules/vega/build/vega.min.js');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const vegaJs = fs.readFileSync(vegaJsPath, 'utf8');

const scenes = [
  {
    name: 'org-chart-overview',
    title: 'Executive Overview',
    width: 1730,
    height: 370,
    signals: {
      enableStacking: false,
      zoomLevel: 0.70,
      panX: 0,
      panY: 0,
      expandedIds: '',
      collapsedIds: '',
      focusedId: null,
      focusedAncPath: '',
      hoveredId: null,
      hoveredAncPath: ''
    }
  },
  {
    name: 'org-chart-hover-lineage',
    title: 'Active Reporting-Line Highlighting & Branch Focus Mode',
    width: 2330,
    height: 490,
    signals: {
      enableStacking: false,
      zoomLevel: 0.85,
      panX: 420,
      panY: -5,
      expandedIds: '\u001F2\u001F6\u001F',
      collapsedIds: '',
      focusedId: '18',
      focusedAncPath: '\u001F1\u001F2\u001F6\u001F18\u001F',
      hoveredId: '18',
      hoveredAncPath: '\u001F1\u001F2\u001F6\u001F18\u001F'
    }
  },
  {
    name: 'org-chart-stacked-mode',
    title: 'Compact 2-Column Stacking',
    width: 2480,
    height: 770,
    signals: {
      enableStacking: true,
      zoomLevel: 0.70,
      panX: 470,
      panY: -30,
      expandedIds: '\u001F2\u001F5\u001F6\u001F7\u001F20\u001F21\u001F',
      collapsedIds: '',
      focusedId: null,
      focusedAncPath: '',
      hoveredId: null,
      hoveredAncPath: ''
    }
  }
];

function generateHtml(scene) {
  const baseSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  baseSpec.signals = baseSpec.signals.map(s => {
    if (s.name === 'minCanvasWidth') return { ...s, value: scene.width };
    if (s.name === 'minCanvasHeight') return { ...s, value: scene.height };
    if (scene.signals[s.name] !== undefined) {
      const copy = { ...s };
      copy.value = scene.signals[s.name];
      if (s.update && !['width', 'height', 'toolbarOriginX', 'activeHighlightId', 'activeHighlightAncPath'].includes(s.name)) {
        delete copy.update;
      }
      return copy;
    }
    return s;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${scene.width}px;
      height: ${scene.height}px;
      overflow: hidden;
      background-color: #f8fafc;
      background-image: radial-gradient(#cbd5e1 1.25px, transparent 1.25px);
      background-size: 20px 20px;
    }
    #vis {
      width: ${scene.width}px;
      height: ${scene.height}px;
      display: block;
    }
  </style>
  <script>${vegaJs}</script>
</head>
<body>
  <div id="vis"></div>
  <script>
    const spec = ${JSON.stringify(baseSpec)};
    const view = new vega.View(vega.parse(spec), {
      renderer: 'svg',
      container: '#vis',
      hover: true
    });
    view.runAsync().then(() => {
      window.__VEGA_DONE__ = true;
    });
  </script>
</body>
</html>`;
}

function run() {
  const tmpDir = path.join('/tmp', 'deneb-screenshots');
  fs.mkdirSync(tmpDir, { recursive: true });

  const outDir = process.argv.includes('--apply')
    ? path.join(rootDir, 'images')
    : path.join('/tmp', 'screenshots-preview');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Generating screenshots to ${outDir}...`);

  for (const scene of scenes) {
    const htmlContent = generateHtml(scene);
    const htmlFile = path.join(tmpDir, `${scene.name}.html`);
    fs.writeFileSync(htmlFile, htmlContent, 'utf8');

    const outFile = path.join(outDir, `${scene.name}.png`);

    console.log(`Rendering ${scene.name} (${scene.width}x${scene.height} @ 2x)...`);
    execFileSync(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--user-data-dir=/tmp/chrome-screenshot-user-data',
      '--force-device-scale-factor=2',
      `--window-size=${scene.width},${scene.height}`,
      '--virtual-time-budget=3000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${outFile}`,
      `file://${htmlFile}`
    ], { stdio: 'pipe' });

    console.log(`  -> Saved ${outFile}`);
  }
  console.log('Done!');
}

run();
