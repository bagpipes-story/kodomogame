// abc.test.js — ABCタッチ（じゅんばんABC／はじめのもじ）と quiz.js の純ロジックのNodeテスト
// 実行方法: node tests/abc.test.js

import assert from 'node:assert';
import {
  ORDER_LEVELS,
  MISS_PENALTY_MS,
  INITIAL_QUESTIONS,
  lettersFor,
  createOrderGame,
  dealBoard,
  tapLetter,
  scoreOf,
  buildInitialQuestion,
  createInitialGame,
  currentPlayerOf,
  nextInitialQuestion,
  answerInitial,
} from '../js/games/abc/game.js';
import { createQuizState, beginQuestion, answer, robotAnswer } from '../js/quiz.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 文字セット ----------

{
  assert.deepStrictEqual(lettersFor('easy'), 'ABCDEFGH'.split(''));
  assert.strictEqual(lettersFor('normal').join(''), 'ABCDEFGHIJKLMNOP');
  assert.strictEqual(lettersFor('hard').join(''), 'abcdefghijklmnopqrstuvwxyz', 'むずかしいは小文字26');
  for (const [k, def] of Object.entries(ORDER_LEVELS)) {
    assert.ok(def.cols * def.rows >= def.count, `${k}: マス数が文字数以上`);
  }
}

// ---------- じゅんばんABC: 配置・順番判定・タイムとミス加算 ----------

{
  const state = createOrderGame({ difficulty: 'normal', mode: 'solo', rng: seeded(2) });
  const cards = dealBoard(state, 1000);
  assert.strictEqual(cards.length, 16);
  assert.strictEqual(new Set(cards.map((c) => c.cell)).size, 16, 'マスは重複しない');
  for (const c of cards) assert.ok(c.cell >= 0 && c.cell < 20);

  assert.deepStrictEqual(tapLetter(state, 'B', 1100), { ok: true, correct: false, expected: 'A' });
  assert.strictEqual(state.misses, 1);
  let r;
  for (const letter of state.letters) {
    r = tapLetter(state, letter, 1000 + 500 * (state.nextIndex + 1));
    assert.strictEqual(r.correct, true);
  }
  assert.strictEqual(r.done, true);
  assert.strictEqual(r.result.timeMs, 8000);
  assert.strictEqual(r.result.misses, 1);
  assert.strictEqual(r.result.scoreMs, 8000 + MISS_PENALTY_MS);
  assert.strictEqual(scoreOf(r.result), r.result.scoreMs);
  assert.deepStrictEqual(r.roundOver.winner, null);
  assert.strictEqual(tapLetter(state, 'A', 99999).ok, false, '終了後は押せない');
}

// こうたい対戦: あか→あお、スコア（タイム＋ミス加算）が短い方の勝ち
{
  const state = createOrderGame({ difficulty: 'easy', mode: 'two', rng: seeded(4) });
  dealBoard(state, 0);
  let r;
  for (const letter of state.letters) r = tapLetter(state, letter, 8000);
  assert.deepStrictEqual(r.roundOver, { nextPlayer: 1 });
  assert.strictEqual(state.currentPlayer, 1);
  dealBoard(state, 10000);
  tapLetter(state, 'C', 10100); // あおは1ミス（+2秒）
  for (const letter of state.letters) r = tapLetter(state, letter, 17000);
  assert.strictEqual(r.roundOver.winner, 0, 'あか8.0秒 vs あお7.0+2.0秒 → あかの勝ち');
  assert.strictEqual(r.roundOver.results[1].scoreMs, 9000);
}

// ---------- はじめのもじ: 3択・正解は頭文字・むずかしいは小文字 ----------

{
  const rng = seeded(5);
  for (let i = 0; i < 100; i++) {
    const q = buildInitialQuestion(i % 2 ? 'hard' : 'easy', { rng });
    assert.strictEqual(q.options.length, 3);
    assert.strictEqual(new Set(q.options).size, 3, '選択肢は重複しない');
    assert.strictEqual(q.options[q.correctIndex], q.letter);
    const expected = q.word.en[0];
    assert.strictEqual(q.letter, i % 2 ? expected.toLowerCase() : expected.toUpperCase());
    for (const c of q.options) assert.ok(i % 2 ? /^[a-z]$/.test(c) : /^[A-Z]$/.test(c));
  }
  const q = buildInitialQuestion('easy', { categories: ['fruit'], rng });
  assert.strictEqual(q.word.cat, 'fruit');
}

// 10問・こうたい（1問ごとに あか→あお）・まちがえてもロックされず選び直せる
{
  const state = createInitialGame({ difficulty: 'easy', mode: 'two', rng: seeded(6) });
  const asked = [];
  for (let i = 0; i < INITIAL_QUESTIONS; i++) {
    const q = nextInitialQuestion(state);
    asked.push(q.word.id);
    assert.strictEqual(currentPlayerOf(state), i % 2);
    const wrong = (q.correctIndex + 1) % 3;
    const miss = answerInitial(state, wrong);
    assert.strictEqual(miss.correct, false);
    assert.strictEqual(q.locked[i % 2], false, 'こうたいではロックしない');
    const r = answerInitial(state, q.correctIndex);
    assert.strictEqual(r.correct, true);
    if (i === INITIAL_QUESTIONS - 1) assert.deepStrictEqual(r.roundOver, { scores: [5, 5], winner: null });
    else assert.strictEqual(r.roundOver, null);
  }
  assert.strictEqual(new Set(asked).size, INITIAL_QUESTIONS, '10問は重複しない');
  assert.strictEqual(state.firstTryCorrect, 0);
  assert.strictEqual(nextInitialQuestion(state), null);
}

// ---------- quiz.js: 連続正解カウント・ロボくん ----------

{
  const state = createQuizState({ mode: 'cpu', questions: 4 });
  beginQuestion(state, { correctIndex: 0, options: [1, 2] });
  answer(state, 0, 0);
  beginQuestion(state, { correctIndex: 1, options: [1, 2] });
  answer(state, 0, 1);
  assert.strictEqual(state.combo, 2);
  assert.strictEqual(state.maxCombo, 2);
  beginQuestion(state, { correctIndex: 0, options: [1, 2] });
  assert.strictEqual(robotAnswer(state, 1).correct, false, 'ロボくん外す');
  assert.strictEqual(state.current.robotMissed, true);
  assert.strictEqual(robotAnswer(state, 0).correct, true);
  assert.strictEqual(state.combo, 0, 'ロボくんに取られると連続は切れる');
  beginQuestion(state, { correctIndex: 0, options: [1, 2] });
  const r = answer(state, 0, 0);
  assert.deepStrictEqual(r.roundOver, { scores: [3, 1], winner: 0 });
  assert.strictEqual(state.maxCombo, 2);
  assert.strictEqual(beginQuestion(state, { correctIndex: 0, options: [] }), null, '問数を超えたら出ない');
}

console.log('abc.test.js: all passed');
