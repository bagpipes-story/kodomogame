// korinto.test.js — コリントゲームの純ロジック＋物理の自動テスト
// 実行方法: node tests/korinto.test.js
// 物理テスト（別冊04§10）: 最強パワーで100回打って球が盤外・釘の内部に入らないこと

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BALLS_PER_ROUND,
  BALL_R,
  PEG_R,
  CANVAS_H,
  DIFFICULTY,
  buildLayout,
  createGame,
  setAim,
  launchBall,
  ballReturned,
  hitBell,
  ballScored,
  ballLost,
} from '../js/games/korinto/game.js';
import { buildWorld } from '../js/games/korinto/physics.js';

// ---------- 難易度定義 ----------

{
  assert.ok(!DIFFICULTY.easy.pockets.includes(0), 'かんたんは0点なし');
  assert.ok(DIFFICULTY.normal.pockets.includes(0) && DIFFICULTY.normal.pockets.includes(50), 'ふつうは0・50あり');
  assert.ok(DIFFICULTY.hard.pockets.includes(100), 'むずかしいは100あり');
  assert.strictEqual(DIFFICULTY.hard.exact, 100, 'むずかしいはぴったり100モード');
  assert.strictEqual(DIFFICULTY.hard.pinwheels, 2, 'むずかしいは風車2個');
  assert.ok(BALL_R >= 8, '球は半径8px以上');
}

// ---------- レイアウト: 釘が重ならず、風車・ベルの近くにない ----------

{
  const W = 375;
  const H = CANVAS_H;
  for (const key of ['easy', 'normal', 'hard']) {
    const layout = buildLayout(DIFFICULTY[key], W, H);
    assert.strictEqual(layout.pockets.length, DIFFICULTY[key].pockets.length, `${key}: ポケット数`);
    for (let i = 0; i < layout.pegs.length; i++) {
      for (let j = i + 1; j < layout.pegs.length; j++) {
        const d = Math.hypot(layout.pegs[i].x - layout.pegs[j].x, layout.pegs[i].y - layout.pegs[j].y);
        assert.ok(d > BALL_R * 2 + PEG_R * 2 + 2, `${key}: 釘のすき間を球が通れる (${d.toFixed(0)})`);
      }
      assert.ok(layout.pegs[i].x < layout.fieldRight - 10, `${key}: 釘はレーンに入らない`);
    }
    for (const p of layout.pinwheels) {
      for (const peg of layout.pegs) {
        assert.ok(Math.hypot(p.x - peg.x, p.y - peg.y) > p.len / 2 + 12, `${key}: 風車と釘が干渉しない`);
      }
    }
  }
}

// ---------- ラウンド進行とたしざん表示 ----------

{
  const state = createGame({ difficulty: 'normal' });
  assert.strictEqual(launchBall(state), 1);
  assert.strictEqual(launchBall(state), null, '球が動いている間は打てない');
  const r1 = ballScored(state, 3); // 50点
  assert.strictEqual(r1.points, 50);
  assert.strictEqual(r1.expression, '0 + 50 = 50', 'たしざんの式');
  assert.strictEqual(r1.roundOver, null);

  launchBall(state);
  assert.deepStrictEqual(ballReturned(state), { ballsLeft: 4 }, '戻ってきた球は消費しない');
  assert.strictEqual(state.ballsShot, 1);

  launchBall(state);
  setAim(state, 2); // 動いている最中の宣言は不可
  assert.strictEqual(state.aimIndex, null, '球が動いている間はねらい宣言できない');
  const r2 = ballScored(state, 2); // 20点
  assert.strictEqual(r2.expression, '50 + 20 = 70');
  assert.strictEqual(r2.aimed, false);

  assert.strictEqual(setAim(state, 0), true, '止まっているときは宣言できる');
  launchBall(state);
  const r3 = ballScored(state, 0); // 0点・ねらいどおり
  assert.strictEqual(r3.points, 0);
  assert.strictEqual(r3.aimed, true, 'ねらったポケットに入った');
  assert.strictEqual(state.aimIndex, null, '宣言は1球で消える');

  launchBall(state);
  ballLost(state); // ひっかかり
  launchBall(state);
  const last = ballScored(state, 1); // 10点 → 5球目でラウンド終了
  assert.strictEqual(last.total, 80);
  assert.strictEqual(last.roundOver.finished, true, '5球で終了');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(launchBall(state), null, '終了後は打てない');
}

// ---------- ベルは1球1回・ぴったり100判定 ----------

{
  const state = createGame({ difficulty: 'hard' });
  launchBall(state);
  assert.strictEqual(hitBell(state), 5, 'ベルで+5');
  assert.strictEqual(hitBell(state), 0, '同じ球で2回目は鳴らない');
  ballScored(state, 3, 5); // 100 + 5 = 105
  assert.strictEqual(state.total, 105);
  for (let i = 0; i < 3; i++) { launchBall(state); ballScored(state, 0); }
  launchBall(state);
  const end = ballScored(state, 0);
  assert.strictEqual(end.roundOver.exact, false, '105はぴったりではない');

  const s2 = createGame({ difficulty: 'hard' });
  launchBall(s2); ballScored(s2, 2); // 50
  launchBall(s2); ballScored(s2, 2); // 100
  for (let i = 0; i < 2; i++) { launchBall(s2); ballScored(s2, 0); }
  launchBall(s2);
  assert.strictEqual(ballScored(s2, 6).roundOver.exact, true, '50+50+0+0+0=ぴったり100');
}

// ---------- こうたい対戦 ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'two' });
  for (let i = 0; i < BALLS_PER_ROUND; i++) { launchBall(state); ballScored(state, 2); } // あか 25点
  assert.strictEqual(state.currentPlayer, 1, 'あおに交代');
  assert.strictEqual(state.total, 0);
  for (let i = 0; i < BALLS_PER_ROUND - 1; i++) { launchBall(state); ballScored(state, 0); }
  launchBall(state);
  const end = ballScored(state, 0); // あお 5点
  assert.strictEqual(end.roundOver.winner, 0, 'あかの勝ち');
  assert.deepStrictEqual(state.results, [25, 5]);
}

// ---------- 物理テスト: 最強パワー100発＋ランダム100発 ----------

{
  const code = readFileSync(new URL('../lib/matter.min.js', import.meta.url), 'utf8');
  const module2 = { exports: {} };
  new Function('module', 'exports', code)(module2, module2.exports);
  const M = module2.exports;

  // 再現性のある乱数
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const W = 375;
  const H = CANVAS_H;
  for (const key of ['normal', 'hard']) {
    const layout = buildLayout(DIFFICULTY[key], W, H);
    let pocketIndex = null;
    const world = buildWorld(M, layout, { onPocket: (i) => { pocketIndex = i; } });
    const results = { pocket: 0, returned: 0, stuck: 0 };
    for (let shot = 0; shot < 200; shot++) {
      const power = shot < 100 ? 1 : 0.3 + rng() * 0.7;
      pocketIndex = null;
      const ball = world.launch(power);
      let outcome = 'stuck';
      let stillTicks = 0;
      for (let t = 0; t < 1800; t++) { // 30秒ぶん
        world.step();
        const { x, y } = ball.position;
        assert.ok(x > -1 && x < W + 1 && y > -1 && y < H + 1, `${key} shot${shot}: 盤外に出ない (${x.toFixed(0)},${y.toFixed(0)})`);
        if (pocketIndex !== null) { outcome = 'pocket'; break; }
        if (x > layout.laneWallX && y > H - 40 && ball.speed < 0.3 && t > 60) { outcome = 'returned'; break; }
        if (ball.speed < 0.05) stillTicks++; else stillTicks = 0;
        if (stillTicks > 180) break; // 3秒静止=ひっかかり
      }
      // 止まった位置が釘の内部でないこと
      for (const peg of layout.pegs) {
        const d = Math.hypot(ball.position.x - peg.x, ball.position.y - peg.y);
        assert.ok(d > PEG_R + BALL_R - 2, `${key} shot${shot}: 釘の内部に入らない (d=${d.toFixed(1)})`);
      }
      results[outcome]++;
    }
    world.destroy();
    console.log(`  ${key}: 200発 → ポケット${results.pocket}・戻り${results.returned}・ひっかかり${results.stuck}`);
    assert.ok(results.pocket >= 170, `${key}: ほとんどの球がポケットに入る（ひっかかりが多すぎない）`);
    assert.strictEqual(results.returned, 0, `${key}: 3割以上のパワーなら戻ってこない`);
  }
}

console.log('korinto.test.js: すべてのテストに合格');
