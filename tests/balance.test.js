// balance.test.js — バランスゲームの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/balance.test.js

import assert from 'node:assert';
import {
  BLOCK_LIMIT,
  SHAPES,
  DIFFICULTY,
  createGame,
  nextShape,
  dropStarted,
  confirmPlaced,
  collapse,
  FIELD,
  fieldOf,
} from '../js/games/balance/game.js';
import { text } from '../js/i18n.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ---------- 難易度のかたちセット ----------

{
  assert.deepStrictEqual(DIFFICULTY.easy, ['square', 'rect'], 'かんたんは四角のみ');
  assert.ok(DIFFICULTY.normal.includes('circle'), 'ふつうは丸が入る');
  assert.ok(DIFFICULTY.hard.includes('triangle') && DIFFICULTY.hard.includes('lshape'), 'むずかしいは三角・L字入り');
  for (const keys of Object.values(DIFFICULTY)) {
    for (const key of keys) assert.ok(SHAPES[key], `かたち${key}の定義がある`);
  }
  assert.strictEqual(BLOCK_LIMIT, 30, '上限30個（性能規定）');
}

// ---------- おとな: 床2倍・かたち10しゅ（v0.17.10） ----------

{
  const adult = DIFFICULTY.adult;
  for (const key of DIFFICULTY.hard) assert.ok(adult.includes(key), `おとなは むずかしいの${key}も出る`);
  for (const key of ['star', 'diamond', 'hexagon', 'trapezoid', 'semicircle']) {
    assert.ok(adult.includes(key), `おとなは${key}が出る`);
  }
  assert.strictEqual(new Set(adult).size, adult.length, 'かたちの重複なし');
  assert.strictEqual(fieldOf('adult').platformRatio, 2, 'おとなは床の幅2倍');
  assert.strictEqual(fieldOf('hard').platformRatio, 1, 'むずかしいまでは今までどおり');
  assert.strictEqual(fieldOf('unknown'), FIELD.easy, '知らない難易度はかんたん扱い');
  assert.deepStrictEqual(createGame({ difficulty: 'unknown' }).shapes, DIFFICULTY.easy);
  // 縮めて描いたとき、床が画面のはば（盤の54%×倍率×縮尺）の9割以内に収まる
  for (const [key, field] of Object.entries(FIELD)) {
    const onScreen = 0.54 * field.platformRatio * field.viewScale;
    assert.ok(onScreen <= 0.9, `${key}: 床が画面に収まる (${onScreen.toFixed(2)})`);
  }
  // かたちの名前は全部 i18n にあり、ひらがな・カタカナだけ
  for (const key of Object.keys(SHAPES)) {
    const name = text.shapes[key];
    assert.ok(name && /^[ぁ-んァ-ヶー]+$/.test(name), `${key}の名前「${name}」はかなだけ`);
  }
  const state = createGame({ difficulty: 'adult', rng: makeRng([0.99]) });
  assert.strictEqual(nextShape(state), 'semicircle', 'おとなの末尾のかたちも出る');
}

// ---------- 次のかたちはrngで決まる ----------

{
  const state = createGame({ difficulty: 'hard', rng: makeRng([0.0, 0.99, 0.5]) });
  assert.strictEqual(nextShape(state), 'square', 'rng=0で先頭');
  assert.strictEqual(nextShape(state), 'lshape', 'rng=0.99で末尾');
}

// ---------- ひとり: スコアと30こクリア ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'solo' });
  for (let i = 1; i < BLOCK_LIMIT; i++) {
    dropStarted(state);
    const result = confirmPlaced(state);
    assert.strictEqual(result.placed, i);
    assert.strictEqual(result.cleared, false);
  }
  dropStarted(state);
  const last = confirmPlaced(state);
  assert.strictEqual(last.placed, 30);
  assert.strictEqual(last.cleared, true, '30こでクリア');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(confirmPlaced(state).ok, false, '終了後は積めない');
}

// ---------- ひとり: 崩れたら終了（スコアは積めた数のまま） ----------

{
  const state = createGame({ mode: 'solo' });
  dropStarted(state);
  confirmPlaced(state);
  dropStarted(state);
  const result = collapse(state); // 2個目が落ちた
  assert.strictEqual(result.placed, 1, 'スコアは確定済みの1個');
  assert.strictEqual(result.loser, null, 'ひとりプレイに負けはない');
  assert.strictEqual(state.finished, true);
}

// ---------- こうたい: 手番交代と「崩した方が負け」 ----------

{
  const state = createGame({ mode: 'two' });
  assert.strictEqual(state.currentPlayer, 0, 'あかから');
  dropStarted(state);
  confirmPlaced(state);
  assert.strictEqual(state.currentPlayer, 1, '交代してあお');
  dropStarted(state);
  assert.strictEqual(state.lastPlacer, 1, '落とした責任者はあお');
  const result = collapse(state); // あおのブロックで崩れた
  assert.strictEqual(result.loser, 1, '崩したあおの負け');

  // あかが崩すパターン
  const state2 = createGame({ mode: 'two' });
  dropStarted(state2);
  confirmPlaced(state2); // あか→あお
  dropStarted(state2);
  confirmPlaced(state2); // あお→あか
  dropStarted(state2);
  assert.strictEqual(collapse(state2).loser, 0, '崩したあかの負け');
}

console.log('balance.test.js: すべてのテストに合格');
