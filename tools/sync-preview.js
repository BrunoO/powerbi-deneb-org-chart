#!/usr/bin/env node
// Copies deneb-org-chart.json into the `const spec = {...};` block of preview.html.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const spec = fs.readFileSync(path.join(root, 'deneb-org-chart.json'), 'utf8').trim();
JSON.parse(spec); // fail fast on invalid JSON
const htmlPath = path.join(root, 'preview.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const spec = ');
const end = html.indexOf('\n};', start);
if (start < 0 || end < 0) throw new Error('Embedded spec block not found in preview.html');
fs.writeFileSync(htmlPath, html.slice(0, start) + 'const spec = ' + spec + ';' + html.slice(end + 3));
console.log('preview.html updated from deneb-org-chart.json');
