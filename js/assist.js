// assist.js — 難易度アシスト（仕様§3.4-5）
// 「よわい」ロボットと同じゲームで2連敗したら、次のプレイはさらにミスの多い 'assist' レベルで打つ。
// 連敗カウント（stats.lossStreak）は praise.js の recordPlay が更新する（勝てば0に戻る）。
// 特別な演出はしない（ゲーム側は effectiveLevel() の戻り値をCPUに渡すだけ）。

import { loadStats } from './storage.js';

export const ASSIST_AFTER = 2; // この連敗数からアシスト

export function lossStreakOf(gameId) {
  return loadStats().lossStreak?.[gameId] ?? 0;
}

// 'weak' で2連敗中なら 'assist'。それ以外は指定レベルのまま
export function effectiveLevel(gameId, level) {
  return level === 'weak' && lossStreakOf(gameId) >= ASSIST_AFTER ? 'assist' : level;
}
