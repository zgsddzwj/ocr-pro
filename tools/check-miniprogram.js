'use strict';

// 小程序静态校验（小程序端没有编译器，用它兜底）
// 用法: node tools/check-miniprogram.js
// 检查项：页面文件齐全、WXML 标签配对、事件处理函数存在、模板引用的 data 字段存在
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'miniprogram');
const VOID_TAGS = new Set(['input', 'image', 'icon', 'progress', 'slider', 'switch', 'import', 'include', 'wxs', 'camera', 'open-data', 'web-view', 'ad', 'official-account', 'live-player', 'live-pusher', 'voip-room', 'navigator', 'audio', 'video']);

let problems = 0;
let warnings = 0;

function fail(message) {
  console.log(`  ✗ ${message}`);
  problems += 1;
}

function warn(message) {
  console.log(`  ! ${message}`);
  warnings += 1;
}

function checkTags(xml, file) {
  const stack = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(xml))) {
    const [, closing, name, , selfClosing] = match;
    if (selfClosing || VOID_TAGS.has(name)) continue;
    if (closing) {
      const open = stack.pop();
      if (open !== name) fail(`${file}: 结束标签 </${name}> 与 <${open || '无'}> 不匹配`);
    } else {
      stack.push(name);
    }
  }
  if (stack.length) fail(`${file}: 存在未闭合标签 ${stack.join(', ')}`);
}

function checkHandlers(xml, js, file) {
  const handlers = new Set();
  const pattern = /\b(?:bind|catch|capture-bind|capture-catch)[\w:-]*\s*=\s*"([A-Za-z_$][\w$]*)"/g;
  let match;
  while ((match = pattern.exec(xml))) handlers.add(match[1]);
  for (const handler of handlers) {
    if (!new RegExp(`(^|[^\\w$])${handler}\\s*\\(`, 'm').test(js)) {
      fail(`${file}: wxml 绑定了 ${handler}，但 js 中没有这个方法`);
    }
  }
}

function checkDataRefs(xml, js, file) {
  const keys = new Set(['item', 'index', 'true', 'false', 'null', 'undefined']);
  const dataBlock = js.match(/data:\s*\{([\s\S]*?)\n  \}/);
  if (dataBlock) {
    for (const match of dataBlock[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) keys.add(match[1]);
  }
  for (const match of js.matchAll(/setData\(\{\s*'?([A-Za-z_$][\w$]*)/g)) keys.add(match[1]);

  const expressions = new Set();
  let match;
  const expressionPattern = /\{\{([^}]*)\}\}/g;
  while ((match = expressionPattern.exec(xml))) expressions.add(match[1]);

  for (const expression of expressions) {
    // 先剥离引号字符串字面量，避免把 'strong brand' 这类类名当变量误报
    const cleaned = expression.replace(/'[^']*'|"[^"]*"/g, ' ');
    for (const identifier of cleaned.matchAll(/(^|[^.\w$'"])([A-Za-z_$][\w$]*)/g)) {
      const name = identifier[2];
      if (keys.has(name) || VOID_TAGS.has(name)) continue;
      warn(`${file}: 模板引用了 data 中可能不存在的字段 {{${name}}}`);
    }
  }
}

console.log('小程序静态校验');

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

for (const page of appJson.pages) {
  const base = path.join(ROOT, page);

  for (const ext of ['.js', '.wxml', '.json', '.wxss']) {
    if (!fs.existsSync(`${base}${ext}`)) fail(`缺少文件 ${page}${ext}`);
  }

  const wxmlPath = `${base}.wxml`;
  const jsPath = `${base}.js`;
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) continue;

  const xml = fs.readFileSync(wxmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  checkTags(xml, `${page}.wxml`);
  checkHandlers(xml, js, `${page}.wxml`);
  checkDataRefs(xml, js, `${page}.wxml`);
}

const pagesDir = path.join(ROOT, 'pages');
for (const dir of fs.readdirSync(pagesDir)) {
  const page = `pages/${dir}/${dir}`;
  if (!appJson.pages.includes(page)) fail(`${page} 未在 app.json 中注册`);
}

console.log(`\n问题 ${problems} 个，提示 ${warnings} 条`);
if (problems > 0) process.exitCode = 1;
