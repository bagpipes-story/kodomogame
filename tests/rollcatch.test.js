// rollcatch.test.js — ころころキャッチ（シーソー型 v0.10.1）の純ロジックのNodeテスト
// 実行方法: node tests/rollcatch.test.js

import assert from 'node:assert';
import {
  DIFFICULTY,
  WAVE_LENGTH,
  buildShelves,
  createGame,
  startRun,
  elapsedOf,
  finishRun,
} from '../js/games/rollcatch/game.js';

// ---------- 難易度定義 ----------

{
  assert.strictEqual(DIFFICULTY.easy.wave, 0, 'かんたんはまっすぐな坂');
  assert.ok(DIFFICULTY.normal.wave < DIFFICULTY.hard.wave, 'むずかしいほど波が大きい');
  assert.ok(DIFFICULTY.easy.shelfCount < DIFFICULTY.hard.shelfCount, 'むずかしいほど段が多い');
  assert.ok(DIFFICULTY.hard.gapRatio < DIFFICULTY.easy.gapRatio, 'むずかしいほど切れ目がせまい');
  // むずかしいの波の最大坂角度は最大チルトを超える（揺らして勢いをつける必要がある）
  const hardSlopeDeg = (Math.atan((DIFFICULTY.hard.wave * Math.PI * 2) / WAVE_LENGTH) * 180) / Math.PI;
  assert.ok(hardSlopeDeg > DIFFICULTY.hard.maxTiltDeg, 'むずかしいは傾けるだけでは越えられない波');
  // ふつうは傾けるだけで越えられる
  const normalSlopeDeg = (Math.atan((DIFFICULTY.normal.wave * Math.PI * 2) / WAVE_LENGTH) * 180) / Math.PI;
  assert.ok(normalSlopeDeg < DIFFICULTY.normal.maxTiltDeg, 'ふつうは傾けだけで越えられる波');
}

// ---------- 段の形: 互い違いの切れ目・範囲内・波 ----------

{
  const W = 375;
  for (const key of ['easy', 'normal', 'hard']) {
    const shelves = buildShelves(DIFFICULTY[key], W);
    assert.strictEqual(shelves.length, DIFFICULTY[key].shelfCount, `${key}: 段数`);
    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i];
      assert.strictEqual(shelf.gapSide, i % 2 === 0 ? 'right' : 'left', '切れ目は互い違い');
      for (const p of shelf.points) {
        assert.ok(p.x >= 0 && p.x <= W, 'xは盤の中');
        assert.ok(Math.abs(p.y - shelf.baseY) <= DIFFICULTY[key].wave + 0.01, '波の振れ幅は設定どおり');
      }
      // 切れ目側に届いていない（ボールが落ちる隙間がある）
      const xs = shelf.points.map((p) => p.x);
      if (shelf.gapSide === 'right') {
        assert.ok(Math.max(...xs) <= W * (1 - DIFFICULTY[key].gapRatio) + 0.01, '右に切れ目');
        assert.ok(Math.min(...xs) <= 4, '左は壁まで');
      } else {
        assert.ok(Math.min(...xs) >= W * DIFFICULTY[key].gapRatio - 0.01, '左に切れ目');
        assert.ok(Math.max(...xs) >= W - 4.01, '右は壁まで');
      }
    }
  }
  // かんたんは波ゼロ=直線
  const flat = buildShelves(DIFFICULTY.easy, W);
  for (const p of flat[0].points) assert.strictEqual(p.y, flat[0].baseY, 'かんたんは平らな坂');
}

// ---------- タイム計測 ----------

{
  const state = createGame({ difficulty: 'easy' });
  assert.strictEqual(startRun(state, 1000), true);
  assert.strictEqual(startRun(state, 1500), false, '計測中は二重スタートしない');
  assert.strictEqual(elapsedOf(state, 3500), 2500);
  const result = finishRun(state, 13500);
  assert.strictEqual(result.elapsedMs, 12500, 'タイム12.5秒');
  assert.strictEqual(result.finished, true);
  assert.strictEqual(state.finished, true);
  assert.strictEqual(finishRun(state, 14000), null, '終了後は無視');
}

// ---------- こうたい対戦: タイムが短いほうの勝ち ----------

{
  const state = createGame({ mode: 'two' });
  startRun(state, 0);
  const first = finishRun(state, 20000); // あか20秒
  assert.strictEqual(first.nextPlayer, 1, 'あおに交代');
  assert.strictEqual(state.currentPlayer, 1);
  assert.strictEqual(state.finished, false);
  startRun(state, 100000);
  const end = finishRun(state, 112000); // あお12秒
  assert.strictEqual(end.finished, true);
  assert.strictEqual(end.winner, 1, 'はやいあおの勝ち');
  assert.deepStrictEqual(state.results, [20000, 12000]);
}

// ---------- こうたい対戦: 同タイムはひきわけ ----------

{
  const state = createGame({ mode: 'two' });
  startRun(state, 0);
  finishRun(state, 5000);
  startRun(state, 10000);
  const end = finishRun(state, 15000);
  assert.strictEqual(end.winner, null, 'ひきわけ');
}

console.log('rollcatch.test.js: すべてのテストに合格');
