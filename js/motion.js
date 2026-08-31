// motion.js — 傾きセンサー管理（別冊03§2。ボールめいろ用・将来再利用可）
// iOS Safariでは DeviceOrientationEvent.requestPermission() を
// ユーザー操作（タップ）起点でのみ呼べる。拒否・非対応なら呼び出し側が
// 「ゆびモード」に切り替える（遊べなくなる状態を作らない）。

const LOWPASS = 0.2;   // ローパスフィルタ係数（手ぶれの平滑化）
const CLAMP_DEG = 20;  // これ以上傾けても効かない（激しく振っても意味がない設計）

let listenerAbort = null;
let filtered = { beta: 0, gamma: 0 };
let zero = { beta: 0, gamma: 0 };
let gotData = false;

// 許可ダイアログを出す（必ずタップ等のユーザー操作から呼ぶこと）
export async function requestMotionPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
  const request = DeviceOrientationEvent.requestPermission;
  if (typeof request === 'function') {
    try {
      const result = await request.call(DeviceOrientationEvent);
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      // ユーザー操作起点でない呼び出し等はNotAllowedErrorになる
      return 'denied';
    }
  }
  // Android等は許可不要でそのまま購読できる
  return 'granted';
}

export function startMotion() {
  stopMotion();
  filtered = { beta: 0, gamma: 0 };
  zero = { beta: 0, gamma: 0 };
  gotData = false;
  listenerAbort = new AbortController();
  window.addEventListener('deviceorientation', (event) => {
    if (event.beta === null || event.gamma === null) return;
    gotData = true;
    // 画面回転に応じて軸を入れ替える（アプリはポートレート想定だが
    // Safariブラウザ遊びでは回転しうる）
    const angle = (globalThis.screen?.orientation?.angle) ?? 0;
    let beta = event.beta;
    let gamma = event.gamma;
    if (angle === 90) {
      [beta, gamma] = [-gamma, beta];
    } else if (angle === 270 || angle === -90) {
      [beta, gamma] = [gamma, -beta];
    } else if (angle === 180) {
      beta = -beta;
      gamma = -gamma;
    }
    filtered.beta += (beta - filtered.beta) * LOWPASS;
    filtered.gamma += (gamma - filtered.gamma) * LOWPASS;
  }, { signal: listenerAbort.signal });
}

// センサーからデータが来ているか（デスクトップ等は購読できても値が来ない）
export function hasMotionData() {
  return gotData;
}

// いまの姿勢をゼロ点にする（ソファで寝転んで遊んでも成立させる。別冊03§2）
export function calibrateMotion() {
  zero = { ...filtered };
}

// ゼロ点からの傾き（度）。x=左右(gamma)、y=前後(beta)。±20°でクランプ
export function readTilt() {
  const clamp = (v) => Math.max(-CLAMP_DEG, Math.min(CLAMP_DEG, v));
  return {
    x: clamp(filtered.gamma - zero.gamma),
    y: clamp(filtered.beta - zero.beta),
  };
}

export function stopMotion() {
  if (listenerAbort) {
    listenerAbort.abort();
    listenerAbort = null;
  }
}
