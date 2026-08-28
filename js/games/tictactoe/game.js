// game.js — ◯×ゲーム（三目並べ）の純ロジック（DOM非依存・Nodeテスト可能）
// プレイヤーは0/1で扱い、◯×の見た目はui.jsが割り当てる。

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // よこ
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // たて
  [0, 4, 8], [2, 4, 6],            // ななめ
];

// 先手は交代制のため引数で受け取る（仕様§4.6: 2回戦目以降は先手交代）
export function createGame({ firstPlayer = 0 } = {}) {
  return {
    board: new Array(9).fill(null), // null | 0 | 1
    current: firstPlayer,
    finished: false,
    winner: null,
    winLine: null,
  };
}

export function place(state, index) {
  if (state.finished || state.board[index] !== null) return { ok: false };
  state.board[index] = state.current;
  const line = LINES.find((l) => l.every((i) => state.board[i] === state.current));
  if (line) {
    state.finished = true;
    state.winner = state.current;
    state.winLine = line;
    return { ok: true, type: 'win', line };
  }
  if (state.board.every((cell) => cell !== null)) {
    state.finished = true;
    return { ok: true, type: 'draw' };
  }
  state.current = 1 - state.current;
  return { ok: true, type: 'placed' };
}

// playerが「あとひとつ」で勝てる空きマス一覧（リーチ表示とCPUで共用）
export function getReachCells(state, player) {
  const cells = new Set();
  for (const line of LINES) {
    const marks = line.map((i) => state.board[i]);
    if (marks.filter((m) => m === player).length === 2 && marks.includes(null)) {
      cells.add(line[marks.indexOf(null)]);
    }
  }
  return [...cells];
}

export function getEmptyCells(state) {
  const cells = [];
  state.board.forEach((mark, i) => {
    if (mark === null) cells.push(i);
  });
  return cells;
}
