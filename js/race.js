// race.js — 早押しCPU「ロボくん」の考え中ゲージ（別冊04§2.3）
// ゲージが満タンになるとロボくんが答える。ゲージが制限時間を兼ねる（数字のカウントダウンは出さない）。
// 判定・時間の計算は純関数（Nodeテスト可能）、タイマー部分だけcreateRaceにまとめる。

export const RACE_LEVELS = {
  weak: { minMs: 6000, maxMs: 8000, accuracy: 0.6 },
  normal: { minMs: 4000, maxMs: 5000, accuracy: 0.85 },
  strong: { minMs: 2500, maxMs: 3500, accuracy: 1.0 },
};

// 難易度アシスト（02_仕様書§3.4）: よわいで2連敗したらゲージ時間を+2秒
export function assistExtraMs(level, lossStreak) {
  return level === 'weak' && lossStreak >= 2 ? 2000 : 0;
}

export function gaugeDuration(level, rng = Math.random, extraMs = 0) {
  const { minMs, maxMs } = RACE_LEVELS[level];
  return minMs + rng() * (maxMs - minMs) + extraMs;
}

// ロボくんの答え: 正解率で当てる。外すときは正解以外の選択肢からえらぶ
export function robotChoice(level, correctIndex, optionCount, rng = Math.random) {
  if (rng() < RACE_LEVELS[level].accuracy) return correctIndex;
  const wrong = [];
  for (let i = 0; i < optionCount; i++) if (i !== correctIndex) wrong.push(i);
  if (!wrong.length) return correctIndex;
  return wrong[Math.floor(rng() * wrong.length)];
}

// ゲージのタイマー。start()で計測開始、満タンでonDone()。stop()で止める（子どもが先に答えたとき）
export function createRace({ level, rng = Math.random, extraMs = 0, onDone }) {
  let timerId = null;
  let startedAt = 0;
  let duration = 0;

  function start() {
    stop();
    duration = gaugeDuration(level, rng, extraMs);
    startedAt = performance.now();
    timerId = setTimeout(() => {
      timerId = null;
      onDone();
    }, duration);
    return duration;
  }

  function stop() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function progress(now = performance.now()) {
    if (!duration) return 0;
    return Math.min((now - startedAt) / duration, 1);
  }

  return { start, stop, progress, isRunning: () => timerId !== null };
}
