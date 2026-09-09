// listen.test.js — きいてタッチの純ロジックのNodeテスト
// 実行方法: node tests/listen.test.js

import assert from 'node:assert';
import {
  OPTION_COUNT,
  QUESTIONS_PER_ROUND,
  COUNT_WORDS,
  itemKey,
  buildQuestion,
  createGame,
  nextQuestion,
  answer,
  robotAnswer,
} from '../js/games/listen/game.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function checkCommon(q, difficulty) {
  assert.strictEqual(q.options.length, OPTION_COUNT, `${difficulty}: 4枚`);
  assert.strictEqual(new Set(q.options.map(itemKey)).size, OPTION_COUNT, `${difficulty}: 選択肢は重複しない`);
  assert.ok(q.correctIndex >= 0 && q.correctIndex < OPTION_COUNT);
  assert.ok(q.phrase.length > 0 && q.label.length > 0 && q.ja.length > 0);
  assert.ok(/^[ぁ-んァ-ンー0-9 ]+$/.test(q.ja), `${difficulty}: 日本語はかなと数字のみ (${q.ja})`);
}

// ---------- かんたん: 単語1語 ----------
{
  const rng = seeded(1);
  for (let i = 0; i < 100; i++) {
    const q = buildQuestion('easy', { categories: ['fruit', 'animal'], rng });
    checkCommon(q, 'easy');
    assert.strictEqual(q.kind, 'word');
    const ans = q.options[q.correctIndex];
    assert.ok(['fruit', 'animal'].includes(ans.word.cat), '正解は指定カテゴリ');
    assert.strictEqual(q.phrase, ans.word.en, 'かんたんは単語のみ読む');
    assert.strictEqual(q.ja, ans.word.ja);
  }
}

// ---------- ふつう: 色×形。しろは出ない。ダミーは色ちがい・形ちがいを含む ----------
{
  const rng = seeded(2);
  for (let i = 0; i < 100; i++) {
    const q = buildQuestion('normal', { rng });
    checkCommon(q, 'normal');
    assert.strictEqual(q.kind, 'colorShape');
    const ans = q.options[q.correctIndex];
    assert.strictEqual(ans.word.cat, 'shape');
    assert.strictEqual(ans.color.cat, 'color');
    assert.notStrictEqual(ans.color.id, 'white');
    assert.strictEqual(q.phrase, `Touch the ${ans.color.en} ${ans.word.en}.`);
    const dummies = q.options.filter((o) => itemKey(o) !== itemKey(ans));
    assert.ok(dummies.some((d) => d.color.id === ans.color.id && d.word.id !== ans.word.id), '同じ色で別の形');
    assert.ok(dummies.some((d) => d.word.id === ans.word.id && d.color.id !== ans.color.id), '同じ形で別の色');
  }
}

// ---------- むずかしい: 数×どうぶつ／大小 ----------
{
  const rng = seeded(3);
  const kinds = new Set();
  for (let i = 0; i < 200; i++) {
    const q = buildQuestion('hard', { rng });
    checkCommon(q, 'hard');
    kinds.add(q.kind);
    const ans = q.options[q.correctIndex];
    assert.strictEqual(ans.word.cat, 'animal');
    if (q.kind === 'count') {
      assert.ok(ans.count >= 1 && ans.count <= 5);
      const expectedNoun = ans.count === 1 ? ans.word.en : `${ans.word.en}s`;
      assert.strictEqual(q.phrase, `Touch ${COUNT_WORDS[ans.count - 1]} ${expectedNoun}.`);
      const sameAnimal = q.options.filter((o) => o.word.id === ans.word.id);
      assert.strictEqual(sameAnimal.length, 3, '同じどうぶつで数ちがいが2枚');
      assert.ok(q.options.some((o) => o.word.id !== ans.word.id && o.count === ans.count), '同じ数で別のどうぶつ');
    } else {
      assert.strictEqual(q.kind, 'size');
      assert.ok(['big', 'small'].includes(ans.size));
      assert.strictEqual(q.phrase, `Touch the ${ans.size} ${ans.word.en}.`);
      assert.ok(q.options.some((o) => o.word.id === ans.word.id && o.size !== ans.size), '同じどうぶつの逆サイズ');
    }
  }
  assert.deepStrictEqual([...kinds].sort(), ['count', 'size'], '両方の出題が出る');
}

// ---------- ラウンド: 10問・早押し・ふたり同時ロック ----------
{
  const state = createGame({ difficulty: 'easy', mode: 'cpu', rng: seeded(4) });
  let r;
  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const q = nextQuestion(state);
    assert.ok(q);
    if (i % 2) r = robotAnswer(state, q.correctIndex);
    else r = answer(state, 0, q.correctIndex);
  }
  assert.deepStrictEqual(r.roundOver, { scores: [5, 5], winner: null });
  assert.strictEqual(nextQuestion(state), null);
  assert.strictEqual(state.maxCombo, 1);

  const two = createGame({ difficulty: 'normal', mode: 'two', rng: seeded(5) });
  const q = nextQuestion(two);
  const wrong = (q.correctIndex + 1) % OPTION_COUNT;
  answer(two, 0, wrong);
  assert.strictEqual(q.locked[0], true, 'ふたり同時はまちがえた側をロック');
  assert.strictEqual(answer(two, 0, q.correctIndex).ok, false);
  assert.strictEqual(answer(two, 1, q.correctIndex).correct, true);
  assert.deepStrictEqual(two.scores, [0, 1]);
}

// 出題が少ない難易度（むずかしい）でも10問回る
{
  const state = createGame({ difficulty: 'hard', mode: 'solo', rng: seeded(6) });
  let n = 0;
  while (nextQuestion(state)) {
    answer(state, 0, state.current.correctIndex);
    n++;
  }
  assert.strictEqual(n, 10);
  assert.strictEqual(state.combo, 10);
}

console.log('listen.test.js: all passed');
