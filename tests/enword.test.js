// enword.test.js — えいごカードあての純ロジックのNodeテスト
// 実行方法: node tests/enword.test.js

import assert from 'node:assert';
import {
  QUESTIONS_PER_ROUND,
  DIFFICULTY,
  normalizeCategories,
  buildQuestion,
  createGame,
  nextQuestion,
  addListen,
  answer,
  robotAnswer,
} from '../js/games/enword/game.js';
import { WORDS, CATEGORIES } from '../js/words.js';

// 再現性のある乱数（テスト用）
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 難易度定義 ----------

{
  assert.strictEqual(QUESTIONS_PER_ROUND, 10);
  assert.strictEqual(DIFFICULTY.easy.options, 3);
  assert.strictEqual(DIFFICULTY.normal.options, 4);
  assert.strictEqual(DIFFICULTY.hard.options, 6);
  assert.strictEqual(DIFFICULTY.easy.autoPlays, 2, 'かんたんは自動2回');
  assert.strictEqual(DIFFICULTY.hard.autoPlays, 0, 'むずかしいはスピーカーのみ');
  assert.strictEqual(DIFFICULTY.easy.speaker, false);
  assert.deepStrictEqual(normalizeCategories(['animal']), ['animal']);
  assert.deepStrictEqual(normalizeCategories([]), CATEGORIES, '空なら全カテゴリ');
  assert.deepStrictEqual(normalizeCategories(['nope']), CATEGORIES, '不正なら全カテゴリ');
}

// ---------- 出題: 枚数・重複なし・正解が含まれる・ダミーのルール ----------

{
  const rng = seeded(1);
  for (let i = 0; i < 200; i++) {
    for (const [difficulty, def] of Object.entries(DIFFICULTY)) {
      const q = buildQuestion(difficulty, { rng });
      assert.strictEqual(q.options.length, def.options, `${difficulty}: 選択肢${def.options}枚`);
      assert.strictEqual(new Set(q.options.map((w) => w.id)).size, def.options, '選択肢は重複しない');
      assert.strictEqual(q.options[q.correctIndex].id, q.answer.id, '正解indexが合っている');
      const dummies = q.options.filter((w) => w.id !== q.answer.id);
      if (difficulty === 'easy') {
        for (const d of dummies) {
          assert.notStrictEqual(d.cat, q.answer.cat, 'かんたん: 別カテゴリ');
          assert.notStrictEqual(d.en[0], q.answer.en[0], 'かんたん: 頭文字が違う');
        }
      } else if (difficulty === 'normal') {
        for (const d of dummies) assert.strictEqual(d.cat, q.answer.cat, 'ふつう: 同カテゴリ');
      } else {
        for (const d of dummies) assert.strictEqual(d.cat, q.answer.cat, 'むずかしい: 同カテゴリ');
        // 同じ頭文字の語があるカテゴリでは、それが優先して入る（例: p→panda/peach…は別カテゴリなので対象外）
        const sameInitial = WORDS.filter((w) => w.cat === q.answer.cat && w.id !== q.answer.id && w.en[0] === q.answer.en[0]);
        const included = dummies.filter((d) => d.en[0] === q.answer.en[0]).length;
        assert.strictEqual(included, Math.min(sameInitial.length, def.options - 1), 'むずかしい: 同じ頭文字を優先');
      }
    }
  }
}

// カテゴリ指定: 正解は指定カテゴリから。かんたんはダミーが別カテゴリ、
// カテゴリ内で語彙が足りないときも枚数は保証される（かたち8語でむずかしい6枚）
{
  const rng = seeded(7);
  for (let i = 0; i < 50; i++) {
    const q = buildQuestion('easy', { categories: ['number'], rng });
    assert.strictEqual(q.answer.cat, 'number');
    assert.strictEqual(q.options.length, 3);
    const q2 = buildQuestion('hard', { categories: ['shape'], rng });
    assert.strictEqual(q2.answer.cat, 'shape');
    assert.strictEqual(q2.options.length, 6);
  }
  const q3 = buildQuestion('normal', { categories: ['animal'], exclude: WORDS.filter((w) => w.cat === 'animal').map((w) => w.id).slice(0, 7), rng });
  assert.strictEqual(q3.answer.cat, 'animal', '除外しても残りから出す');
}

// ---------- ラウンド進行（ひとり）: 10問・重複出題なし・間違えても選び直せる ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'solo', rng: seeded(3) });
  const asked = [];
  for (let i = 0; i < 10; i++) {
    const q = nextQuestion(state);
    assert.ok(q, `${i + 1}問目が出る`);
    asked.push(q.answer.id);
    // 不正解→灰色になるだけ（ロックされない）→正解でき、まちがえた問は firstTry に数えない
    const wrongIndex = (q.correctIndex + 1) % q.options.length;
    if (i % 2 === 0) {
      const r = answer(state, 0, wrongIndex);
      assert.deepStrictEqual({ ok: r.ok, correct: r.correct }, { ok: true, correct: false });
      assert.ok(q.wrong.has(wrongIndex));
      assert.strictEqual(q.locked[0], false, 'ひとりではロックしない');
    }
    const r = answer(state, 0, q.correctIndex);
    assert.strictEqual(r.correct, true);
    assert.strictEqual(q.done, true);
    assert.strictEqual(answer(state, 0, q.correctIndex).ok, false, '終わった問には答えられない');
    if (i < 9) assert.strictEqual(r.roundOver, null);
    else {
      assert.deepStrictEqual(r.roundOver, { scores: [10, 0], winner: null });
    }
  }
  assert.strictEqual(new Set(asked).size, 10, '10問は重複しない');
  assert.strictEqual(state.firstTryCorrect, 5, '一発正解は5問');
  assert.strictEqual(nextQuestion(state), null, '11問目は出ない');
}

// 語彙が10語未満のカテゴリ（どうぶつ8語）でも10問出る
{
  const state = createGame({ difficulty: 'normal', mode: 'solo', categories: ['animal'], rng: seeded(5) });
  let count = 0;
  while (nextQuestion(state)) {
    answer(state, 0, state.current.correctIndex);
    count++;
  }
  assert.strictEqual(count, 10);
  assert.strictEqual(state.scores[0], 10);
}

// ---------- ロボくんと: 早押しの得点・外したら次は当てる目印 ----------

{
  const state = createGame({ difficulty: 'normal', mode: 'cpu', rng: seeded(9) });
  const q = nextQuestion(state);
  addListen(state);
  assert.strictEqual(q.listens, 1);
  const miss = robotAnswer(state, (q.correctIndex + 1) % q.options.length);
  assert.deepStrictEqual({ ok: miss.ok, correct: miss.correct }, { ok: true, correct: false });
  assert.strictEqual(q.robotMissed, true);
  assert.strictEqual(q.done, false, '外したら問は続く');
  const got = robotAnswer(state, q.correctIndex);
  assert.strictEqual(got.correct, true);
  assert.deepStrictEqual(state.scores, [0, 1]);
  assert.strictEqual(answer(state, 0, q.correctIndex).ok, false, 'ロボくんが取った後は答えられない');

  // 子どもが先に取ればロボくんは答えられない
  const q2 = nextQuestion(state);
  answer(state, 0, q2.correctIndex);
  assert.strictEqual(robotAnswer(state, q2.correctIndex).ok, false);
  assert.deepStrictEqual(state.scores, [1, 1]);

  // 10問終了時の勝敗
  for (let i = 2; i < 10; i++) {
    const qn = nextQuestion(state);
    const r = i % 3 === 0 ? robotAnswer(state, qn.correctIndex) : answer(state, 0, qn.correctIndex);
    if (i === 9) assert.deepStrictEqual(r.roundOver, { scores: [6, 4], winner: 0 });
  }
}

// ---------- ふたり同時: 先に正解した側が得点、まちがえた側はその問だけロック ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'two', rng: seeded(11) });
  const q = nextQuestion(state);
  const wrong = (q.correctIndex + 1) % q.options.length;
  assert.strictEqual(answer(state, 1, wrong).correct, false);
  assert.strictEqual(q.locked[1], true, 'あおはロック');
  assert.strictEqual(answer(state, 1, q.correctIndex).ok, false, 'ロック中は正解でも無効');
  assert.strictEqual(answer(state, 0, q.correctIndex).correct, true);
  assert.deepStrictEqual(state.scores, [1, 0]);

  const q2 = nextQuestion(state);
  assert.strictEqual(q2.locked[0], false, '次の問でロック解除');
  const w2 = (q2.correctIndex + 1) % q2.options.length;
  assert.strictEqual(answer(state, 0, w2).bothLocked, undefined);
  const r = answer(state, 1, w2);
  assert.strictEqual(r.bothLocked, true, '両方まちがえたら正解を見せて次へ');
  assert.strictEqual(q2.done, true);
  assert.strictEqual(q2.winner, null);
  assert.deepStrictEqual(state.scores, [1, 0]);

  for (let i = 2; i < 10; i++) {
    const qn = nextQuestion(state);
    const r2 = answer(state, 1, qn.correctIndex);
    if (i === 9) assert.deepStrictEqual(r2.roundOver, { scores: [1, 8], winner: 1 });
  }
}

console.log('enword.test.js: all passed');
