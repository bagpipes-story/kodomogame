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
  timeUp,
  zukanAll,
  bookOf,
  ZUKAN_KEYS,
  addToZukan,
  zukanProgress,
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
  assert.ok(DIFFICULTY.easy.revealMs < DIFFICULTY.normal.revealMs, 'ふつうは かんたんより ゆっくり 見えて くる');
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

// ---------- しょうぶ（v0.18.1。むずかしい いじょう）: まちがえたら おわり・時間せいげん ----------
{
  assert.ok(!DIFFICULTY.easy.strict && !DIFFICULTY.normal.strict, 'かんたん・ふつうは えらびなおせる');
  assert.ok(DIFFICULTY.hard.strict && DIFFICULTY.adult.strict, 'むずかしい いじょうは しょうぶ');
  assert.strictEqual(DIFFICULTY.easy.limitMs, null, 'かんたんは 時間ぎれ なし');
  assert.ok(DIFFICULTY.adult.limitMs < DIFFICULTY.hard.limitMs, 'おとなは 時間が みじかい');
  assert.strictEqual(DIFFICULTY.hard.limitMs, 6000, 'むずかしいは 6びょう（v0.19.1）');
  assert.strictEqual(DIFFICULTY.adult.limitMs, 4000, 'おとなは 4びょう（v0.19.1）');
  for (const d of ['hard', 'adult']) {
    const seen = revealProgress(DIFFICULTY[d].limitMs, DIFFICULTY[d].revealMs);
    assert.strictEqual(seen, 1, `${d}: 時間が 0に なった とき ちょうど すっかり 見えて いる（v0.19.2）`);
    assert.ok(revealProgress(DIFFICULTY[d].limitMs - 500, DIFFICULTY[d].revealMs) < 1, `${d}: その まえは まだ 見えきって いない`);
  }
  // はやわかりは 時間せいげんの 6わりより 前（しょうぶで ぜんぶ はやわかりに ならない）
  const hs = createGame({ set: 'sea', difficulty: 'hard', rng: makeRng(4) });
  const hq = nextQuestion(hs);
  assert.ok(!answerAt(hs, hq.correctIndex, DIFFICULTY.hard.limitMs * 0.7).early, 'むずかしい: 7わりの 時間で あてても はやわかり では ない');
  const hq2 = nextQuestion(hs);
  assert.ok(answerAt(hs, hq2.correctIndex, DIFFICULTY.hard.limitMs * 0.5).early, 'むずかしい: 5わりの 時間なら はやわかり');

  const state = createGame({ set: 'dino', difficulty: 'hard', rng: makeRng(9) });
  const q1 = nextQuestion(state);
  const wrong = answerAt(state, (q1.correctIndex + 1) % OPTIONS, 500);
  assert.ok(wrong.ok && !wrong.correct && wrong.final, 'まちがえたら その問題は おわり');
  assert.strictEqual(answerAt(state, q1.correctIndex, 600).ok, false, 'えらびなおせない');
  assert.strictEqual(timeUp(state).ok, false, 'おわった 問題は 時間ぎれに ならない');
  const q2 = nextQuestion(state);
  assert.ok(q2, 'つぎの 問題へ すすめる');
  const up = timeUp(state);
  assert.ok(up.ok && state.current.timedOut, '時間ぎれで おわり');
  assert.strictEqual(answerAt(state, q2.correctIndex, 99999).ok, false, '時間ぎれの あとは こたえられない');
  for (let i = 2; i < QUESTIONS_PER_ROUND; i++) {
    const q = nextQuestion(state);
    const r = answerAt(state, q.correctIndex, 100);
    if (i === QUESTIONS_PER_ROUND - 1) assert.ok(r.roundOver, '10問めで おわり');
  }
  assert.strictEqual(state.scores[0], 8, '正解は 8問（まちがい1・時間ぎれ1）');
  const last = createGame({ set: 'sea', difficulty: 'adult', rng: makeRng(2) });
  for (let i = 0; i < QUESTIONS_PER_ROUND - 1; i++) answerAt(last, nextQuestion(last).correctIndex, 0);
  nextQuestion(last);
  assert.ok(timeUp(last).roundOver, 'さいごの 問題が 時間ぎれでも ラウンドは おわる');
  const easy = createGame({ set: 'sea', difficulty: 'easy' });
  nextQuestion(easy);
  assert.strictEqual(timeUp(easy).ok, false, 'かんたんは 時間ぎれ しない');
}

// ---------- ずかん（v0.18.1） ----------
{
  for (const set of GUESS_SETS) assert.deepStrictEqual(zukanAll(set), BLOCK_SETS[set].adult, `${set} の ずかんは ぜんぶの 子`);
  let zukan = {};
  assert.deepStrictEqual(zukanProgress(zukan, 'sea'), { found: 0, total: BLOCK_SETS.sea.adult.length });
  let r = addToZukan(zukan, 'sea', 'whale');
  assert.ok(r.isNew, 'はじめての 子は とうろく');
  zukan = r.zukan;
  r = addToZukan(zukan, 'sea', 'whale');
  assert.ok(!r.isNew, '2かいめは とうろく しない');
  assert.strictEqual(zukanProgress(r.zukan, 'sea').found, 1);
  assert.ok(!addToZukan(zukan, 'sea', 'tyrannosaurus').isNew, 'ちがう なかまの 子は のらない');
  assert.deepStrictEqual(zukanProgress({ sea: 'こわれた' }, 'sea').found, 0, 'こわれた 保存データでも うごく');
  assert.ok(!('whale' in {}) && zukan.sea.length === 1, 'もとの ずかんは かえない');
  let all = {};
  let complete = false;
  for (const id of BLOCK_SETS.dino.adult) ({ zukan: all, complete } = addToZukan(all, 'dino', id));
  assert.ok(complete, 'ぜんぶ あつめたら コンプリート');
  assert.deepStrictEqual(zukanProgress(all, 'dino'), { found: 30, total: 30 });
  // ずかんの ぜんぶを わたせる（ずかん画の しゅるい。v0.19.1）
  const list = ['a', 'b'];
  assert.ok(addToZukan({}, 'insect', 'a', list).isNew);
  assert.ok(!addToZukan({}, 'insect', 'whale', list).isNew, 'リストに ない 子は のらない');
  assert.deepStrictEqual(zukanProgress({ insect: ['a', 'x'] }, 'insect', list), { found: 1, total: 2 });
}

// ---------- ずかんは 2さつ（v0.19.1）: かんたん・ふつう＝つみきの 絵、むずかしい・おとな＝ずかん画 ----------
{
  assert.strictEqual(bookOf('easy'), 'easy');
  assert.strictEqual(bookOf('normal'), 'easy');
  assert.strictEqual(bookOf('hard'), 'hard');
  assert.strictEqual(bookOf('adult'), 'hard');
  assert.strictEqual(bookOf('へん'), 'easy');
  assert.strictEqual(ZUKAN_KEYS.hard, 'zukan', 'むずかしい・おとなは いままでの 記録を そのまま つかう');
  assert.notStrictEqual(ZUKAN_KEYS.easy, ZUKAN_KEYS.hard);
  // かんたん: 1かいめで あてたら ずかんに のる。まちがえてから あてたら のらない
  const e = createGame({ set: 'sea', difficulty: 'easy', rng: makeRng(3) });
  const e1 = nextQuestion(e);
  assert.ok(answerAt(e, e1.correctIndex, 9000).collect, '1かいめで あてたら のる（おそくても）');
  const e2 = nextQuestion(e);
  answerAt(e, (e2.correctIndex + 1) % OPTIONS, 100);
  const late = answerAt(e, e2.correctIndex, 200);
  assert.ok(late.correct && !late.collect, 'まちがえてから あてたら のらない');
  const h = createGame({ set: 'sea', difficulty: 'hard', rng: makeRng(5) });
  const h1 = nextQuestion(h);
  assert.ok(answerAt(h, h1.correctIndex, 5000).collect, 'しょうぶで 正解したら のる');
}

console.log('guess.test.js: すべてのテストに合格');
