// players.test.js — 名前スロット（players.js）・スタンプ記録（praise.js）・リセットのNodeテスト
// 実行方法: node tests/players.test.js

import assert from 'node:assert';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}
globalThis.localStorage = createMockStorage();

const { loadSettings, loadStats, resetStats } = await import('../js/storage.js');
const { SLOT_COUNT, getPlayers, registeredNames, saveSlots, assignPlayer, assignedName, getNames, turnOf, winOf } =
  await import('../js/players.js');
const { recordPlay } = await import('../js/praise.js');
const { isMilestone } = await import('../js/stamps.js');
const { text } = await import('../js/i18n.js');

// ---------- 初期状態: 名前なし → 既定名 ----------
{
  assert.strictEqual(SLOT_COUNT, 5);
  assert.deepStrictEqual(getPlayers(), { slots: ['', '', '', '', ''], p1: -1, p2: -1 });
  assert.deepStrictEqual(registeredNames(), []);
  assert.deepStrictEqual(getNames('cpu'), [text.you, text.cpuName]);
  assert.deepStrictEqual(getNames('two', [text.redName, text.blueName]), [text.redName, text.blueName]);
  assert.deepStrictEqual(getNames('two', [text.blackName, text.whiteName]), ['くろ', 'しろ'], 'オセロの既定名');
  assert.strictEqual(turnOf('あか'), 'あかの ばん');
  assert.strictEqual(winOf('あなた'), 'あなたの かち！');
}

// ---------- 登録・割り当て ----------
{
  saveSlots(['たろうくん', '', 'はなちゃん', '', '']);
  assert.deepStrictEqual(registeredNames(), [{ index: 0, name: 'たろうくん' }, { index: 2, name: 'はなちゃん' }]);
  assert.strictEqual(loadSettings().players.slots[0], 'たろうくん', 'settingsに保存される');

  assignPlayer(0, 0);
  assert.strictEqual(assignedName(0), 'たろうくん');
  assert.deepStrictEqual(getNames('cpu'), ['たろうくん', text.cpuName], 'ロボット戦は1人目だけ名前');
  assert.deepStrictEqual(getNames('two', [text.redName, text.blueName]), ['たろうくん', text.blueName]);

  assignPlayer(1, 2);
  assert.deepStrictEqual(getNames('two', [text.redName, text.blueName]), ['たろうくん', 'はなちゃん']);

  // 同じ子を両方に入れたら相手側が外れる
  assignPlayer(1, 0);
  assert.deepStrictEqual([assignedName(0), assignedName(1)], [null, 'たろうくん']);

  // 「なし」に戻す
  assignPlayer(1, -1);
  assert.strictEqual(assignedName(1), null);

  // 空スロットを指しても名前なし扱い。8文字に切り詰める
  assignPlayer(0, 1);
  assert.strictEqual(assignedName(0), null);
  saveSlots(['あいうえおかきくけこ', '', '', '', '']);
  assert.strictEqual(getPlayers().slots[0], 'あいうえおかきく', '8文字に切り詰め');
  // 名前を消したら割り当ても外れる
  saveSlots(['', '', '', '', '']);
  assert.strictEqual(assignedName(0), null);
}

// ---------- スタンプ: 押した順のゲームid・10個ごとの節目・リセット ----------
{
  for (let i = 0; i < 12; i++) recordPlay(i % 2 ? 'memory' : 'othello', { won: i === 0 });
  const stats = loadStats();
  assert.strictEqual(stats.stamps, 12);
  assert.strictEqual(stats.stampList.length, 12);
  assert.strictEqual(stats.stampList[0], 'othello');
  assert.strictEqual(stats.stampList[1], 'memory');
  assert.strictEqual(stats.othello.wins, 1);
  assert.strictEqual(stats.skills.heartPower, 12);
  assert.strictEqual(isMilestone(10), true);
  assert.strictEqual(isMilestone(12), false);
  assert.strictEqual(isMilestone(0), false);

  resetStats();
  const fresh = loadStats();
  assert.strictEqual(fresh.stamps, 0);
  assert.deepStrictEqual(fresh.stampList, []);
  assert.strictEqual(fresh.othello.wins, 0);
  assert.strictEqual(loadSettings().muted, false, '設定は消えない');
}

console.log('players.test.js: all passed');
