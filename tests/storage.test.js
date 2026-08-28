// storage.test.js — storage.jsのNodeテスト
// 実行方法: node tests/storage.test.js
// ブラウザなしで動かすため、localStorageの簡易モックをglobalThisに差し込む。

import assert from 'node:assert';

// ---- localStorageモック ----
function createMockStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

globalThis.localStorage = createMockStorage();

const { loadSettings, saveSettings, loadStats, saveStats } = await import('../js/storage.js');

// 1. 未保存時は初期値が返る
let settings = loadSettings();
assert.strictEqual(settings.muted, false, '初期設定はミュートオフ');
assert.strictEqual(settings.version, 1, '設定にversionがある');

let stats = loadStats();
assert.strictEqual(stats.othello.wins, 0, '初期戦績は0勝');
assert.strictEqual(stats.balance.best, 0, 'バランスの初期ベストは0');

// 2. 保存→再読込で値が保持される
settings.muted = true;
assert.strictEqual(saveSettings(settings), true, '保存が成功する');
assert.strictEqual(loadSettings().muted, true, '保存したミュート状態が読める');

stats.othello.wins = 3;
saveStats(stats);
assert.strictEqual(loadStats().othello.wins, 3, '保存した勝ち数が読める');

// 3. 壊れたJSONが入っていても初期値で続行する（ゲームを止めない）
globalThis.localStorage.setItem('kgb.settings', '{{{broken json');
assert.strictEqual(loadSettings().muted, false, '壊れたデータは初期値にフォールバック');

// 4. 保存データにキーが欠けていても初期値で補われる
globalThis.localStorage.setItem('kgb.stats', JSON.stringify({ othello: { wins: 5 } }));
stats = loadStats();
assert.strictEqual(stats.othello.wins, 5, '保存済みの値は残る');
assert.strictEqual(stats.balance.best, 0, '欠けたキーは初期値で補完');

// 5. localStorage自体が使えなくても例外を出さない（プライベートブラウズ想定）
globalThis.localStorage = {
  getItem: () => { throw new Error('storage disabled'); },
  setItem: () => { throw new Error('storage disabled'); },
};
assert.strictEqual(loadSettings().muted, false, 'ストレージ不能でも初期値が返る');
assert.strictEqual(saveSettings({ muted: true, version: 1 }), false, '保存失敗はfalseを返すだけで例外にしない');

console.log('storage.test.js: すべてのテストに合格');
