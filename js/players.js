// players.js — こどもの名前スロット（v0.16）
// 保護者画面で最大5人の名前を登録し、あそびかた設定で「プレイヤー1／2」に割り当てる。
// ゲーム側は getNames(mode, fallbacks) で表示名を受け取るだけ（登録の有無を知らなくてよい）。
// 保存は settings.players（storage.js経由）。名前が未設定のときは従来の「あなた／あか／あお」等を使う。

import { loadSettings, saveSettings } from './storage.js';
import { text } from './i18n.js';

export const SLOT_COUNT = 5;
export const NAME_MAX_LENGTH = 8;

function normalize(players) {
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => String(players?.slots?.[i] ?? '').slice(0, NAME_MAX_LENGTH));
  const pick = (v) => (Number.isInteger(v) && v >= 0 && v < SLOT_COUNT && slots[v] ? v : -1);
  return { slots, p1: pick(players?.p1), p2: pick(players?.p2) };
}

export function getPlayers() {
  return normalize(loadSettings().players);
}

// 登録済み（空でない）スロットの一覧 [{ index, name }]
export function registeredNames() {
  const { slots } = getPlayers();
  return slots.map((name, index) => ({ index, name })).filter((s) => s.name);
}

export function saveSlots(slots) {
  const settings = loadSettings();
  settings.players = normalize({ ...settings.players, slots });
  saveSettings(settings); // 書き込みは保存ボタンのタップ時のみ
  return settings.players;
}

// which: 0=プレイヤー1, 1=プレイヤー2。slotIndex: -1で「なし」
export function assignPlayer(which, slotIndex) {
  const settings = loadSettings();
  const players = normalize(settings.players);
  if (which === 0) players.p1 = slotIndex;
  else players.p2 = slotIndex;
  // 同じ子を両方に入れない（相手側を外す）
  if (players.p1 >= 0 && players.p1 === players.p2) {
    if (which === 0) players.p2 = -1;
    else players.p1 = -1;
  }
  settings.players = players;
  saveSettings(settings);
  return players;
}

// プレイヤー1／2の登録名（未設定はnull）
export function assignedName(which) {
  const { slots, p1, p2 } = getPlayers();
  const index = which === 0 ? p1 : p2;
  return index >= 0 ? slots[index] : null;
}

// ゲームで使う表示名。mode: 'solo' | 'cpu' | 'two'
// fallbacks: 名前が無いときの既定名 [プレイヤー1, プレイヤー2]（ふたりモードの「あか／あお」「くろ／しろ」など）
// cpuモードのプレイヤー2は常にロボット名（fallbacks[1]）
export function getNames(mode, fallbacks = [text.you, text.cpuName]) {
  const first = assignedName(0) ?? (mode === 'cpu' ? text.you : fallbacks[0]);
  if (mode === 'cpu') return [first, fallbacks[1] ?? text.cpuName];
  return [first, assignedName(1) ?? fallbacks[1]];
}

export function turnOf(name) {
  return name + text.turnSuffix;
}

export function winOf(name) {
  return name + text.winSuffix;
}
