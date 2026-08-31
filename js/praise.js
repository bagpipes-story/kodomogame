// praise.js — 具体ほめシステム＋プレイ記録（仕様§3.4）
// ゲーム側はイベント発火(emitPraise)と終了時のrecordPlayだけを行い、
// 知育ロジック（ほめ言葉の選定・5つの力カウンタ）はここに集約する。

import { text } from './i18n.js';
import { loadStats, saveStats } from './storage.js';

// ほめの優先順位: 特別な行動 > がんばりの継続 > 完走（完走は必ず入る保険）
const PRAISE_PRIORITY = [
  'perfect_patience',
  'blocked_reach',
  'took_corner',
  'perfect_first_try',
  'comeback',
  'remembered_pair',
  'combo',
  'found_pair',
  'thought_long',
  'new_record',
  'retried',
  'draw_positive',
  'waited_turn',
  'finished_game',
];

// 5つのあそびのちから: ゲームごとの担当（要件定義§4.2の表）。こころ(heartPower)は全ゲーム+1
const SKILL_MAP = {
  memory: ['memoryPower', 'numberLetter'],
  oldmaid: ['memoryPower'],
  othello: ['thinkPower', 'numberLetter', 'shapeBalance'],
  sevens: ['thinkPower', 'numberLetter'],
  tictactoe: ['thinkPower'],
  mole: ['numberLetter', 'shapeBalance'],
  balance: ['shapeBalance'],
  flash: ['memoryPower', 'numberLetter'], // 視空間記憶＋数の順序（別冊03§6）
  rollcatch: ['thinkPower'],              // プランニング・因果関係（別冊03§6）
};

let events = new Set();
let lastPraiseKey = null; // 同じほめ言葉が連続しないよう覚えておく（保存はしない）

export function resetPraise() {
  events = new Set();
}

export function emitPraise(key) {
  events.add(key);
}

// 結果画面に出す「きょうのすごいところ」を1つ選ぶ。勝敗に関係なく必ず1つ返す
export function pickPraise() {
  const candidates = PRAISE_PRIORITY.filter((key) => events.has(key));
  if (!candidates.length) candidates.push('finished_game');
  const chosen = candidates.find((key) => key !== lastPraiseKey) ?? candidates[0];
  lastPraiseKey = chosen;
  return text.praise[chosen] ?? text.praise.finished_game;
}

// 1プレイ終了時の記録: plays・勝ち数・5つの力・スタンプ（保存はこの1回のみ。§9）
export function recordPlay(gameId, { won = false } = {}) {
  const stats = loadStats();
  stats[gameId] ??= {};
  stats[gameId].plays = (stats[gameId].plays ?? 0) + 1;
  if (won) stats[gameId].wins = (stats[gameId].wins ?? 0) + 1;

  stats.skills ??= {};
  for (const skill of SKILL_MAP[gameId] ?? []) {
    stats.skills[skill] = (stats.skills[skill] ?? 0) + 1;
  }
  stats.skills.heartPower = (stats.skills.heartPower ?? 0) + 1;

  stats.stamps = (stats.stamps ?? 0) + 1; // スタンプちょうのUIはv0.9。データだけ先に貯める
  saveStats(stats);
}
