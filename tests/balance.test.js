// balance.test.js — バランスゲームの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/balance.test.js

import assert from 'node:assert';
import {
  BLOCK_LIMIT,
  BLOCK_MAX,
  ACTIVE_LIMIT,
  continueRun,
  SHAPES,
  DIFFICULTY,
  createGame,
  nextShape,
  dropStarted,
  confirmPlaced,
  collapse,
  FIELD,
  fieldOf,
  BLOCK_SETS,
  shapesFor,
} from '../js/games/balance/game.js';
import { SEA_PIECES } from '../js/games/balance/sea.js';
import { isConvex, boundsOf, buildPieceBody } from '../js/games/balance/kit.js';
import { readFileSync } from 'node:fs';
import { text } from '../js/i18n.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ---------- 難易度のかたちセット ----------

{
  assert.deepStrictEqual(DIFFICULTY.easy, ['square', 'rect'], 'かんたんは四角のみ');
  assert.ok(DIFFICULTY.normal.includes('circle'), 'ふつうは丸が入る');
  assert.ok(DIFFICULTY.hard.includes('triangle') && DIFFICULTY.hard.includes('lshape'), 'むずかしいは三角・L字入り');
  for (const keys of Object.values(DIFFICULTY)) {
    for (const key of keys) assert.ok(SHAPES[key], `かたち${key}の定義がある`);
  }
  assert.strictEqual(BLOCK_LIMIT, 30, '上限30個（性能規定）');
}

// ---------- おとな: 床2倍・かたち10しゅ（v0.17.10） ----------

{
  const adult = DIFFICULTY.adult;
  for (const key of DIFFICULTY.hard) assert.ok(adult.includes(key), `おとなは むずかしいの${key}も出る`);
  for (const key of ['star', 'diamond', 'hexagon', 'trapezoid', 'semicircle']) {
    assert.ok(adult.includes(key), `おとなは${key}が出る`);
  }
  assert.strictEqual(new Set(adult).size, adult.length, 'かたちの重複なし');
  assert.strictEqual(fieldOf('adult').platformRatio, 2, 'おとなは床の幅2倍');
  assert.strictEqual(fieldOf('hard').platformRatio, 1, 'むずかしいまでは今までどおり');
  assert.strictEqual(fieldOf('unknown'), FIELD.easy, '知らない難易度はかんたん扱い');
  assert.deepStrictEqual(createGame({ difficulty: 'unknown' }).shapes, DIFFICULTY.easy);
  // 縮めて描いたとき、床が画面のはば（盤の54%×倍率×縮尺）の9割以内に収まる
  for (const [key, field] of Object.entries(FIELD)) {
    const onScreen = 0.54 * field.platformRatio * field.viewScale;
    assert.ok(onScreen <= 0.9, `${key}: 床が画面に収まる (${onScreen.toFixed(2)})`);
  }
  // かたちの名前は全部 i18n にあり、ひらがな・カタカナだけ
  for (const key of Object.keys(SHAPES)) {
    const name = text.shapes[key];
    assert.ok(name && /^[ぁ-んァ-ヶー]+$/.test(name), `${key}の名前「${name}」はかなだけ`);
  }
  const state = createGame({ difficulty: 'adult', rng: makeRng([0.99]) });
  assert.strictEqual(nextShape(state), 'semicircle', 'おとなの末尾のかたちも出る');
}

// ---------- 次のかたちはrngで決まる ----------

{
  const state = createGame({ difficulty: 'hard', rng: makeRng([0.0, 0.99, 0.5]) });
  assert.strictEqual(nextShape(state), 'square', 'rng=0で先頭');
  assert.strictEqual(nextShape(state), 'lshape', 'rng=0.99で末尾');
}

// ---------- ひとり: スコアと30こクリア ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'solo' });
  for (let i = 1; i < BLOCK_LIMIT; i++) {
    dropStarted(state);
    const result = confirmPlaced(state);
    assert.strictEqual(result.placed, i);
    assert.strictEqual(result.cleared, false);
  }
  dropStarted(state);
  const last = confirmPlaced(state);
  assert.strictEqual(last.placed, 30);
  assert.strictEqual(last.cleared, true, '30こでクリア');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(confirmPlaced(state).ok, false, '終了後は積めない');
}

// ---------- 30こクリアのあと「つづけて つむ」（v0.17.11） ----------

{
  assert.ok(ACTIVE_LIMIT <= 30, '動くブロックは30こまで（性能規定）');
  const place = (state) => { dropStarted(state); return confirmPlaced(state); };
  const state = createGame({ mode: 'solo' });
  assert.strictEqual(continueRun(state), false, 'クリア前は つづけられない（遊んでいる途中）');
  for (let i = 0; i < BLOCK_LIMIT; i++) place(state);
  assert.ok(state.finished && state.cleared, '30こでクリアの区切り');
  assert.strictEqual(continueRun(state), true, 'つづけて つむ');
  assert.strictEqual(state.finished, false);
  assert.strictEqual(state.endless, true);
  assert.strictEqual(continueRun(state), false, '2回目の つづける はない');
  const r31 = place(state);
  assert.strictEqual(r31.placed, 31, '31こめから数えつづける');
  assert.strictEqual(state.finished, false, '31こでは終わらない');
  const c = collapse(state);
  assert.strictEqual(c.placed, 31, '崩れたら積めた数が きろく');
  assert.strictEqual(state.cleared, true, 'クリアした事実は残る');

  // こうたい: 手番は続き、崩した人の負け
  const two = createGame({ mode: 'two' });
  for (let i = 0; i < BLOCK_LIMIT; i++) place(two);
  continueRun(two);
  assert.strictEqual(two.currentPlayer, 0, '30こ（偶数）のあとは あか の番');
  place(two);
  dropStarted(two); // あお が落として崩れた
  assert.strictEqual(collapse(two).loser, 1);

  // 上限 BLOCK_MAX で終わり
  const big = createGame({ mode: 'solo' });
  for (let i = 0; i < BLOCK_LIMIT; i++) place(big);
  continueRun(big);
  let last;
  while (!big.finished) last = place(big);
  assert.strictEqual(last.placed, BLOCK_MAX);
  assert.strictEqual(big.maxed, true, `${BLOCK_MAX}こで積みきり`);
  assert.strictEqual(confirmPlaced(big).ok, false);
}

// ---------- ひとり: 崩れたら終了（スコアは積めた数のまま） ----------

{
  const state = createGame({ mode: 'solo' });
  dropStarted(state);
  confirmPlaced(state);
  dropStarted(state);
  const result = collapse(state); // 2個目が落ちた
  assert.strictEqual(result.placed, 1, 'スコアは確定済みの1個');
  assert.strictEqual(result.loser, null, 'ひとりプレイに負けはない');
  assert.strictEqual(state.finished, true);
}

// ---------- こうたい: 手番交代と「崩した方が負け」 ----------

{
  const state = createGame({ mode: 'two' });
  assert.strictEqual(state.currentPlayer, 0, 'あかから');
  dropStarted(state);
  confirmPlaced(state);
  assert.strictEqual(state.currentPlayer, 1, '交代してあお');
  dropStarted(state);
  assert.strictEqual(state.lastPlacer, 1, '落とした責任者はあお');
  const result = collapse(state); // あおのブロックで崩れた
  assert.strictEqual(result.loser, 1, '崩したあおの負け');

  // あかが崩すパターン
  const state2 = createGame({ mode: 'two' });
  dropStarted(state2);
  confirmPlaced(state2); // あか→あお
  dropStarted(state2);
  confirmPlaced(state2); // あお→あか
  dropStarted(state2);
  assert.strictEqual(collapse(state2).loser, 0, '崩したあかの負け');
}

// ---------- うみの いきもの つみき（v0.17.12） ----------

{
  // 「かたち」はいままでどおり（つみき未指定・知らない値もかたち）
  assert.deepStrictEqual(createGame({ difficulty: 'hard' }).shapes, DIFFICULTY.hard);
  assert.deepStrictEqual(shapesFor('shape', 'adult'), DIFFICULTY.adult);
  assert.deepStrictEqual(shapesFor('???', 'easy'), DIFFICULTY.easy);
  assert.deepStrictEqual(shapesFor('sea', '???'), BLOCK_SETS.sea.easy, '知らない難易度は かんたん');

  const sea = BLOCK_SETS.sea;
  assert.deepStrictEqual(createGame({ difficulty: 'normal', blocks: 'sea' }).shapes, sea.normal);
  assert.strictEqual(sea.adult.length, 14, 'おとなは14しゅ ぜんぶ');
  assert.strictEqual(Object.keys(SEA_PIECES).length, 14);
  // 難易度が上がるほど顔ぶれが増える（前の難易度の子はぜんぶ残る）
  const order = ['easy', 'normal', 'hard', 'adult'];
  for (let i = 1; i < order.length; i++) {
    const prev = sea[order[i - 1]];
    const cur = sea[order[i]];
    assert.ok(cur.length > prev.length, `${order[i]} は ${order[i - 1]} より多い`);
    for (const id of prev) assert.ok(cur.includes(id), `${order[i]} にも ${id}`);
  }

  // まだ積んでいない いきものも含めて、ぜんぶの形をしらべる
  const kana = /^[ぁ-んァ-ヶー]+$/;
  for (const [id, piece] of Object.entries(SEA_PIECES)) {
    assert.ok(sea.adult.includes(id), `${id} がどこかの難易度で出る`);
    assert.ok(kana.test(text.sea[id]), `${id} の名前はひらがな・カタカナのみ: ${text.sea[id]}`);
    assert.ok(piece.color && piece.line && typeof piece.draw === 'function');
    for (const part of piece.parts) {
      if (part.circle) {
        assert.ok(part.circle[2] > 0);
        continue;
      }
      // 当たり判定は凸の部品だけ（へこんだ部品はMatterで正しくぶつからない）
      assert.ok(isConvex(part.points), `${id} の部品が凸: ${JSON.stringify(part.points)}`);
      for (let i = 0; i < part.points.length; i++) {
        const a = part.points[i];
        const b = part.points[(i + 1) % part.points.length];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.4, `${id} に長さ0の辺がない`);
      }
    }
    // 大きさ: いままでの かたち（46〜78px）と同じくらい。落とす前の表示（上から52px）に収まる
    const box = boundsOf(piece);
    assert.ok(box.w >= 36 && box.w <= 100, `${id} の横はば ${box.w}`);
    assert.ok(box.h >= 30 && box.h <= 80, `${id} の高さ ${box.h}`);
    assert.ok(-box.minY <= 45, `${id} が上にはみ出さない`);

    // 絵を描いても止まらない（ctxのにせもので全部の命令を受けとめる）
    const calls = [];
    const fakeCtx = new Proxy({}, {
      get: (_, key) => (...args) => calls.push([key, args]),
      set: () => true,
    });
    piece.draw(fakeCtx, piece);
    assert.ok(calls.length > 10, `${id} の絵が描かれる`);
    for (const [, args] of calls) {
      for (const v of args) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${id} の絵の数字がこわれていない`);
    }
  }
  // 「かたち」の名前と いきものの名前が i18n にある（メニュー文言も）
  for (const key of ['balanceBlocksLabel', 'balanceBlocksShape', 'balanceBlocksSea']) {
    assert.ok(kana.test(text[key].replace(/ /g, '')), `${key} はひらがな・カタカナのみ`);
  }
}

// ---------- 物理: どの いきものも、まんなかに落とせば 床の上で止まる（v0.17.12） ----------
// （ui.js と同じ重力・反復回数・床の大きさ。ころがり続けて勝手に落ちる子がいないこと）

{
  const code = readFileSync(new URL('../lib/matter.min.js', import.meta.url), 'utf8');
  const holder = { exports: {} };
  new Function('module', 'exports', code)(holder, holder.exports);
  const M = holder.exports;

  for (const [id, piece] of Object.entries(SEA_PIECES)) {
    const engine = M.Engine.create({ enableSleeping: true });
    engine.gravity.y = 0.75;
    engine.positionIterations = 12;
    engine.velocityIterations = 8;
    const W = 343;
    const H = 430;
    const groundY = H - 26;
    const platform = M.Bodies.rectangle(W / 2, groundY, Math.round(W * 0.54), 18, { isStatic: true, friction: 1 });
    const { body, offset } = buildPieceBody(M, piece, W / 2, 52);
    assert.ok(Number.isFinite(offset.x) && Number.isFinite(offset.y));
    M.Composite.add(engine.world, [platform, body]);
    for (let f = 0; f < 600; f++) M.Engine.update(engine, 1000 / 60);
    const drift = Math.abs(body.position.x - W / 2);
    assert.ok(body.position.y < groundY, `${id} が床の上にいる（y=${body.position.y.toFixed(0)}）`);
    assert.ok(drift < 30, `${id} が ころがって行かない（ずれ ${drift.toFixed(0)}px）`);
    assert.ok(body.isSleeping, `${id} が10びょう以内に止まる`);
  }
}

console.log('balance.test.js: すべてのテストに合格');
