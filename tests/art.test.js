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
const ids = homeGroups.flatMap((g) => g.ids);
assert.strictEqual(new Set(ids).size, ids.length, 'homeGroupsに重複なし');
assert.deepStrictEqual([...ids].sort(), games.map((g) => g.id).sort(), 'homeGroupsが全ゲームを含む');
console.log('art.test.js: all passed');
