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
  zukanPool,
  planRound,
  zukanOptions,
  UNSEEN_PER_ROUND,
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
  assert.ok(Math.abs(revealProgress(DIFFICULTY.hard.limitMs, DIFFICULTY.hard.revealMs) - 0.9) < 1e-9, 'むずかしい: 時間が 0の とき 9わり 見えて いる（v0.19.4）');
  assert.ok(Math.abs(revealProgress(DIFFICULTY.adult.limitMs, DIFFICULTY.adult.revealMs) - 0.8) < 1e-9, 'おとな: 時間が 0の とき 8わり 見えて いる（v0.19.3）');
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

// ---------- ずかん画の 出題（v0.19.7）: level・まだの 子を 多めに・にている 選択肢・なかまを しぼる ----------
{
  // 12種: A なかま（科 a1・a2）と B なかま。level 3 は おとな だけ
  const sp = {
    a1: ['a', 'x', 1, ['a2']], a2: ['a', 'x', 1, ['a1']], a3: ['a', 'x', 2, []], a4: ['a', 'x', 3, []],
    b1: ['b', 'x', 1, []], b2: ['b', 'x', 1, []], b3: ['b', 'x', 2, []],
    c1: ['c', 'y', 1, []], c2: ['c', 'y', 1, []], c3: ['c', 'y', 1, []], c4: ['c', 'y', 2, []], c5: ['c', 'y', 1, []],
  };
  const allIds = Object.keys(sp);
  const makeZukan = (ids, unseen = new Set()) => ({
    ids, allIds, unseen,
    levelOf: (id) => sp[id][2],
    closeOf: (id) => ({
      similar: sp[id][3],
      group: allIds.filter((o) => sp[o][0] === sp[id][0]),
      order: allIds.filter((o) => sp[o][1] === sp[id][1]),
    }),
  });
  const z = makeZukan(allIds);
  assert.ok(!zukanPool(z, 'hard').includes('a4'), 'むずかしいに level 3 は 出ない');
  assert.ok(zukanPool(z, 'adult').includes('a4'), 'おとなは ぜんぶ');

  // まだ ずかんに ない 子を 先に（7つまで）
  for (let seed = 1; seed < 30; seed++) {
    const unseen = new Set(['a1', 'b2', 'c3']);
    const plan = planRound(zukanPool(z, 'adult'), unseen, makeRng(seed));
    assert.strictEqual(plan.length, QUESTIONS_PER_ROUND);
    for (const id of unseen) assert.ok(plan.includes(id), `まだの ${id} は かならず 出る`);
    for (let i = 1; i < plan.length; i++) assert.notStrictEqual(plan[i], plan[i - 1], 'となりどうし 同じ 子に ならない');
    assert.strictEqual(new Set(plan).size, plan.length, '顔ぶれが 10より 多ければ かさならない');
  }
  const manyUnseen = planRound(allIds, new Set(allIds), makeRng(7));
  assert.strictEqual(manyUnseen.length, QUESTIONS_PER_ROUND);
  assert.ok(UNSEEN_PER_ROUND >= 6 && UNSEEN_PER_ROUND <= 8);
  // 顔ぶれが すくない（しぼった）ときは くりかえす
  const small = planRound(['a1', 'a2', 'a3'], new Set(), makeRng(3));
  assert.strictEqual(small.length, QUESTIONS_PER_ROUND);
  for (let i = 1; i < small.length; i++) assert.notStrictEqual(small[i], small[i - 1], '3つでも となりは ちがう');

  // えらぶ ボタン: こたえ＋にている 2つ（にている → 同じ 科）＋ ほか 1つ
  for (let seed = 1; seed < 30; seed++) {
    const opts = zukanOptions('a1', z, allIds, makeRng(seed));
    assert.strictEqual(opts.length, OPTIONS);
    assert.strictEqual(new Set(opts).size, OPTIONS, 'かさならない');
    assert.ok(opts.includes('a1'));
    assert.ok(opts.includes('a2'), 'にている 種類（similar）は かならず 入る');
    assert.strictEqual(opts.filter((id) => sp[id][0] === 'a').length, 3, 'こたえ＋同じ 科が ちょうど 2つ');
    assert.ok(opts.some((id) => sp[id][1] !== 'x'), 'のこり 1つは ちがう 目から（v0.19.8）');
  }
  // ちがう 科が ない（a の 科だけ）ときは しかたなく 同じ 科も
  for (let seed = 1; seed < 20; seed++) {
    const only = zukanOptions('a1', z, ['a1', 'a2', 'a3', 'a4'], makeRng(seed));
    assert.strictEqual(new Set(only).size, OPTIONS);
  }
  // 目を こうちゅう（x）に しぼった とき: のこり 1つは ちがう 科（b）から
  for (let seed = 1; seed < 20; seed++) {
    const xs = allIds.filter((id) => sp[id][1] === 'x');
    const o = zukanOptions('a1', makeZukan(xs), xs, makeRng(seed));
    assert.ok(o.some((id) => sp[id][0] === 'b'), 'しぼっても のこり 1つは ちがう 科から');
  }
  // なかまを しぼって 3つしか ない ときは、のこりを その なかまの ぜんぶから
  const narrow = makeZukan(['b1', 'b2', 'b3']);
  const nOpts = zukanOptions('b1', narrow, ['b1', 'b2', 'b3'], makeRng(2));
  assert.strictEqual(new Set(nOpts).size, OPTIONS);

  // createGame: しょうぶ だけ ずかん画の 出題。10問 ぜんぶ 出せる
  const g = createGame({ set: 'insect', difficulty: 'hard', rng: makeRng(5), zukan: makeZukan(allIds, new Set(['c5'])) });
  const asked = [];
  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const q = nextQuestion(g);
    assert.ok(q && q.options.length === OPTIONS && q.options[q.correctIndex] === q.answer);
    assert.ok(sp[q.answer][2] <= 2, 'むずかしい: level 2 まで');
    asked.push(q.answer);
    answerAt(g, q.correctIndex, 100);
  }
  assert.ok(asked.includes('c5'), 'まだの 子が 出る');
  assert.strictEqual(nextQuestion(g), null);
  const easyZ = createGame({ set: 'insect', difficulty: 'easy', zukan: makeZukan(allIds) });
  assert.strictEqual(easyZ.plan, null, 'かんたんは ずかん画の 出題を つかわない');
}

console.log('guess.test.js: すべてのテストに合格');
