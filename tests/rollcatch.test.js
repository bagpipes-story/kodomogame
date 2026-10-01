// rollcatch.test.js — ころころキャッチ（シーソー型。v0.17.4で両手スライダー操作に）の純ロジックのNodeテスト
// 実行方法: node tests/rollcatch.test.js

import assert from 'node:assert';
import {
  DIFFICULTY,
  WAVE_LENGTH,
  PIT_WIDTH,
  buildShelves,
  tiltFromSliders,
  createGame,
  startRun,
  recordFall,
  elapsedOf,
  finishRun,
} from '../js/games/rollcatch/game.js';

// ---------- 難易度定義 ----------

{
  assert.strictEqual(DIFFICULTY.easy.wave, 0, 'かんたんはまっすぐな坂');
  assert.ok(DIFFICULTY.normal.wave < DIFFICULTY.hard.wave, 'むずかしいほど波が大きい');
  assert.ok(DIFFICULTY.easy.shelfCount < DIFFICULTY.hard.shelfCount, 'むずかしいほど段が多い');
  assert.ok(DIFFICULTY.hard.gapRatio < DIFFICULTY.easy.gapRatio, 'むずかしいほど切れ目がせまい');
  assert.strictEqual(DIFFICULTY.easy.walls, true, 'かんたんだけ左右に壁（落ちない）');
  assert.strictEqual(DIFFICULTY.normal.walls, false);
  assert.strictEqual(DIFFICULTY.hard.walls, false);
  assert.strictEqual(DIFFICULTY.hard.pits, true, 'むずかしいは穴あり');
  assert.ok(DIFFICULTY.easy.maxTiltDeg >= 20, 'しっかり傾く（20°以上）');
  // 波の坂の最大角度は最大チルトより小さい（傾ければ越えられる。穴と壁なしで難しさを出す）
  for (const key of ['normal', 'hard']) {
    const slopeDeg = (Math.atan((DIFFICULTY[key].wave * Math.PI * 2) / WAVE_LENGTH) * 180) / Math.PI;
    assert.ok(slopeDeg < DIFFICULTY[key].maxTiltDeg, `${key}: 傾ければ波を越えられる`);
  }
}

// ---------- 段の形: 互い違いの切れ目・範囲内・波・穴 ----------

{
  const W = 300;
  for (const key of ['easy', 'normal', 'hard']) {
    const shelves = buildShelves(DIFFICULTY[key], W);
    assert.strictEqual(shelves.length, DIFFICULTY[key].shelfCount, `${key}: 段数`);
    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i];
      assert.strictEqual(shelf.gapSide, i % 2 === 0 ? 'right' : 'left', '切れ目は互い違い');
      for (const p of shelf.points) {
        assert.ok(p.x >= 0 && p.x <= W, '点はx範囲内');
        assert.ok(Math.abs(p.y - shelf.baseY) <= DIFFICULTY[key].wave + 1e-9, '波の振幅内');
      }
      if (DIFFICULTY[key].stopper > 0) {
        // 返し: 切れ目の反対側の端に丸い返しがある（段の面より上に出ている）
        assert.ok(shelf.stopper, `${key}: 返しがある`);
        const outer = shelf.gapSide === 'right' ? shelf.points[0] : shelf.points[shelf.points.length - 1];
        assert.ok(Math.abs(shelf.stopper.x - outer.x) <= 2 + 1e-9, '返しは外側の端');
        assert.ok(shelf.stopper.y - shelf.stopper.r < outer.y - 6, '返しの頭は段の面より上');
      } else {
        assert.strictEqual(shelf.stopper, null);
      }
      if (i > 0) assert.ok(shelf.baseY > shelves[i - 1].baseY, '上から順に下がる');
      if (shelf.pit) {
        assert.strictEqual(shelf.segments.length, 2, '穴のある段は点列が2本');
        const [a, b] = shelf.segments;
        const left = a[a.length - 1].x;
        const right = b[0].x;
        assert.ok(right - left >= PIT_WIDTH - 1e-9, '穴の幅ぶん空いている');
        assert.ok(Math.abs((left + right) / 2 - shelf.pit.x) < 1e-6, '穴は点列のすき間の中心');
      } else {
        assert.strictEqual(shelf.segments.length, 1);
      }
    }
    const pitCount = shelves.filter((s) => s.pit).length;
    if (key === 'hard') assert.ok(pitCount >= 1, 'むずかしいは穴が1つ以上');
    else assert.strictEqual(pitCount, 0, `${key}: 穴なし`);
  }
}

// ---------- スライダー → 傾き ----------

{
  const max = 24;
  assert.strictEqual(tiltFromSliders(0.5, 0.5, max), 0, '同じ高さなら水平');
  assert.ok(tiltFromSliders(1, 0, max) > 0, '左を上げると右さがり（正）');
  assert.ok(Math.abs(tiltFromSliders(1, 0, max) - (max * Math.PI) / 180) < 1e-9, '最大で maxTiltDeg');
  assert.ok(Math.abs(tiltFromSliders(0, 1, max) + (max * Math.PI) / 180) < 1e-9, '逆向きも対称');
  assert.ok(Math.abs(tiltFromSliders(0.75, 0.25, max) - (max * Math.PI) / 360) < 1e-9, '差の半分なら半分の角度');
  assert.ok(Math.abs(tiltFromSliders(5, -5, max)) <= (max * Math.PI) / 180 + 1e-9, '範囲外の値は丸める');
}

// ---------- タイム計測・落下・こうたい対戦 ----------

{
  const state = createGame({ difficulty: 'normal', mode: 'solo' });
  assert.strictEqual(startRun(state, 1000), true);
  assert.strictEqual(startRun(state, 1100), false, '走行中は二重に始めない');
  assert.strictEqual(elapsedOf(state, 3500), 2500);
  assert.strictEqual(recordFall(state), 1);
  assert.strictEqual(recordFall(state), 2);
  const result = finishRun(state, 6000);
  assert.deepStrictEqual(result, { elapsedMs: 5000, falls: 2, finished: true, winner: null });
  assert.strictEqual(state.finished, true);
  assert.strictEqual(recordFall(state), 0, '終わった後は数えない');
}

{
  const state = createGame({ difficulty: 'easy', mode: 'two' });
  startRun(state, 0);
  const first = finishRun(state, 4000);
  assert.deepStrictEqual(first, { elapsedMs: 4000, falls: 0, nextPlayer: 1 });
  assert.strictEqual(state.currentPlayer, 1);
  startRun(state, 10000);
  recordFall(state);
  const second = finishRun(state, 13000);
  assert.strictEqual(second.winner, 1, '3.0秒 < 4.0秒 であおの勝ち（落ちても速ければ勝ち）');
  assert.deepStrictEqual(state.results, [4000, 3000]);
  assert.deepStrictEqual(state.fallsBy, [0, 1]);
}

console.log('rollcatch.test.js: all passed');
