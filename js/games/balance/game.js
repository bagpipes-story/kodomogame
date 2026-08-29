// game.js — バランスゲームの純ロジック（DOM・Matter.js非依存・Nodeテスト可能）
// 物理はui.jsの責務。ここは「次のブロック・スコア・手番・勝敗」の状態だけを持つ。

export const BLOCK_LIMIT = 30; // 性能規定: ブロック上限30（仕様§4.5）

// かたちの定義（w/hは基準サイズ。labelKeyはi18nのかたち名と対応 = 図形語彙の知育）
export const SHAPES = {
  square: { w: 46, h: 46 },
  rect: { w: 72, h: 30 },
  circle: { r: 23 },
  triangle: { size: 54 },
  lshape: { w: 64, h: 64 },
};

// 難易度はかたちセットで表現（かんたん=四角のみ／ふつう=＋丸／むずかしい=＋三角・L字）
export const DIFFICULTY = {
  easy: ['square', 'rect'],
  normal: ['square', 'rect', 'circle'],
  hard: ['square', 'rect', 'circle', 'triangle', 'lshape'],
};

export function createGame({ difficulty = 'easy', mode = 'solo', rng = Math.random } = {}) {
  return {
    mode,
    shapes: DIFFICULTY[difficulty],
    rng,
    placed: 0,          // 積めた個数（=スコア）
    currentPlayer: 0,   // こうたい対戦の手番（あか=0/あお=1）
    lastPlacer: null,   // 最後にブロックを落とした人（崩したら負けの判定用）
    finished: false,
    cleared: false,     // 30こ到達クリア
    loser: null,
  };
}

// 次に降ってくるかたちを決める
export function nextShape(state) {
  return state.shapes[Math.floor(state.rng() * state.shapes.length)];
}

// ブロックを落とし始めた（この時点の手番の人が「崩したら負け」の責任者になる）
export function dropStarted(state) {
  if (state.finished) return false;
  state.lastPlacer = state.currentPlayer;
  return true;
}

// ブロックが静止して「積めた」と確定した
export function confirmPlaced(state) {
  if (state.finished) return { ok: false };
  state.placed++;
  if (state.mode === 'two') state.currentPlayer = 1 - state.currentPlayer;
  if (state.placed >= BLOCK_LIMIT) {
    state.finished = true;
    state.cleared = true;
  }
  return { ok: true, placed: state.placed, cleared: state.cleared };
}

// ブロックが落ちた（崩れた）。こうたい対戦では最後に落とした人の負け
export function collapse(state) {
  if (state.finished) return { ok: false };
  state.finished = true;
  state.loser = state.mode === 'two' ? state.lastPlacer : null;
  return { ok: true, loser: state.loser, placed: state.placed };
}
