// sw.test.js — Service Worker のプリキャッシュ一覧とバージョンの整合性テスト
// 実行方法: node tests/sw.test.js
// ①VERSION が app.js の APP_VERSION と一致 ②一覧のファイルが全部存在 ③リポジトリの js/css に漏れがない ④manifest/index の参照先が存在

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
const appVersion = app.match(/const APP_VERSION = '([^']+)'/)[1];
assert.strictEqual(swVersion, appVersion, `sw.js の VERSION(${swVersion}) と app.js の APP_VERSION(${appVersion}) をそろえる`);

const listSource = sw.slice(sw.indexOf('const PRECACHE = ['), sw.indexOf('];', sw.indexOf('const PRECACHE = [')));
const precache = [...listSource.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
assert.ok(precache.length > 60, 'プリキャッシュ一覧が読めている');

// ② 存在確認
for (const entry of precache) {
  if (entry === './') continue;
  assert.ok(fs.existsSync(path.join(root, entry)), `プリキャッシュのファイルが無い: ${entry}`);
}

// ③ 漏れ確認: js/ css/ lib/ の全ファイルが一覧にある（sw.js 自身は除く）
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`],
  );
}
const required = ['js', 'css', 'lib', 'assets'].flatMap((d) => walk(d)).map((f) => `./${f}`);
for (const file of required) {
  assert.ok(precache.includes(file), `sw.js のプリキャッシュ一覧に追加が必要: ${file}`);
}
assert.ok(precache.includes('./index.html') && precache.includes('./manifest.webmanifest'));

// ④ manifest と index.html の参照
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.orientation, 'portrait');
for (const icon of manifest.icons) {
  assert.ok(fs.existsSync(path.join(root, icon.src)), `アイコンが無い: ${icon.src}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.includes('rel="manifest"'), 'index.html に manifest リンク');
assert.ok(html.includes('rel="apple-touch-icon"'), 'index.html に apple-touch-icon');
assert.ok(!/fetch\(|XMLHttpRequest|<script[^>]+src="http/.test(app), 'app.js に外部通信なし');

console.log('sw.test.js: all passed');
