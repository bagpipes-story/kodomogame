// storage.js — localStorageラッパー（v0.1）
// ルール: localStorageの読み書きはこのファイル経由のみ。
// 方針: パース失敗・容量超過でもゲームを止めない（try/catchで初期値にフォールバック）。

const SETTINGS_KEY = 'kgb.settings';
const STATS_KEY = 'kgb.stats';

// 初期値は仕様書§5のデータ構造に合わせる
const DEFAULT_SETTINGS = {
  muted: false,
  breakMinutes: 30, // きゅうけいリマインダー（v0.9でUI実装）
  assist: { othelloCount: true, oldmaidPairHint: true, oldmaidAutoSort: true },
  version: 1,
};

const DEFAULT_STATS = {
  othello: { wins: 0, plays: 0 },
  sevens: { wins: 0, plays: 0 },
  memory: { wins: 0, plays: 0, bestMoves: {} },
  oldmaid: { wins: 0, plays: 0 },
  balance: { best: 0, plays: 0 },
  tictactoe: { wins: 0, plays: 0 },
  mole: { best: 0, bestBy: {}, plays: 0 },
  // 5つのあそびのちからカウンタ（保護者画面の星表示の元データ。仕様§5）
  skills: { memoryPower: 0, thinkPower: 0, numberLetter: 0, shapeBalance: 0, heartPower: 0 },
  stamps: 0,
  lossStreak: {}, // 難易度アシスト用の連敗カウント（ゲームごと）
  version: 1,
};

// globalThis経由にしているのは、Nodeテストでモックを差し込めるようにするため
function getStore() {
  return globalThis.localStorage;
}

function read(key, defaults) {
  try {
    const raw = getStore().getItem(key);
    if (raw === null) return structuredClone(defaults);
    const parsed = JSON.parse(raw);
    // 保存データにキーが欠けていても初期値で補う（将来フィールドを足しても壊れない）
    return { ...structuredClone(defaults), ...parsed };
  } catch {
    return structuredClone(defaults);
  }
}

function write(key, value) {
  try {
    getStore().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // プライベートブラウズや容量超過では保存できないが、ゲームは続行させる
    return false;
  }
}

export function loadSettings() {
  return read(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings) {
  return write(SETTINGS_KEY, settings);
}

export function loadStats() {
  return read(STATS_KEY, DEFAULT_STATS);
}

export function saveStats(stats) {
  return write(STATS_KEY, stats);
}
