// game.js — すうじフラッシュの純ロジック（DOM非依存。別冊03§5）
// チンパンジーテスト式: 数字がパッと出て隠れる→1から順にタップ。
// クリアごとに数字が1個増える（上限9）。ミスは1ラウンドに1回だけ再挑戦できる。

export const MAX_N = 9;
// カード配置グリッド: 縦持ち画面に合わせて4列×6行=24セル（別冊03§5の6×4を縦向きに読み替え）
export const GRID_COLS = 4;
export const GRID_ROWS = 6;
export const CELL_COUNT = GRID_COLS * GRID_ROWS;

// 開始枚数と「おぼえる時間」で難易度を表現（別冊03§5）
export const DIFFICULTY = {
  easy: { startN: 3, showMs: 3500 },
  normal: { startN: 4, showMs: 2500 },
  hard: { startN: 5, showMs: 1500 },
};

export function createGame({ difficulty = 'easy', mode = 'solo', rng = Math.random } = {}) {
  const settings = DIFFICULTY[difficulty];
  return {
    mode,
    rng,
    showMs: settings.showMs,
    startN: settings.startN,
    level: settings.startN,   // いま挑戦している枚数N
    nextExpected: 1,          // 次にタップすべき数字
    retryUsed: false,         // このラウンドで再挑戦を使ったか
    missedInRound: false,     // perfect_first_try（ひとめでおぼえた）判定用
    clearedAfterMiss: false,  // comeback（ミス後の再挑戦成功）判定用
    reached: 0,               // クリアできた最大N（スコア）
    cards: [],                // [{num, cell}]
    currentPlayer: 0,         // こうたい対戦: 0=あか, 1=あお
    results: [null, null],    // こうたい対戦の各プレイヤーの到達N
    finished: false,
  };
}

// レベルのカードを配る: 24セルからN個を重複なく抽選し、数字1..Nを割り当てる。
// グリッドセル単位なので重なり・最小間隔は自動的に保証される。
export function dealLevel(state) {
  const cells = [];
  for (let i = 0; i < CELL_COUNT; i++) cells.push(i);
  // Fisher-Yatesの先頭N個だけを確定させる（全体シャッフルは不要）
  for (let i = 0; i < state.level; i++) {
    const j = i + Math.floor(state.rng() * (CELL_COUNT - i));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  state.cards = [];
  for (let n = 1; n <= state.level; n++) {
    state.cards.push({ num: n, cell: cells[n - 1] });
  }
  state.nextExpected = 1;
  return state.cards;
}

// ラウンド終了（2回目のミス or 9こクリア）。こうたい対戦なら次のプレイヤーへ交代する
function endRound(state) {
  state.results[state.currentPlayer] = state.reached;
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    state.level = state.startN;
    state.reached = 0;
    state.retryUsed = false;
    state.missedInRound = false;
    state.nextExpected = 1;
    return { reached: state.results[0], nextPlayer: 1 };
  }
  state.finished = true;
  let winner = null;
  if (state.mode === 'two') {
    const [a, b] = state.results;
    winner = a === b ? null : a > b ? 0 : 1;
  }
  return { reached: state.results[state.currentPlayer], finished: true, winner };
}

// 数字をタップ。戻り値:
//   correct=true  levelCleared=false … 正解（続き）
//   correct=true  levelCleared=true  … レベルクリア（roundOver=9こ到達時のみ終了情報）
//   correct=false retry=true         … ミス1回目（正解を見せて同レベル再挑戦）
//   correct=false retry=false        … ミス2回目（roundOverに終了情報）
export function tapNumber(state, num) {
  if (state.finished) return { ok: false };
  if (num === state.nextExpected) {
    state.nextExpected++;
    if (state.nextExpected > state.level) {
      state.reached = state.level;
      if (state.retryUsed) state.clearedAfterMiss = true;
      if (state.level >= MAX_N) {
        return { ok: true, correct: true, levelCleared: true, roundOver: endRound(state) };
      }
      state.level++;
      return { ok: true, correct: true, levelCleared: true, roundOver: null };
    }
    return { ok: true, correct: true, levelCleared: false };
  }
  state.missedInRound = true;
  if (state.retryUsed) {
    return { ok: true, correct: false, retry: false, roundOver: endRound(state) };
  }
  state.retryUsed = true;
  return { ok: true, correct: false, retry: true };
}
