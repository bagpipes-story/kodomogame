// rollcatch.test.js — ころころキャッチ（シーソー型。v0.17.4で両手スライダー操作、v0.17.5でむずかしいにしかけ）の純ロジックのNodeテスト
// 実行方法: node tests/rollcatch.test.js

import assert from 'node:assert';
import {
  DIFFICULTY,
  WAVE_LENGTH,
  FEATURE,
  buildShelves,
  shelfProfile,
  gateOpenRatio,
  seesawTargetAngle,
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
  assert.ok(DIFFICULTY.normal.wave > 0, 'ふつうはゆるい波波');
  assert.ok(DIFFICULTY.easy.shelfCount < DIFFICULTY.hard.shelfCount, 'むずかしいほど段が多い');
  assert.ok(DIFFICULTY.hard.gapRatio < DIFFICULTY.easy.gapRatio, 'むずかしいほど切れ目がせまい');
  assert.strictEqual(DIFFICULTY.easy.walls, true, 'かんたんだけ左右に壁（落ちない）');
  assert.strictEqual(DIFFICULTY.normal.walls, false);
  assert.strictEqual(DIFFICULTY.hard.walls, false);
  assert.deepStrictEqual(DIFFICULTY.easy.features, [], 'かんたんはしかけなし');
  assert.deepStrictEqual(DIFFICULTY.normal.features, [], 'ふつうはしかけなし');
  assert.strictEqual(DIFFICULTY.hard.features.length, DIFFICULTY.hard.shelfCount, 'むずかしいは全段にしかけ');
  assert.strictEqual(new Set(DIFFICULTY.hard.features).size, DIFFICULTY.hard.features.length, 'しかけは全部ちがう種類');
  assert.ok(DIFFICULTY.easy.maxTiltDeg >= 20, 'しっかり傾く（20°以上）');
  // 波の坂の最大角度は最大チルトより小さい（傾ければ越えられる。壁なしで難しさを出す）
  const slopeDeg = (Math.atan((DIFFICULTY.normal.wave * Math.PI * 2) / WAVE_LENGTH) * 180) / Math.PI;
  assert.ok(slopeDeg < DIFFICULTY.normal.maxTiltDeg, 'ふつう: 傾ければ波を越えられる');
}

// ---------- しかけの坂はどれも最大の傾き(26°)より緩い（傾ければ登れる。だんさだけは一方通行の崖） ----------

{
  const max = DIFFICULTY.hard.maxTiltDeg;
  for (const type of ['bumps', 'hill', 'valley']) {
    let worst = 0;
    for (let x = 0; x < 300; x += 0.5) {
      const dy = shelfProfile(type, DIFFICULTY.hard, x + 0.5, 150, 1) - shelfProfile(type, DIFFICULTY.hard, x, 150, 1);
      worst = Math.max(worst, (Math.atan(Math.abs(dy) / 0.5) * 180) / Math.PI);
    }
    assert.ok(worst < max, `${type}: 最大の坂 ${worst.toFixed(1)}° < ${max}°`);
  }
  assert.ok(shelfProfile('hill', DIFFICULTY.hard, 150, 150, 1) < -FEATURE.hill.height + 1e-9, 'やまの頂上は高い（上が負）');
  assert.ok(shelfProfile('valley', DIFFICULTY.hard, 150, 150, 1) > FEATURE.valley.depth - 1e-9, 'くぼみの底は低い');
  assert.strictEqual(shelfProfile('step', DIFFICULTY.hard, 100, 150, 1), -FEATURE.step.height, 'だんさ: 右へ進むなら左半分が高い');
  assert.strictEqual(shelfProfile('step', DIFFICULTY.hard, 200, 150, 1), 0);
  assert.strictEqual(shelfProfile('step', DIFFICULTY.hard, 200, 150, -1), -FEATURE.step.height, 'だんさ: 左へ進むなら右半分が高い');
}

// ---------- ゲートの開閉: 周期の前半は開く・後半は閉じる、なめらかに ----------

{
  const { periodMs, rampMs } = FEATURE.gate;
  assert.strictEqual(gateOpenRatio(0), 0, '始まりは閉じている');
  assert.strictEqual(gateOpenRatio(rampMs), 1, '上がりきったら開いている');
  assert.strictEqual(gateOpenRatio(periodMs / 2 - 1), 1, '前半は開いたまま');
  assert.strictEqual(gateOpenRatio(periodMs - 1), 0, '後半は閉じたまま');
  assert.ok(Math.abs(gateOpenRatio(rampMs / 2) - 0.5) < 1e-9, '途中は半分');
  assert.strictEqual(gateOpenRatio(periodMs * 3 + rampMs), 1, '周期でくり返す');
  assert.ok(periodMs / 2 - rampMs >= 1000, '開いている時間は1秒以上（4歳でも通れる）');
}

// ---------- シーソー板: ふだんは入口側が下、支点を越えると出口側へ倒れる ----------

{
  const f = { x: 150, y: 200, dir: 1, maxAngleDeg: 10 };
  const max = (10 * Math.PI) / 180;
  assert.ok(Math.abs(seesawTargetAngle(f, null, null) + max) < 1e-9, 'ボール無し: 左端（入口）が下がる＝負の角度');
  assert.ok(seesawTargetAngle(f, 120, 185) < 0, '支点の手前では入口側が下のまま');
  assert.ok(seesawTargetAngle(f, 160, 185) > 0, '支点を越えたら出口側（右）が下がる');
  assert.ok(seesawTargetAngle(f, 160, 100) < 0, '別の段の高さにいるボールは関係ない');
  const g = { ...f, dir: -1 };
  assert.ok(seesawTargetAngle(g, null, null) > 0, '左へ進む段では右端（入口）が下');
  assert.ok(seesawTargetAngle(g, 140, 185) < 0, '支点を越えたら左が下');
}

// ---------- 段の形: 互い違いの切れ目・範囲内・波・しかけ ----------

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
        if (!shelf.feature) assert.ok(Math.abs(p.y - shelf.baseY) <= DIFFICULTY[key].wave + 1e-9, '波の振幅内');
        else assert.ok(Math.abs(p.y - shelf.baseY) <= 14 + 1e-9, 'しかけの高さは14px以内（上の段にぶつからない）');
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
      const expected = DIFFICULTY[key].features[i] ?? null;
      assert.strictEqual(shelf.feature?.type ?? null, expected, `${key} ${i}段目: しかけ ${expected}`);
      if (shelf.feature?.type === 'seesaw') {
        assert.strictEqual(shelf.segments.length, 2, 'シーソー板の段は点列が2本（まんなかが板）');
        const [a, b] = shelf.segments;
        const left = a[a.length - 1].x;
        const right = b[0].x;
        assert.ok(right - left >= FEATURE.seesaw.halfLength * 2 - 1e-9, '板の長さぶん空いている');
        assert.ok(Math.abs((left + right) / 2 - shelf.feature.x) < 1e-6, '板は点列のすき間の中心');
        assert.strictEqual(shelf.feature.dir, shelf.gapSide === 'right' ? 1 : -1, '板の向きは進む向き');
      } else {
        assert.strictEqual(shelf.segments.length, 1);
      }
      if (shelf.feature?.type === 'step') {
        // 境目はほぼ垂直（逆走できない）
        const pts = shelf.points;
        const cliff = pts.find((p, k) => k > 0 && Math.abs(p.y - pts[k - 1].y) >= FEATURE.step.height - 1e-9);
        assert.ok(cliff, 'だんさの崖がある');
        const prev = pts[pts.indexOf(cliff) - 1];
        assert.ok(Math.abs(cliff.x - prev.x) <= 2, '崖は横幅2px以内');
      }
      if (shelf.feature?.type === 'gate') {
        assert.ok(shelf.feature.x > shelf.points[0].x + 40 && shelf.feature.x < shelf.points.at(-1).x - 40, 'ゲートは段のまんなか寄り');
      }
    }
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
