// game.js — ころころキャッチの純ロジック（DOM・物理非依存）
// v0.10.1で駄菓子屋の「シーソーゲーム」型に。v0.17.4で操作と難易度を作り直し:
//   操作: 画面の左右にある縦スライダーを両手の親指で上下して盤を傾ける（実物のシーソー盤を両手で持つ感覚）
//   難易度: ふつう・むずかしいは左右の壁が無く、傾けすぎると盤の横からボールが落ちる（落ちたら上からやり直し）。
//          むずかしいは段のまんなかに「あな」もある。スコアはゴールまでのタイム（落ちた回数も記録）

export const DIFFICULTY = {
  // walls: 左右の壁 / wave: 波の振幅(px) / gapRatio: 切れ目の広さ / maxTiltDeg: 最大の傾き / pits: 段のまんなかの穴
  // stopper: 壁がないときの段の外側の端の小さな返し(px)。ゆっくりなら止まるが、勢いがつくと乗り越えて落ちる
  easy: { shelfCount: 4, wave: 0, gapRatio: 0.26, maxTiltDeg: 20, walls: true, pits: false, stopper: 0 },
  normal: { shelfCount: 5, wave: 1.5, gapRatio: 0.22, maxTiltDeg: 24, walls: false, pits: false, stopper: 10 },
  hard: { shelfCount: 6, wave: 2.5, gapRatio: 0.2, maxTiltDeg: 26, walls: false, pits: true, stopper: 7 },
};

export const WAVE_LENGTH = 70; // 波波の波長(px)
export const SHELF_TOP = 80;   // いちばん上の段のy（盤座標）
export const SHELF_BOTTOM = 330;
export const PIT_WIDTH = 44;   // 穴の幅(px)。ボール(直径24)が落ちる広さ

// 段の形を作る: 偶数段は右に切れ目（左から右へ転がす）、奇数段は左に切れ目。
// 波波はsinカーブ。点列はui.jsがそのまま物理セグメントと描画に使う。
// pits=true の段（2段目以降の偶数番目）はまんなかに穴（点列を2本に分ける）
export function buildShelves(settings, width) {
  const shelves = [];
  const step = 12; // 細かく区切るほど板のつなぎ目の段差が小さくなり、ボールが引っかからない
  const spacing = (SHELF_BOTTOM - SHELF_TOP) / (settings.shelfCount - 1);
  for (let i = 0; i < settings.shelfCount; i++) {
    const baseY = SHELF_TOP + spacing * i;
    const gapSide = i % 2 === 0 ? 'right' : 'left';
    const startX = gapSide === 'right' ? 4 : width * settings.gapRatio;
    const endX = gapSide === 'right' ? width * (1 - settings.gapRatio) : width - 4;
    const hasPit = settings.pits && i >= 1 && i < settings.shelfCount - 1 && i % 2 === 0;
    const pitX = (startX + endX) / 2;
    const yAt = (px) => baseY + settings.wave * Math.sin((px / WAVE_LENGTH) * Math.PI * 2);
    const segments = [];
    let points = [];
    for (let x = startX; x < endX + step; x += step) {
      const px = Math.min(x, endX);
      const inPit = hasPit && Math.abs(px - pitX) < PIT_WIDTH / 2;
      if (inPit) {
        if (points.length) {
          points.push({ x: pitX - PIT_WIDTH / 2, y: yAt(pitX - PIT_WIDTH / 2) });
          segments.push(points);
          points = [];
        }
      } else {
        if (!points.length && hasPit && px > pitX) points.push({ x: pitX + PIT_WIDTH / 2, y: yAt(pitX + PIT_WIDTH / 2) });
        points.push({ x: px, y: yAt(px) });
      }
      if (px >= endX) break;
    }
    if (points.length) segments.push(points);
    // 壁がないときは外側の端（切れ目の反対側）に小さな丸い返し（盤の端ぎりぎりで止まれる余地。
    // 角のある板だとボールが引っかかるので丸にする）。ゆっくりなら止まり、勢いがつくと乗り越えて落ちる
    let stopper = null;
    if (settings.stopper > 0 && segments.length) {
      const endPoint = gapSide === 'right' ? segments[0][0] : segments[segments.length - 1].slice(-1)[0];
      stopper = { x: endPoint.x + (gapSide === 'right' ? -2 : 2), y: endPoint.y - settings.stopper + 4, r: settings.stopper };
    }
    shelves.push({ points: segments.flat(), segments, gapSide, baseY, stopper, pit: hasPit ? { x: pitX, y: baseY, width: PIT_WIDTH } : null });
  }
  return shelves;
}

// 左右のスライダー（0=いちばん下, 1=いちばん上）から盤の傾き(rad)を決める。
// 左を上げる→盤は右さがり（正の角度=時計回り）。両方同じ高さなら水平
export function tiltFromSliders(left, right, maxTiltDeg) {
  const diff = Math.max(-1, Math.min(1, left - right));
  return (diff * maxTiltDeg * Math.PI) / 180;
}

export function createGame({ difficulty = 'easy', mode = 'solo' } = {}) {
  return {
    mode,
    settings: DIFFICULTY[difficulty],
    running: false,
    startedAt: null,
    elapsedMs: null,     // 今のラウンドの結果（ゴール時に確定）
    falls: 0,            // 今のラウンドで落ちた回数
    currentPlayer: 0,
    results: [null, null], // こうたい対戦の各プレイヤーのタイム(ms)
    fallsBy: [0, 0],
    finished: false,
  };
}

// ボールが出た（タイム計測開始）。nowは注入できる（テスト用）
export function startRun(state, now) {
  if (state.finished || state.running) return false;
  state.running = true;
  state.startedAt = now;
  state.elapsedMs = null;
  state.falls = 0;
  return true;
}

// 盤から落ちた（タイムは止めず、上からやり直す）
export function recordFall(state) {
  if (!state.running) return 0;
  state.falls += 1;
  return state.falls;
}

export function elapsedOf(state, now) {
  if (!state.running || state.startedAt === null) return 0;
  return now - state.startedAt;
}

// ゴールした。こうたい対戦なら交代、そうでなければ終了
export function finishRun(state, now) {
  if (!state.running) return null;
  state.running = false;
  state.elapsedMs = now - state.startedAt;
  state.results[state.currentPlayer] = state.elapsedMs;
  state.fallsBy[state.currentPlayer] = state.falls;
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    return { elapsedMs: state.elapsedMs, falls: state.falls, nextPlayer: 1 };
  }
  state.finished = true;
  let winner = null;
  if (state.mode === 'two') {
    const [a, b] = state.results;
    winner = a === b ? null : a < b ? 0 : 1; // タイムが短いほうの勝ち
  }
  return { elapsedMs: state.elapsedMs, falls: state.falls, finished: true, winner };
}
