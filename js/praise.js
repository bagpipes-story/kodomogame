// praise.js — 具体ほめシステム＋プレイ記録（仕様§3.4）
// ゲーム側はイベント発火(emitPraise)と終了時のrecordPlayだけを行い、
// 知育ロジック（ほめ言葉の選定・5つの力カウンタ）はここに集約する。

import { text } from './i18n.js';
import { loadStats, saveStats } from './storage.js';

// ほめの優先順位: 特別な行動 > がんばりの継続 > 完走（完走は必ず入る保険）
const PRAISE_PRIORITY = [
  'perfect_patience',
  'no_fall_clear',
  'blocked_reach',
  'took_corner',
  'perfect_first_try',
  'exact_hit',
  'aimed_hit',
  'beat_robot',
  'one_listen',
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

// 6つのあそびのちから: ゲームごとの担当（要件定義§4.2の表）。こころ(heartPower)は全ゲーム+1。
// えいご(english)はテーマ・ゲームに応じて呼び出し側がextraSkillsで足す
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
  maze: ['shapeBalance'],                 // 空間認識・ルート探索（別冊03§6）
  korinto: ['numberLetter', 'shapeBalance'], // たしざんの体感・跳ね返りの観察（別冊04§7）
  enword: ['english'],                    // 音と文字と意味を結ぶ（別冊04§3）
  abc: ['numberLetter', 'english'],       // アルファベット順序・頭文字（別冊04§4）
  listen: ['english'],                    // 2語・3語の聞き取り（別冊04§5）
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
export function recordPlay(gameId, { won = false, extraSkills = [] } = {}) {
  const stats = loadStats();
  stats[gameId] ??= {};
  stats[gameId].plays = (stats[gameId].plays ?? 0) + 1;
  if (won) stats[gameId].wins = (stats[gameId].wins ?? 0) + 1;

  stats.skills ??= {};
  for (const skill of [...(SKILL_MAP[gameId] ?? []), ...extraSkills]) {
    stats.skills[skill] = (stats.skills[skill] ?? 0) + 1;
  }
  stats.skills.heartPower = (stats.skills.heartPower ?? 0) + 1;

  stats.stamps = (stats.stamps ?? 0) + 1;
  // スタンプちょうの絵柄用にゲームidを押した順で残す（直近200個。古いものは数だけ残る）
  stats.stampList = [...(stats.stampList ?? []), gameId].slice(-200);
  saveStats(stats);

  // 「1プレイの区切り」をアプリ本体に知らせる（きゅうけいリマインダー・スタンプのお祝い。仕様§3.4）
  globalThis.document?.dispatchEvent(
    new CustomEvent('kgb:playdone', { detail: { gameId, stamps: stats.stamps } }),
  );
}
