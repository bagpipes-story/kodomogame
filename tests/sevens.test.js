// sevens.test.js — 7ならべの純ロジック（game.js / cpu.js）のNodeテスト
// 実行方法: node tests/sevens.test.js

import assert from 'node:assert';
import {
  SUITS,
  RANKS,
  MAX_PASSES,
  suitOf,
  rankOf,
  cardId,
  createGame,
  getNeeds,
  isPlayable,
  getPlayableIds,
  playCard,
  passTurn,
} from '../js/games/sevens/game.js';
import { chooseAction } from '../js/games/sevens/cpu.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ---------- 配札 ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  assert.strictEqual(state.hands[0].length, 24, '手札は24枚ずつ');
  assert.strictEqual(state.hands[1].length, 24);
  const all = [...state.hands[0], ...state.hands[1]];
  assert.strictEqual(new Set(all).size, 48, '48枚が重複なく配られる');
  assert.ok(all.every((id) => rankOf(id) !== 7), '7は手札に入らない');
  for (let suit = 0; suit < SUITS; suit++) {
    assert.strictEqual(state.board[suit][6], true, `スート${suit}の7が場に出ている`);
  }
  assert.deepStrictEqual(state.passesLeft, [3, 3]);
  assert.strictEqual(MAX_PASSES, 3);
}

// ---------- 出せる判定（needs） ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  const needs = getNeeds(state);
  for (let suit = 0; suit < SUITS; suit++) {
    assert.deepStrictEqual(needs[suit], { low: 6, high: 8 }, '最初は6と8だけ出せる');
  }
  assert.strictEqual(isPlayable(state, cardId(0, 6)), true, 'スペードの6は出せる');
  assert.strictEqual(isPlayable(state, cardId(0, 5)), false, '5はまだ出せない');
  assert.strictEqual(isPlayable(state, cardId(0, 8)), true, '8は出せる');
}

// ---------- playCard: 着手と連鎖 ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  // テストしやすいように手札を固定する
  state.hands[0] = [cardId(0, 6), cardId(0, 5), cardId(1, 8)];
  state.hands[1] = [cardId(2, 8), cardId(3, 6)];

  assert.strictEqual(playCard(state, cardId(0, 5)).ok, false, '6より先に5は出せない');
  const r1 = playCard(state, cardId(0, 6));
  assert.strictEqual(r1.type, 'played');
  assert.strictEqual(state.board[0][5], true, '6が場に置かれた');
  assert.strictEqual(state.current, 1, '手番交代');
  assert.deepStrictEqual(getNeeds(state)[0], { low: 5, high: 8 }, '次は5が出せるようになる');

  assert.strictEqual(playCard(state, cardId(0, 5)).ok, false, '相手の手札にないカードは出せない');
  playCard(state, cardId(2, 8));
  assert.strictEqual(state.current, 0);
}

// ---------- 端(1/13)に到達するとその先はnull ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  // スペードを8〜13まで埋める
  for (let rank = 8; rank <= 13; rank++) state.board[0][rank - 1] = true;
  assert.deepStrictEqual(getNeeds(state)[0], { low: 6, high: null }, '13まで出たら上側はもう無い');
}

// ---------- 勝ち: 手札を出し切る ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  state.hands[0] = [cardId(0, 6)];
  state.hands[1] = [cardId(1, 6), cardId(1, 5)];
  const result = playCard(state, cardId(0, 6));
  assert.strictEqual(result.type, 'win');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(state.winner, 0);
  assert.strictEqual(state.endReason, 'empty');
  assert.strictEqual(playCard(state, cardId(1, 6)).ok, false, '終了後は出せない');
}

// ---------- パス: 3回まで。4回目で敗北し手札が場に開く ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  state.hands[0] = [cardId(0, 2), cardId(1, 2)]; // 出せないカードだけ
  state.hands[1] = [cardId(0, 6)];

  for (let i = 0; i < 3; i++) {
    const r = passTurn(state);
    assert.strictEqual(r.type, 'passed', `${i + 1}回目のパスはセーフ`);
    assert.strictEqual(state.passesLeft[0], 2 - i);
    // 相手は出さずにパスさせて手番を戻す（相手のパスも消費される）
    passTurn(state);
  }
  assert.strictEqual(state.passesLeft[0], 0);
  const r = passTurn(state);
  assert.strictEqual(r.type, 'lose', '4回目のパスで敗北');
  assert.deepStrictEqual(r.placedCards, [cardId(0, 2), cardId(1, 2)], '残り手札が場に開く');
  assert.strictEqual(state.board[0][1], true, '開いたカードが場に置かれる');
  assert.strictEqual(state.winner, 1);
  assert.strictEqual(state.loser, 0);
  assert.strictEqual(state.endReason, 'passOver');
  assert.strictEqual(state.hands[0].length, 0);
}

// ---------- CPU: よわい（出せるなら必ず出す・出せなければパス） ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  state.hands[0] = [cardId(0, 6), cardId(0, 2)];
  state.current = 0;
  const action = chooseAction(state, 'weak', makeRng([0.0]));
  assert.deepStrictEqual(action, { type: 'play', cardId: cardId(0, 6) }, '出せるカードを出す');

  state.hands[0] = [cardId(0, 2)]; // 出せない
  assert.deepStrictEqual(chooseAction(state, 'weak', makeRng([0.0])), { type: 'pass' }, '出せなければパス');
}

// ---------- CPU: ふつう（端に近いカードを優先） ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  // スペードは6まで出ている → 5が出せる（端まで4）。ハートは8が出せる（端まで5）
  state.board[0][5] = true;
  state.hands[0] = [cardId(0, 5), cardId(1, 8)];
  state.current = 0;
  const action = chooseAction(state, 'normal', makeRng([0.0]));
  assert.deepStrictEqual(action, { type: 'play', cardId: cardId(0, 5) }, '端に近い5を選ぶ');
}

// ---------- CPU: つよい（止め札を温存してパス／続きが多いカードを出す） ----------

{
  const state = createGame({ rng: makeRng([0.5]) });
  // 出せるのはスペードの8だけ。9〜13は全部相手の手札 → 出すと相手を助けるのでパス
  state.hands[0] = [cardId(0, 8), cardId(1, 2), cardId(1, 3)];
  state.current = 0;
  assert.deepStrictEqual(chooseAction(state, 'strong', makeRng([0.0])), { type: 'pass' }, '止め札しか無ければ温存パス');

  // パスが残っていなければ仕方なく出す
  state.passesLeft[0] = 0;
  assert.deepStrictEqual(
    chooseAction(state, 'strong', makeRng([0.0])),
    { type: 'play', cardId: cardId(0, 8) },
    'パスが無ければ出す',
  );

  // 8の先(9〜13)を自分がたくさん持っているなら出す
  state.passesLeft[0] = 3;
  state.hands[0] = [cardId(0, 8), cardId(0, 9), cardId(0, 10), cardId(0, 11), cardId(0, 12)];
  const action = chooseAction(state, 'strong', makeRng([0.0]));
  assert.deepStrictEqual(action, { type: 'play', cardId: cardId(0, 8) }, '自分の続きが多ければ出す');
}

// ---------- 通しプレイ: つよいvsふつうで終局まで壊れないこと ----------

{
  const rng = makeRng([0.31, 0.72, 0.15, 0.94, 0.48, 0.66]);
  const state = createGame({ rng });
  let guard = 0;
  while (!state.finished && guard < 300) {
    guard++;
    const level = state.current === 0 ? 'strong' : 'normal';
    const action = chooseAction(state, level, rng);
    const result = action.type === 'play' ? playCard(state, action.cardId) : passTurn(state);
    assert.strictEqual(result.ok, true, 'CPUの行動は常に正しい');
  }
  assert.ok(state.finished, '終局に到達する');
  assert.ok(state.winner === 0 || state.winner === 1, '勝者が決まる');
}

console.log('sevens.test.js: すべてのテストに合格');
