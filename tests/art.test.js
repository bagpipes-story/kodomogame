// art.test.js — 自前SVG絵素材（art.js）の整合性テスト
// 実行方法: node tests/art.test.js
// ①絵文字扱いの単語（どうぶつ・くだもの・からだ）全部にSVGがある ②ホームの14ゲーム全部にある
// ③外部参照なし（http/url()）④id重複なし ⑤homeGroups が全ゲームを1回ずつ含む

import assert from 'node:assert';
import { ART, hasArt } from '../js/art.js';
import { WORDS } from '../js/words.js';
import { games, homeGroups } from '../js/i18n.js';

for (const w of WORDS.filter((x) => x.kind === 'emoji')) {
  assert.ok(hasArt(w.id), `SVGが無い単語: ${w.id}`);
}
for (const g of games) {
  assert.ok(hasArt(g.id), `SVGが無いゲーム: ${g.id}`);
}
for (const [id, svg] of Object.entries(ART)) {
  assert.ok(!/https?:|url\(|<script|<image/i.test(svg), `外部参照・スクリプトを含まない: ${id}`);
  assert.ok(svg.trim().startsWith('<'), `SVGの中身がある: ${id}`);
}
// ゲーム内で使うUI部品のSVG（絵文字を置き換えたもの）が全部ある
for (const id of ['moleChar', 'butterfly', 'robot', 'speaker', 'soundOn', 'soundOff', 'stampBook', 'tea', 'star', 'joker', 'smile', 'bear', 'rabbit', 'chick', 'redDot', 'blueDot']) {
  assert.ok(hasArt(id), `UI部品のSVGが無い: ${id}`);
}
// 表示用コードに絵文字が残っていない（words.js の value=フォールバック と art.js は除く）
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const emoji = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2B50}\u{2B55}\u{2705}\u{274C}\u{1F600}-\u{1F64F}]/u;
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
}
for (const file of [...walk('js'), 'index.html']) {
  if (file.endsWith('words.js') || file.endsWith('art.js')) continue;
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('<!--')) return;
    if (file.endsWith('i18n.js') && line.includes('icon:')) return; // フォールバック用の絵文字
    assert.ok(!emoji.test(line), `表示コードに絵文字が残っている: ${file}:${i + 1}`);
  });
}

const ids = homeGroups.flatMap((g) => g.ids);
assert.strictEqual(new Set(ids).size, ids.length, 'homeGroupsに重複なし');
assert.deepStrictEqual([...ids].sort(), games.map((g) => g.id).sort(), 'homeGroupsが全ゲームを含む');
console.log('art.test.js: all passed');
