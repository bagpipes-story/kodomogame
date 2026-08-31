// rollcatch.test.js — ころころキャッチの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/rollcatch.test.js

import assert from 'node:assert';
import {
  BALLS_PER_ROUND,
  DIFFICULTY,
  createGame,
  togglePlate,
  launchBall,
  ballGoal,
  ballOut,
} from '../js/games/rollcatch/game.js';

// ---------- 難易度定義 ----------

{
  assert.strictEqual(DIFFICULTY.easy.walls, true, 'かんたんは壁あり（失敗なし）');
  assert.strictEqual(DIFFICULTY.normal.walls, false, 'ふつうは壁なし');
  assert.strictEqual(DIFFICULTY.hard.plateCount, 5, 'むずかしいは板5段');
  assert.ok(DIFFICULTY.hard.plateLenRatio < DIFFICULTY.normal.plateLenRatio, 'むずかしいは板が短い');
  assert.ok(DIFFICULTY.easy.gravity < DIFFICULTY.hard.gravity, 'かんたんはゆっくり');
  assert.strictEqual(BALLS_PER_ROUND, 3, '1ラウンド=ボール3個');
}

// ---------- 板の反転と初期配置 ----------

{
  const state = createGame({ difficulty: 'normal' });
  assert.deepStrictEqual(state.tilts, [1, -1, 1, -1], '初期は互い違い');
  assert.strictEqual(togglePlate(state, 0), -1, 'タップで反転');
  assert.strictEqual(togglePlate(state, 0), 1, 'もう一度で元に戻る');
  assert.strictEqual(togglePlate(state, 9), null, '範囲外は無視');
  assert.strictEqual(state.tapsThisBall, 0, 'ボールが出る前のタップは数えない');
}

// ---------- ボール3個のラウンド進行とsmooth判定 ----------

{
  const state = createGame({ difficulty: 'easy' });
  assert.strictEqual(launchBall(state), 1, '1個目');
  assert.strictEqual(launchBall(state), null, '転がっている間は次を出せない');

  // 1個目: タップなしでゴール → smooth
  const g1 = ballGoal(state);
  assert.strictEqual(g1.smooth, true, '0タップゴールはsmooth');
  assert.strictEqual(g1.goals, 1);
  assert.strictEqual(g1.roundOver, null, 'まだ続く');
  assert.strictEqual(state.smoothGoals, 1);

  // 2個目: 転がし中にタップしてからゴール → smoothではない
  launchBall(state);
  togglePlate(state, 1);
  const g2 = ballGoal(state);
  assert.strictEqual(g2.smooth, false, 'タップしたのでsmoothではない');

  // 3個目: 飛び出し → ラウンド終了。スコアは2
  launchBall(state);
  const out = ballOut(state);
  assert.strictEqual(out.roundOver.finished, true, '3個でラウンド終了');
  assert.strictEqual(state.goals, 2, 'ゴール数は2');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(launchBall(state), null, '終了後は出せない');
  assert.strictEqual(ballGoal(state), null, '終了後のゴールは無視');
}

// ---------- こうたい対戦: 交代と勝敗 ----------

{
  const state = createGame({ difficulty: 'normal', mode: 'two' });
  // あか: 2ゴール1アウト
  launchBall(state); ballGoal(state);
  launchBall(state); ballGoal(state);
  togglePlate(state, 0); // 板の状態を変えておく
  launchBall(state);
  const over = ballOut(state);
  assert.strictEqual(over.roundOver.nextPlayer, 1, 'あおに交代');
  assert.strictEqual(state.currentPlayer, 1);
  assert.strictEqual(state.goals, 0, 'あおのスコアは0から');
  assert.strictEqual(state.ballIndex, 0, 'ボールも3個から');
  assert.deepStrictEqual(state.tilts, [1, -1, 1, -1], '板は初期配置に戻る（フェア）');

  // あお: 1ゴール2アウト → あかの勝ち
  launchBall(state); ballGoal(state);
  launchBall(state); ballOut(state);
  launchBall(state);
  const end = ballOut(state);
  assert.strictEqual(end.roundOver.finished, true);
  assert.strictEqual(end.roundOver.winner, 0, 'あか2 vs あお1であかの勝ち');
  assert.deepStrictEqual(state.results, [2, 1]);
}

// ---------- こうたい対戦: ひきわけ ----------

{
  const state = createGame({ mode: 'two' });
  for (let p = 0; p < 2; p++) {
    launchBall(state); ballGoal(state);
    launchBall(state); ballOut(state);
    launchBall(state); ballOut(state);
  }
  assert.strictEqual(state.finished, true);
  assert.deepStrictEqual(state.results, [1, 1]);
}

console.log('rollcatch.test.js: すべてのテストに合格');
