// flash.test.js — すうじフラッシュの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/flash.test.js

import assert from 'node:assert';
import {
  MAX_N,
  CELL_COUNT,
  DIFFICULTY,
  createGame,
  dealLevel,
  tapNumber,
} from '../js/games/flash/game.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// レベルを最初から順番どおりタップしてクリアするヘルパー
function clearLevel(state) {
  const n = state.level;
  let last = null;
  for (let num = 1; num <= n; num++) last = tapNumber(state, num);
  return last;
}

// ---------- 難易度定義 ----------

{
  assert.strictEqual(DIFFICULTY.easy.startN, 3, 'かんたんは3こから');
  assert.strictEqual(DIFFICULTY.normal.startN, 4, 'ふつうは4こから');
  assert.strictEqual(DIFFICULTY.hard.startN, 5, 'むずかしいは5こから');
  assert.ok(DIFFICULTY.easy.showMs > DIFFICULTY.normal.showMs, 'かんたんほど表示が長い');
  assert.ok(DIFFICULTY.normal.showMs > DIFFICULTY.hard.showMs, 'むずかしいほど表示が短い');
  assert.strictEqual(MAX_N, 9, '上限は9こ');
}

// ---------- 配札: N枚・セル重複なし・数字1..N ----------

{
  const state = createGame({ difficulty: 'hard', rng: makeRng([0.1, 0.5, 0.9, 0.3, 0.7]) });
  const cards = dealLevel(state);
  assert.strictEqual(cards.length, 5, 'むずかしいは5枚');
  const cells = new Set(cards.map((c) => c.cell));
  assert.strictEqual(cells.size, 5, 'セルは重複しない');
  for (const card of cards) {
    assert.ok(card.cell >= 0 && card.cell < CELL_COUNT, 'セルは範囲内');
  }
  assert.deepStrictEqual(cards.map((c) => c.num).sort(), [1, 2, 3, 4, 5], '数字は1..N');
  assert.strictEqual(state.nextExpected, 1, '配札で期待値リセット');
}

// ---------- 正解を順にタップ→レベルクリア→+1こ ----------

{
  const state = createGame({ difficulty: 'easy' });
  dealLevel(state);
  assert.strictEqual(tapNumber(state, 1).correct, true);
  assert.strictEqual(tapNumber(state, 2).levelCleared, false);
  const result = tapNumber(state, 3);
  assert.strictEqual(result.levelCleared, true, '3こ目でレベルクリア');
  assert.strictEqual(result.roundOver, null, 'まだラウンドは続く');
  assert.strictEqual(state.level, 4, '次は4こ');
  assert.strictEqual(state.reached, 3, '到達3こ');
}

// ---------- 9こクリアでラウンド終了 ----------

{
  const state = createGame({ difficulty: 'hard' }); // 5こから
  let last = null;
  for (let i = 0; i < 5; i++) {
    dealLevel(state);
    last = clearLevel(state);
  }
  assert.strictEqual(state.finished, true, '9こクリアで終了');
  assert.strictEqual(last.roundOver.reached, 9, '到達9こ');
  assert.strictEqual(tapNumber(state, 1).ok, false, '終了後は反応しない');
}

// ---------- ミス1回目=再挑戦、2回目=ラウンド終了 ----------

{
  const state = createGame({ difficulty: 'easy' });
  dealLevel(state);
  clearLevel(state); // 3こクリア→4こへ
  dealLevel(state);
  const miss1 = tapNumber(state, 2); // 1の前に2を押した
  assert.strictEqual(miss1.correct, false);
  assert.strictEqual(miss1.retry, true, '1回目は再挑戦できる');
  assert.strictEqual(state.finished, false);

  dealLevel(state); // 同レベルをもう1回
  assert.strictEqual(state.level, 4, 'レベルは変わらない');
  tapNumber(state, 1);
  const miss2 = tapNumber(state, 3); // 2の前に3
  assert.strictEqual(miss2.retry, false, '2回目のミスで終了');
  assert.strictEqual(miss2.roundOver.finished, true);
  assert.strictEqual(miss2.roundOver.reached, 3, 'スコアはクリア済みの3こ');
}

// ---------- ミス後の再挑戦成功でcomebackフラグ ----------

{
  const state = createGame({ difficulty: 'easy' });
  dealLevel(state);
  tapNumber(state, 2); // ミス
  dealLevel(state);
  clearLevel(state);
  assert.strictEqual(state.clearedAfterMiss, true, 'ミス後のクリアを記録');
  assert.strictEqual(state.missedInRound, true, 'ひとめクリアではない');
}

// ---------- こうたい対戦: 交代と勝敗 ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'two' });
  dealLevel(state);
  clearLevel(state); // あか: 3こクリア
  dealLevel(state);
  tapNumber(state, 9); // ミス1
  dealLevel(state);
  const over = tapNumber(state, 9); // ミス2→あかのラウンド終了
  assert.strictEqual(over.roundOver.nextPlayer, 1, 'あおに交代');
  assert.strictEqual(state.currentPlayer, 1);
  assert.strictEqual(state.level, state.startN, 'あおは最初のレベルから');
  assert.strictEqual(state.retryUsed, false, '再挑戦権もリセット');
  assert.strictEqual(state.finished, false);

  // あお: 1レベルもクリアできず終了 → あか3こ vs あお0こ であかの勝ち
  dealLevel(state);
  tapNumber(state, 9);
  dealLevel(state);
  const end = tapNumber(state, 9);
  assert.strictEqual(end.roundOver.finished, true);
  assert.strictEqual(end.roundOver.winner, 0, 'あかの勝ち');
  assert.deepStrictEqual(state.results, [3, 0]);
}

// ---------- こうたい対戦: ひきわけ ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'two' });
  // あか: 3こクリア後に2ミス
  dealLevel(state);
  clearLevel(state);
  dealLevel(state);
  tapNumber(state, 9);
  dealLevel(state);
  tapNumber(state, 9);
  // あお: 同じく3こクリア後に2ミス
  dealLevel(state);
  clearLevel(state);
  dealLevel(state);
  tapNumber(state, 9);
  dealLevel(state);
  const end = tapNumber(state, 9);
  assert.strictEqual(end.roundOver.winner, null, 'おなじ到達数はひきわけ');
}

console.log('flash.test.js: すべてのテストに合格');
