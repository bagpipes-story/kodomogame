// game.js — バランスゲームの純ロジック（DOM・Matter.js非依存・Nodeテスト可能）
// 物理はui.jsの責務。ここは「次のブロック・スコア・手番・勝敗」の状態だけを持つ。

export const BLOCK_LIMIT = 30; // 30こでクリア（仕様§4.5）。そのあとは「つづけて つむ」で きろく ちょうせん
export const BLOCK_MAX = 99;   // きろく ちょうせん の終わり（表示2けた・ボディが増えすぎない保険）
// 性能規定: 動くブロックは30こまで。それより古くて止まっている（スリープ中の）ブロックは
// ui.js が固定（static）にして、物理計算の数を増やさない
export const ACTIVE_LIMIT = 30;

// かたちの定義（w/hは基準サイズ。labelKeyはi18nのかたち名と対応 = 図形語彙の知育）
export const SHAPES = {
  square: { w: 46, h: 46 },
  rect: { w: 72, h: 30 },
  circle: { r: 23 },
  triangle: { size: 54 },
  lshape: { w: 64, h: 64 },
  // おとな用（v0.17.10）。ほしはへこんだ形なので、ui.jsでは凸のパーツ6つ（まんなかの五角形＋とがり5つ）を合体させて作る
  star: { outer: 31, inner: 14 },
  diamond: { halfW: 26, halfH: 33 },
  hexagon: { r: 28 },
  trapezoid: { bottom: 78, top: 40, h: 30 },
  semicircle: { r: 32 },
};

// 難易度はかたちセットで表現（かんたん=四角のみ／ふつう=＋丸／むずかしい=＋三角・L字）
export const DIFFICULTY = {
  easy: ['square', 'rect'],
  normal: ['square', 'rect', 'circle'],
  hard: ['square', 'rect', 'circle', 'triangle', 'lshape'],
  adult: ['square', 'rect', 'circle', 'triangle', 'lshape', 'star', 'diamond', 'hexagon', 'trapezoid', 'semicircle'],
};

// つみきの しゅるい（v0.17.12）。メニューの「つみき」で選ぶ。
// うみの いきものも難易度で出る顔ぶれを変える（かんたん=平らで積みやすい子だけ → むずかしいほど まるい・とがった子が増える）。
// 顔ぶれは「まんなかに落とし続けて何こ積めるか」のシミュレーションで、かたちの同じ難易度と近くなるように決めた
// 形と絵は sea.js（うみ）にある
export const BLOCK_SETS = {
  shape: DIFFICULTY,
  sea: {
    easy: ['whale', 'turtle', 'crab', 'seal'],
    normal: ['whale', 'turtle', 'crab', 'seal', 'puffer', 'fish', 'dolphin', 'penguin'],
    hard: ['whale', 'turtle', 'crab', 'seal', 'puffer', 'fish', 'dolphin', 'penguin', 'octopus', 'jellyfish', 'starfish', 'squid'],
    adult: ['whale', 'turtle', 'crab', 'seal', 'puffer', 'fish', 'dolphin', 'penguin', 'octopus', 'jellyfish', 'starfish', 'squid', 'shell', 'sunfish'],
  },
};

export function shapesFor(blocks, difficulty) {
  const set = BLOCK_SETS[blocks] ?? BLOCK_SETS.shape;
  return set[difficulty] ?? set.easy;
}

// 床（土台）の広さと画面の縮尺。おとなは床の幅を2倍にし、
// 盤ごと0.7倍に縮めて画面に収める（ブロックの大きさは他の難易度と同じ。広い床にたくさん並べられる）
export const FIELD = {
  easy: { platformRatio: 1, viewScale: 1 },
  normal: { platformRatio: 1, viewScale: 1 },
  hard: { platformRatio: 1, viewScale: 1 },
  adult: { platformRatio: 2, viewScale: 0.7 },
};

export function fieldOf(difficulty) {
  return FIELD[difficulty] ?? FIELD.easy;
}

export function createGame({ difficulty = 'easy', mode = 'solo', blocks = 'shape', rng = Math.random } = {}) {
  return {
    mode,
    shapes: shapesFor(blocks, difficulty),
    rng,
    placed: 0,          // 積めた個数（=スコア）
    currentPlayer: 0,   // こうたい対戦の手番（あか=0/あお=1）
    lastPlacer: null,   // 最後にブロックを落とした人（崩したら負けの判定用）
    finished: false,
    cleared: false,     // 30こ到達クリア
    endless: false,     // クリア後に「つづけて つむ」を選んだ（きろく ちょうせん中）
    maxed: false,       // BLOCK_MAX まで積みきった
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
  if (!state.endless && state.placed >= BLOCK_LIMIT) {
    state.finished = true;
    state.cleared = true;
  } else if (state.endless && state.placed >= BLOCK_MAX) {
    state.finished = true;
    state.maxed = true;
  }
  return { ok: true, placed: state.placed, cleared: state.cleared, maxed: state.maxed };
}

// 30こクリアのあと「つづけて つむ」。同じ塔のまま再開する（手番もそのまま続く）
export function continueRun(state) {
  if (!state.finished || !state.cleared || state.endless) return false;
  state.finished = false;
  state.endless = true;
  return true;
}

// ブロックが落ちた（崩れた）。こうたい対戦では最後に落とした人の負け
export function collapse(state) {
  if (state.finished) return { ok: false };
  state.finished = true;
  state.loser = state.mode === 'two' ? state.lastPlacer : null;
  return { ok: true, loser: state.loser, placed: state.placed };
}
