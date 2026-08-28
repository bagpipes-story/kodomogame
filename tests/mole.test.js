// mole.test.js — もぐらたたきの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/mole.test.js

import assert from 'node:assert';
import {
  DIFFICULTY,
  HOLE_COUNT,
  ROUND_SECONDS,
  createGame,
  spawn,
  hide,
  hit,
  finishRound,
} from '../js/games/mole/game.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ---------- 難易度設定 ----------

{
  assert.strictEqual(ROUND_SECONDS, 30);
  assert.strictEqual(DIFFICULTY.easy.butterflyRate, 0, 'かんたんはちょうちょなし');
  assert.strictEqual(DIFFICULTY.hard.maxUp, 3, 'むずかしいは同時3体');
  const state = createGame({ difficulty: 'easy' });
  assert.strictEqual(state.hasButterflies, false);
  assert.strictEqual(state.holes.length, HOLE_COUNT);
}

// ---------- spawn: 同時最大数と空き穴の管理 ----------

{
  const state = createGame({ difficulty: 'easy', rng: makeRng([0.0, 0.9]) });
  const first = spawn(state);
  assert.strictEqual(first.kind, 'mole', 'かんたんは必ずもぐら');
  assert.strictEqual(state.holes[first.index], 'mole');
  assert.strictEqual(spawn(state), null, 'かんたんは同時1体まで');

  hide(state, first.index);
  assert.strictEqual(state.holes[first.index], null, 'hideで引っ込む');
  assert.ok(spawn(state) !== null, '引っ込んだらまた出せる');
}

{
  // ふつう: rng2つ目が0.15未満ならちょうちょ
  const state = createGame({ difficulty: 'normal', rng: makeRng([0.5, 0.1]) });
  const result = spawn(state);
  assert.strictEqual(result.kind, 'butterfly', '15%をひいたらちょうちょ');
  // 空いている穴にだけ出る
  const state2 = createGame({ difficulty: 'hard', rng: makeRng([0.0, 0.9]) });
  for (let i = 0; i < 3; i++) spawn(state2);
  const upIndexes = state2.holes.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  assert.strictEqual(new Set(upIndexes).size, 3, '3体が別々の穴に出る');
  assert.strictEqual(spawn(state2), null, 'むずかしいでも同時3体まで');
}

// ---------- hit: もぐら・ちょうちょ・空振り ----------

{
  const state = createGame({ difficulty: 'normal', rng: makeRng([0.0, 0.9]) });
  const { index } = spawn(state);
  const result = hit(state, index);
  assert.deepStrictEqual(result, { type: 'mole', score: 1, combo: 1 }, 'もぐらヒットで+1');
  assert.strictEqual(state.holes[index], null, 'たたいたら消える');

  // 連続ヒットでコンボが伸びる
  const { index: i2 } = spawn(state);
  hit(state, i2);
  assert.strictEqual(state.combo, 2);
  assert.strictEqual(state.maxCombo, 2);

  // 空振りでコンボが切れる（スコアは減らない）
  const emptyIndex = state.holes.findIndex((k) => k === null);
  assert.deepStrictEqual(hit(state, emptyIndex), { type: 'miss' });
  assert.strictEqual(state.combo, 0, '空振りでコンボリセット');
  assert.strictEqual(state.score, 2, 'スコアは減らない');
  assert.strictEqual(state.maxCombo, 2, 'さいだいコンボは残る');
}

{
  // ちょうちょ: スコア増えず・減点なし・コンボが切れる
  const state = createGame({ difficulty: 'normal', rng: makeRng([0.5, 0.1]) });
  const { index } = spawn(state);
  state.combo = 3;
  state.score = 5;
  const result = hit(state, index);
  assert.strictEqual(result.type, 'butterfly');
  assert.strictEqual(state.score, 5, 'スコアは増えも減りもしない');
  assert.strictEqual(state.combo, 0, 'コンボは切れる');
  assert.strictEqual(state.butterflyHits, 1);
}

// ---------- おとなモード（穴2倍・高速） ----------

{
  assert.strictEqual(DIFFICULTY.adult.holeCount, 18, 'おとなは穴2倍の18こ');
  assert.ok(DIFFICULTY.adult.spawnMs < DIFFICULTY.hard.spawnMs, 'むずかしいより速い');
  assert.ok(DIFFICULTY.adult.butterflyRate > DIFFICULTY.hard.butterflyRate, 'ちょうちょも多い');

  const state = createGame({ difficulty: 'adult', rng: makeRng([0.0, 0.9, 0.3, 0.9, 0.6, 0.9, 0.85, 0.9]) });
  assert.strictEqual(state.holes.length, 18, '盤面は18穴');
  for (let i = 0; i < 4; i++) assert.ok(spawn(state) !== null, `${i + 1}体目が出る`);
  assert.strictEqual(spawn(state), null, '同時4体まで');
  const upIndexes = state.holes.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  assert.strictEqual(new Set(upIndexes).size, 4, '4体が別々の穴に出る');
}

// ---------- 終了 ----------

{
  const state = createGame({ difficulty: 'easy', rng: makeRng([0.0, 0.9]) });
  spawn(state);
  finishRound(state);
  assert.ok(state.holes.every((k) => k === null), '終了時は全部引っ込む');
  assert.strictEqual(spawn(state), null, '終了後は出ない');
  assert.deepStrictEqual(hit(state, 0), { type: 'ignore' }, '終了後はたたけない');
}

console.log('mole.test.js: すべてのテストに合格');
