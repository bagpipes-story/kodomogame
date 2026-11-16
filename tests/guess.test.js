// guess.test.js — なまえあて（v0.18）の純ロジックのテスト。node tests/guess.test.js
import assert from 'node:assert';
import {
  QUESTIONS_PER_ROUND,
  OPTIONS,
  GUESS_SETS,
  DIFFICULTY,
  EARLY_RATIO,
  poolOf,
  createGame,
  nextQuestion,
  answerAt,
  revealProgress,
  tileRevealTimes,
  mosaicSize,
  MOSAIC_MAX,
} from '../js/games/guess/game.js';
import { BLOCK_SETS } from '../js/games/balance/game.js';
import { text } from '../js/i18n.js';

function makeRng(seed = 1) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// ---------- えらべる なかま: バランスゲームの 図形いがい ぜんぶ ----------
{
  assert.deepStrictEqual([...GUESS_SETS].sort(), Object.keys(BLOCK_SETS).filter((k) => k !== 'shape').sort(), '図形いがいの つみき ぜんぶ');
  assert.ok(!GUESS_SETS.includes('shape'), '図形は 出ない');
  const NAMES = { sea: text.sea, animal: text.animals, bird: text.birds, fresh: text.fresh, insect: text.insects, deep: text.deep, dino: text.dinos, pref: text.prefs, world: text.countries };
  for (const set of GUESS_SETS) {
    for (const d of Object.keys(DIFFICULTY)) {
      const pool = poolOf(set, d);
      assert.ok(pool.length >= OPTIONS, `${set}/${d} は 4たくが つくれる`);
      for (const id of pool) assert.ok(/^[ぁ-んァ-ヶー]+$/.test(NAMES[set][id]), `${set}/${id} の 名前が かなで ある`);
    }
  }
  assert.deepStrictEqual(poolOf('shape', 'easy'), poolOf('sea', 'easy'), 'へんな なかまは うみ');
  assert.deepStrictEqual(poolOf('sea', 'toString'), poolOf('sea', 'easy'), 'へんな むずかしさは かんたん');
  assert.ok(DIFFICULTY.easy.revealMs < DIFFICULTY.normal.revealMs && DIFFICULTY.hard.revealMs < DIFFICULTY.adult.revealMs, 'むずかしいほど ゆっくり 見えて くる');
}

// ---------- 10問ラウンド: 4たく・正解が 1つ・かさならない ----------
for (const set of GUESS_SETS) {
  for (const difficulty of Object.keys(DIFFICULTY)) {
    const state = createGame({ set, difficulty, rng: makeRng(7) });
    const pool = poolOf(set, difficulty);
    const seen = [];
    for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
      const q = nextQuestion(state);
      assert.ok(q, `${set}/${difficulty} ${i + 1}もんめ`);
      assert.strictEqual(q.options.length, OPTIONS);
      assert.strictEqual(new Set(q.options).size, OPTIONS, 'えらぶ 名前が かさならない');
      assert.strictEqual(q.options[q.correctIndex], q.answer);
      assert.ok(pool.includes(q.answer), '正解は その むずかしさの 顔ぶれから');
      for (const id of q.options) assert.ok(pool.includes(id), 'えらぶ 名前も 同じ 顔ぶれから');
      if (seen.length) assert.notStrictEqual(q.answer, seen[seen.length - 1], 'おなじ 子が つづけて 出ない');
      seen.push(q.answer);
      const r = answerAt(state, q.correctIndex, 0);
      assert.ok(r.correct);
    }
    if (pool.length >= QUESTIONS_PER_ROUND) assert.strictEqual(new Set(seen).size, QUESTIONS_PER_ROUND, `${set}/${difficulty}: 10問 ぜんぶ ちがう 子`);
    assert.strictEqual(nextQuestion(state), null, '10問で おわり');
  }
}

// ---------- 回答: まちがえても えらびなおせる・はやわかり ----------
{
  const state = createGame({ set: 'sea', difficulty: 'easy', rng: makeRng(3) });
  const q = nextQuestion(state);
  const wrong = (q.correctIndex + 1) % OPTIONS;
  const r1 = answerAt(state, wrong, 100);
  assert.ok(r1.ok && !r1.correct, 'まちがい');
  const r2 = answerAt(state, q.correctIndex, 200);
  assert.ok(r2.correct, 'えらびなおして 正解');
  assert.strictEqual(r2.early, false, 'まちがえた あとは はやわかりに しない');
  assert.strictEqual(state.early, 0);
  assert.strictEqual(answerAt(state, q.correctIndex, 300).ok, false, '正解の あとは もう こたえられない');

  const q2 = nextQuestion(state);
  const early = answerAt(state, q2.correctIndex, state.revealMs * EARLY_RATIO - 1);
  assert.ok(early.correct && early.early, '早く あてたら はやわかり');
  const q3 = nextQuestion(state);
  const late = answerAt(state, q3.correctIndex, state.revealMs * EARLY_RATIO + 1);
  assert.ok(late.correct && !late.early, 'ゆっくりは ふつうの 正解');
  assert.strictEqual(state.early, 1);
  assert.strictEqual(state.scores[0], 3);
}

// ---------- 見えて くる ぐあい ----------
{
  assert.strictEqual(revealProgress(-5, 1000), 0);
  assert.strictEqual(revealProgress(500, 1000), 0.5);
  assert.strictEqual(revealProgress(5000, 1000), 1);
  assert.strictEqual(revealProgress(10, 0), 1, '時間が 0なら すぐ 見える');
  const times = tileRevealTimes(64, makeRng(5));
  assert.strictEqual(times.length, 64);
  for (const t of times) assert.ok(t > 0 && t < 0.92, 'マスは とちゅうで 見えはじめ、さいごまでに ぜんぶ 見える');
  const sorted = [...times].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] < 0.05, 'だいたい 同じ はやさで 見えて いく（間が あきすぎない）');
  assert.strictEqual(mosaicSize(0), MOSAIC_MAX);
  assert.strictEqual(mosaicSize(1), 1, 'さいごは もとの 絵');
  for (let p = 0; p < 1; p += 0.05) assert.ok(mosaicSize(p + 0.05) <= mosaicSize(p), 'モザイクは だんだん こまかく');
}

console.log('guess.test.js: すべてのテストに合格');
