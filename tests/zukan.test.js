// zukan.test.js — ずかん画（js/zukan/）の データと 絵の 検査（v0.19.0。別冊05 §7）
// 実行方法: node tests/zukan.test.js
// ①いままでの なかまの ID が ぜんぶ ある（ずかんの 記録が 消えない） ②文字は ひらがな・カタカナ・すうじ だけ
// ③見分けポイントが 2つ いじょう ④なかま・にている 相手が 正しい ⑤描いても エラーが 出ない・はこの 中に おさまる

import assert from 'node:assert';
import { BLOCK_SETS } from '../js/games/balance/game.js';
import { loadZukanSet, makeSet, hasZukanArt } from '../js/zukan/registry.js';
import * as insectCatalog from '../js/zukan/catalog/insect.js';
import { ZUKAN_TEXT as insectText } from '../js/i18n/zukan/insect.js';

const KANJI = /[一-鿿㐀-䶿]/;

// 描いた 点を あつめる にせの キャンバス（はこから はみだして いないか 見る）
function fakeCtx() {
  const pts = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const push = (x, y) => pts.push([m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  const grad = { addColorStop() {} };
  const ctx = {
    pts,
    save() { stack.push(m.slice()); },
    restore() { m = stack.pop() ?? [1, 0, 0, 1, 0, 0]; },
    scale(sx, sy) { m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]; },
    translate(tx, ty) { m = [m[0], m[1], m[2], m[3], m[0] * tx + m[2] * ty + m[4], m[1] * tx + m[3] * ty + m[5]]; },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    moveTo: push,
    lineTo: push,
    bezierCurveTo(a, b, c, d, x, y) { push(x, y); },
    arc(x, y, r) { push(x - r, y - r); push(x + r, y + r); },
    ellipse(x, y, rx, ry) { const r = Math.max(rx, ry); push(x - r, y - r); push(x + r, y + r); },
    fillRect() {},
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
  };
  for (const k of ['beginPath', 'closePath', 'fill', 'stroke', 'clip']) ctx[k] = () => {};
  return ctx;
}

function checkSet(set, catalog, words) {
  const z = makeSet(catalog, words);
  const ids = z.ids;
  const old = BLOCK_SETS[set].adult;
  for (const id of old) assert.ok(ids.includes(id), `${set}: いままでの ID ${id} が ずかん画に ない（記録が 消える）`);
  // かんたん〜おとなの 顔ぶれも ぜんぶ 描ける
  for (const level of ['easy', 'normal', 'hard', 'adult']) for (const id of BLOCK_SETS[set][level]) assert.ok(z.art(id), `${set}/${level}: ${id}`);

  for (const g of catalog.GROUPS) {
    assert.ok(words.groups[g], `${set}: なかまの 名前 ${g}`);
    assert.ok(!KANJI.test(words.groups[g]), `${set}: 漢字なし ${words.groups[g]}`);
  }
  const names = new Set();
  for (const id of ids) {
    const sp = catalog.SPECIES[id];
    const info = words.species[id];
    assert.ok(info, `${set}: ${id} の 文字が ない`);
    assert.ok(catalog.GROUPS.includes(sp.group), `${id}: なかま ${sp.group}`);
    assert.ok([1, 2, 3].includes(sp.level), `${id}: level`);
    assert.ok(Array.isArray(sp.similar) && sp.similar.length >= 1, `${id}: にている なかま`);
    for (const other of sp.similar) {
      assert.ok(catalog.SPECIES[other], `${id}: にている ${other} が いない`);
      assert.notStrictEqual(other, id, `${id}: 自分を にている に 入れない`);
    }
    // 名前は カタカナ（のばす ぼう・なかぐろ・かっこ つき）
    assert.ok(/^[ァ-ヶー・（）]+$/.test(info.name), `${id}: 名前は カタカナ ${info.name}`);
    assert.ok(!names.has(info.name), `${id}: 名前が かさなる ${info.name}`);
    names.add(info.name);
    assert.ok(info.marks.length >= 2, `${id}: 見分けポイントは 2つ いじょう`);
    for (const str of [info.name, info.size, info.where, ...info.marks]) {
      assert.ok(typeof str === 'string' && str.length > 0, `${id}: 文字が からっぽ`);
      assert.ok(!KANJI.test(str), `${id}: 漢字を つかわない「${str}」`);
    }
    // 描く: エラーなし・点が はこ（＋すこしの ゆとり）に おさまる
    const art = z.art(id);
    assert.ok(art.w > 0 && art.h > 0, `${id}: はこ`);
    const ctx = fakeCtx();
    art.draw(ctx);
    assert.ok(ctx.pts.length > 50, `${id}: なにか 描いている`);
    const slack = 6;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of ctx.pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    assert.ok(x0 >= art.minX - slack && x1 <= art.minX + art.w + slack && y0 >= art.minY - slack && y1 <= art.minY + art.h + slack,
      `${id}: はこから はみだす（描いた はんい ${x0.toFixed(0)},${y0.toFixed(0)}〜${x1.toFixed(0)},${y1.toFixed(0)}）`);
    // はこが 大きすぎても 絵が 小さく なる
    assert.ok(x1 - x0 >= art.w * 0.85 && y1 - y0 >= art.h * 0.85, `${id}: はこが 大きすぎる（描いた はんい ${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)}、はこ ${art.w}×${art.h}）`);
  }
  return ids.length;
}

assert.ok(hasZukanArt('insect'));
assert.ok(!hasZukanArt('pref'), 'ちずは ずかん画に しない');
const n = checkSet('insect', insectCatalog, insectText);
assert.strictEqual(n, 30);

// 読みこみ（import()）で 同じ ものが とれる。2回目は 同じ もの（もう一度 読まない）
const a = await loadZukanSet('insect');
const b = await loadZukanSet('insect');
assert.strictEqual(a, b);
assert.strictEqual(a.name('ladybug'), 'ナナホシテントウ');
assert.strictEqual(await loadZukanSet('pref'), null);

console.log(`zukan.test.js: all passed (insect ${n})`);
