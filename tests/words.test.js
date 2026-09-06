// words.test.js — 英単語データとrace.jsの純ロジックのNodeテスト
// 実行方法: node tests/words.test.js

import assert from 'node:assert';
import { CATEGORIES, WORDS, wordById, wordsByCategory, pickWords } from '../js/words.js';
import { RACE_LEVELS, assistExtraMs, gaugeDuration, robotChoice } from '../js/race.js';

// ---------- 単語データ: 6カテゴリ50語・id重複なし・日本語はかなのみ ----------

{
  assert.strictEqual(WORDS.length, 50, '50語');
  assert.deepStrictEqual(CATEGORIES, ['animal', 'fruit', 'color', 'number', 'shape', 'body']);
  const counts = { animal: 8, fruit: 8, color: 8, number: 10, shape: 8, body: 8 };
  for (const [cat, n] of Object.entries(counts)) {
    assert.strictEqual(wordsByCategory(cat).length, n, `${cat}は${n}語`);
  }
  const ids = new Set(WORDS.map((w) => w.id));
  assert.strictEqual(ids.size, 50, 'idは重複しない');
  for (const w of WORDS) {
    assert.ok(/^[ぁ-んァ-ンー]+$/.test(w.ja), `${w.id}: 日本語はひらがな・カタカナのみ (${w.ja})`);
    assert.ok(/^[a-z]+$/.test(w.en), `${w.id}: 英語は小文字のみ`);
    assert.ok(['emoji', 'color', 'number', 'shape'].includes(w.kind), `${w.id}: kindが正しい`);
  }
  assert.strictEqual(wordById('apple').ja, 'りんご');
  assert.strictEqual(wordById('nothing'), null);
}

// ---------- pickWords: 重複なし・カテゴリ指定・除外 ----------

{
  let i = 0;
  const rng = () => ((i++ * 7919) % 100) / 100;
  const picked = pickWords(12, { categories: ['animal', 'fruit'], rng });
  assert.strictEqual(picked.length, 12);
  assert.strictEqual(new Set(picked.map((w) => w.id)).size, 12, '重複なし');
  assert.ok(picked.every((w) => w.cat === 'animal' || w.cat === 'fruit'), 'カテゴリ指定どおり');
  const excluded = pickWords(7, { categories: ['animal'], exclude: ['lion'], rng });
  assert.ok(!excluded.some((w) => w.id === 'lion'), '除外が効く');
  assert.strictEqual(excluded.length, 7);
}

// ---------- race.js: ゲージ時間・正解率・アシスト ----------

{
  for (const level of ['weak', 'normal', 'strong']) {
    const { minMs, maxMs } = RACE_LEVELS[level];
    assert.ok(gaugeDuration(level, () => 0) === minMs, `${level}: 最短`);
    assert.ok(gaugeDuration(level, () => 0.999) < maxMs + 1, `${level}: 最長`);
  }
  assert.strictEqual(assistExtraMs('weak', 2), 2000, 'よわいで2連敗→+2秒');
  assert.strictEqual(assistExtraMs('weak', 1), 0);
  assert.strictEqual(assistExtraMs('normal', 5), 0, 'ふつう以上はアシストなし');
  assert.strictEqual(gaugeDuration('weak', () => 0, 2000), 8000, 'アシットぶん長くなる');

  // つよいは必ず正解、正解率0なら必ず外す（外すときは正解以外）
  for (let k = 0; k < 20; k++) {
    assert.strictEqual(robotChoice('strong', 2, 4, Math.random), 2, 'つよいは100%正解');
  }
  const alwaysMiss = () => 0.99; // accuracy判定で外す→wrongの末尾
  const miss = robotChoice('weak', 1, 4, alwaysMiss);
  assert.notStrictEqual(miss, 1, '外すときは正解以外');
  assert.ok(miss >= 0 && miss < 4);
  // よわいの正解率はおよそ60%
  let hits = 0;
  let s = 7;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 2000; k++) if (robotChoice('weak', 0, 3, rng) === 0) hits++;
  assert.ok(hits > 1100 && hits < 1300, `よわいの正解率≈60% (${hits}/2000)`);
}

console.log('words.test.js: すべてのテストに合格');
