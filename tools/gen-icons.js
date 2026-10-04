'use strict';

// 生成 miniprogram/utils/icons.js（内联 SVG 图标，base64 data URI）
// 改图标后运行: node tools/gen-icons.js
const fs = require('node:fs');
const path = require('node:path');

const COLORS = {
  white: '#FFFFFF',
  green: '#1E6F43',
  gray: '#9AA6A0',
  red: '#C2453D',
  amber: '#B45309',
};

const GLYPHS = {
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  history: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  idcard: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="11" r="2.5"/><path d="M5.5 16.5c.8-1.6 1.9-2.3 2.5-2.3s1.7.7 2.5 2.3"/><line x1="14" y1="9.5" x2="18.5" y2="9.5"/><line x1="14" y1="13" x2="18.5" y2="13"/><line x1="14" y1="16.5" x2="16.5" y2="16.5"/>',
};

// 导出名 -> [图形, 颜色]
const EXPORTS = {
  camera: ['camera', 'white'],
  settingsWhite: ['settings', 'white'],
  settings: ['settings', 'green'],
  history: ['history', 'green'],
  copy: ['copy', 'green'],
  copyWhite: ['copy', 'white'],
  download: ['download', 'green'],
  image: ['image', 'green'],
  refresh: ['refresh', 'green'],
  search: ['search', 'gray'],
  trash: ['trash', 'red'],
  warn: ['warn', 'amber'],
  idcard: ['idcard', 'green'],
  idcardWhite: ['idcard', 'white'],
};

function build(name, glyph, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph]}</svg>`;
  return `  ${name}: 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}',`;
}

const body = Object.entries(EXPORTS)
  .map(([name, [glyph, color]]) => build(name, glyph, COLORS[color]))
  .join('\n');

const content = `// 图标资源：内联 SVG（base64 data URI），由 tools/gen-icons.js 生成，请勿手改
module.exports = {
${body}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'icons.js'), content);
console.log(`已生成 miniprogram/utils/icons.js（${Object.keys(EXPORTS).length} 个图标）`);
