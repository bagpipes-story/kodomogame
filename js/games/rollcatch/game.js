// game.js — ころころキャッチの純ロジック（DOM・物理非依存）
// v0.10.1で駄菓子屋の「シーソーゲーム」型に作り直し:
// 盤ぜんたいを左右に傾けて、互い違いの段（坂・波波）をジグザグに転がし下ろす。
// 段の形で難易度を出し、スコアはゴールまでのタイム（失敗なし）。

// 段の数・波の大きさ・切れ目の広さ・傾けられる角度で難易度を表現。
// 波の坂の最大角度(wave*2π/波長70px)が最大チルトを超えると、
// 傾けるだけでは越えられず「揺らして勢いをつける」技が必要になる（むずかしい）
export const DIFFICULTY = {
  easy: { shelfCount: 4, wave: 0, gapRatio: 0.26, maxTiltDeg: 14 },
  normal: { shelfCount: 5, wave: 2.5, gapRatio: 0.22, maxTiltDeg: 16 },
  hard: { shelfCount: 6, wave: 4, gapRatio: 0.18, maxTiltDeg: 16 },
};

export const WAVE_LENGTH = 70; // 波波の波長(px)
export const SHELF_TOP = 92;   // いちばん上の段のy
export const SHELF_BOTTOM = 332;

// 段の形を作る: 偶数段は右に切れ目（左から右へ転がす）、奇数段は左に切れ目。
// 波波はsinカーブ。点列はui.jsがそのまま物理セグメントと描画に使う
export function buildShelves(settings, width) {
  const shelves = [];
  const step = 24;
  const spacing = (SHELF_BOTTOM - SHELF_TOP) / (settings.shelfCount - 1);
  for (let i = 0; i < settings.shelfCount; i++) {
    const baseY = SHELF_TOP + spacing * i;
    const gapSide = i % 2 === 0 ? 'right' : 'left';
    const startX = gapSide === 'right' ? 4 : width * settings.gapRatio;
    const endX = gapSide === 'right' ? width * (1 - settings.gapRatio) : width - 4;
    const points = [];
    for (let x = startX; x < endX + step; x += step) {
      const px = Math.min(x, endX);
      points.push({
        x: px,
        y: baseY + settings.wave * Math.sin((px / WAVE_LENGTH) * Math.PI * 2),
      });
      if (px >= endX) break;
    }
    shelves.push({ points, gapSide, baseY });
  }
  return shelves;
}

export function createGame({ difficulty = 'easy', mode = 'solo' } = {}) {
  return {
    mode,
    settings: DIFFICULTY[difficulty],
    running: false,
    startedAt: null,
    elapsedMs: null,     // 今のラウンドの結果（ゴール時に確定）
    currentPlayer: 0,
    results: [null, null], // こうたい対戦の各プレイヤーのタイム(ms)
    finished: false,
  };
}

// ボールが出た（タイム計測開始）。nowは注入できる（テスト用）
export function startRun(state, now) {
  if (state.finished || state.running) return false;
  state.running = true;
  state.startedAt = now;
  state.elapsedMs = null;
  return true;
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
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    return { elapsedMs: state.elapsedMs, nextPlayer: 1 };
  }
  state.finished = true;
  let winner = null;
  if (state.mode === 'two') {
    const [a, b] = state.results;
    winner = a === b ? null : a < b ? 0 : 1; // タイムが短いほうの勝ち
  }
  return { elapsedMs: state.elapsedMs, finished: true, winner };
}
