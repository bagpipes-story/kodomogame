// app.js — 画面遷移・共通UI制御（v0.2）
// 画面構成: ホーム → あそびかた設定 → ゲーム → (結果はゲーム内オーバーレイ)
// 未実装ゲームはダミー画面へ。ゲーム本体はgames/<id>/ui.jsのmountに任せる。

import { text, games } from './i18n.js';
import { playTap, isMuted, toggleMute } from './sound.js';
import { loadStats, saveStats, loadSettings } from './storage.js';
import { registeredNames, getPlayers, assignPlayer } from './players.js';
import { renderStamps, isMilestone } from './stamps.js';
import { renderGate, renderParent } from './parent.js';
import { mount as mountMemory } from './games/memory/ui.js';
import { mount as mountOthello } from './games/othello/ui.js';
import { mount as mountSevens } from './games/sevens/ui.js';
import { mount as mountTictactoe } from './games/tictactoe/ui.js';
import { mount as mountMole } from './games/mole/ui.js';
import { mount as mountOldmaid } from './games/oldmaid/ui.js';
import { mount as mountBalance } from './games/balance/ui.js';
import { mount as mountFlash } from './games/flash/ui.js';
import { mount as mountRollcatch } from './games/rollcatch/ui.js';
import { mount as mountMaze } from './games/maze/ui.js';
import { mount as mountKorinto } from './games/korinto/ui.js';
import { mount as mountEnword } from './games/enword/ui.js';
import { mount as mountAbc } from './games/abc/ui.js';
import { mount as mountListen } from './games/listen/ui.js';

const APP_VERSION = 'v0.16';

// 実装済みゲームのマウント関数。ここに無いゲームはダミー画面に遷移する
const gameMounters = {
  memory: mountMemory,
  othello: mountOthello,
  sevens: mountSevens,
  tictactoe: mountTictactoe,
  mole: mountMole,
  oldmaid: mountOldmaid,
  balance: mountBalance,
  flash: mountFlash,
  rollcatch: mountRollcatch,
  maze: mountMaze,
  korinto: mountKorinto,
  enword: mountEnword,
  abc: mountAbc,
  listen: mountListen,
};

const screens = {
  home: document.getElementById('screen-home'),
  setup: document.getElementById('screen-setup'),
  play: document.getElementById('screen-play'),
  dummy: document.getElementById('screen-dummy'),
  stamps: document.getElementById('screen-stamps'),
  parent: document.getElementById('screen-parent'),
};

const muteButton = document.getElementById('muteButton');
const quitOverlay = document.getElementById('quitOverlay');

let currentGameId = null;
let currentGame = null; // マウント中のゲーム（{ destroy }を持つ）

// ゲームごとの設定画面の定義。選択状態はセッション中覚えておく
const LEVEL_OPTIONS = [
  ['weak', text.levelWeak],
  ['normal', text.levelNormal],
  ['strong', text.levelStrong],
];

const CATEGORY_OPTIONS = [['all', text.catAll], ['animal', text.catAnimal], ['fruit', text.catFruit], ['color', text.catColor], ['number', text.catNumber], ['shape', text.catShape], ['body', text.catBody]];

const setupConfigs = {
  abc: {
    // じゅんばんABC（タイム）／はじめのもじ（頭文字3択）。ことばは はじめのもじ のときだけ意味がある
    defaults: { game: 'order', mode: 'solo', difficulty: 'easy', category: 'all' },
    groups: [
      { key: 'game', label: text.abcGameLabel, options: [['order', text.abcOrder], ['initial', text.abcInitial]] },
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
      { key: 'category', label: text.ewCategoryLabel, options: CATEGORY_OPTIONS, when: (s) => s.game === 'initial' },
    ],
  },
  listen: {
    // ことば（カテゴリ）は かんたん（単語1語）のときだけ意味がある
    defaults: { mode: 'cpu', difficulty: 'easy', level: 'weak', category: 'all' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
      { key: 'level', label: text.levelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
      { key: 'category', label: text.ewCategoryLabel, options: CATEGORY_OPTIONS, when: (s) => s.difficulty === 'easy' },
    ],
  },
  enword: {
    // ことば（出題カテゴリ）は「ぜんぶ」なら設定のwordCategories（保護者画面で変更予定）に従う
    defaults: { mode: 'cpu', difficulty: 'easy', level: 'weak', category: 'all' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
      { key: 'level', label: text.levelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
      { key: 'category', label: text.ewCategoryLabel, options: CATEGORY_OPTIONS },
    ],
  },
  korinto: {
    defaults: { mode: 'solo', difficulty: 'easy' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard], ['adult', text.sizeAdult]] },
    ],
  },
  maze: {
    // ひとりプレイ専用（別冊03§1）。むずかしさ＋ルートヒントのありなし
    defaults: { difficulty: 'easy', hint: 'on' },
    groups: [
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard], ['adult', text.sizeAdult]] },
      { key: 'hint', label: text.mazeHintLabel, options: [['on', text.hintOn], ['off', text.hintOff]] },
    ],
  },
  rollcatch: {
    defaults: { mode: 'solo', difficulty: 'easy' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
    ],
  },
  flash: {
    defaults: { mode: 'solo', difficulty: 'easy' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
    ],
  },
  balance: {
    defaults: { mode: 'solo', difficulty: 'easy' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
    ],
  },
  oldmaid: {
    defaults: { mode: 'cpu', robots: '2', size: 'easy', level: 'weak' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'robots', label: text.omOppCountLabel, options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], cpuOnly: true },
      { key: 'size', label: text.sizeLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal]] },
      { key: 'level', label: text.omOppLevelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
    ],
  },
  mole: {
    defaults: { mode: 'solo', difficulty: 'easy' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['two', text.modeTwo]] },
      { key: 'difficulty', label: text.difficultyLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard], ['adult', text.sizeAdult]] },
    ],
  },
  tictactoe: {
    defaults: { mode: 'cpu', level: 'weak' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'level', label: text.levelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
    ],
  },
  memory: {
    defaults: { mode: 'cpu', size: 'easy', level: 'weak', theme: 'animal' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'theme', label: text.memoryThemeLabel, options: [['animal', text.themeAnimal], ['fruit', text.themeFruit], ['english', text.themeEnglish], ['abc', text.themeAbc]] },
      { key: 'size', label: text.sizeLabel, options: [['easy', text.sizeEasy], ['normal', text.sizeNormal], ['hard', text.sizeHard]] },
      { key: 'level', label: text.levelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
    ],
  },
  othello: {
    defaults: { mode: 'cpu', level: 'weak' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'level', label: text.levelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
    ],
  },
  sevens: {
    defaults: { mode: 'cpu', robots: '1', level: 'weak' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['cpu', text.modeCpu], ['two', text.modeTwo]] },
      { key: 'robots', label: text.robotsLabel, options: [['1', '1だい'], ['2', '2だい'], ['3', '3だい']], cpuOnly: true },
      { key: 'level', label: text.levelLabel, options: LEVEL_OPTIONS, cpuOnly: true },
    ],
  },
};

const setupSelections = {}; // gameId -> 選択状態

function currentSelection() {
  setupSelections[currentGameId] ??= { ...setupConfigs[currentGameId].defaults };
  return setupSelections[currentGameId];
}

// ---------- 画面遷移（hidden切り替えのみ） ----------

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.hidden = key !== name;
  }
  // ホームに戻るたびに勝ち星を最新にする（がんばりの見える化。仕様§12）
  if (name === 'home') updateHomeStars();
}

function updateHomeStars() {
  const stats = loadStats();
  for (const game of games) {
    const el = document.querySelector(`[data-game-id="${game.id}"] .kgb-game-stars`);
    if (!el) continue;
    const wins = stats[game.id]?.wins ?? 0;
    // 5こまでは★を並べ、それ以上は「★×8」のように数字で見せる（大きい数への興味づけ）
    el.textContent = wins === 0 ? '' : wins <= 5 ? '★'.repeat(wins) : `★×${wins}`;
  }
}

function goHome() {
  // タイマー・リスナーの解除はゲーム側のdestroyに集約している（§9タイマー管理）
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }
  quitOverlay.hidden = true;
  showScreen('home');
}

// ---------- 初期表示 ----------

function applyStaticText() {
  // data-i18n属性の要素にi18n.jsの文言を流し込む（HTMLに日本語を直書きしない）
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = text[el.dataset.i18n] ?? '';
  }
  document.getElementById('versionLabel').textContent = APP_VERSION;
}

function buildGameList() {
  // ボタン5個の一度きりの生成なのでDocumentFragmentでまとめて追加
  const list = document.getElementById('gameList');
  const fragment = document.createDocumentFragment();
  for (const game of games) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kgb-game-button';
    button.dataset.gameId = game.id;

    const icon = document.createElement('span');
    icon.className = `kgb-game-icon kgb-theme-${game.id}`;
    icon.textContent = game.icon;
    icon.setAttribute('aria-hidden', 'true');

    const textWrap = document.createElement('span');
    textWrap.className = 'kgb-game-text';
    const label = document.createElement('span');
    label.textContent = game.name;
    const stars = document.createElement('span');
    stars.className = 'kgb-game-stars';
    textWrap.append(label, stars);

    button.append(icon, textWrap);
    fragment.append(button);
  }
  list.append(fragment);

  // リスナーはボタンごとではなく親に1つだけ（イベント委譲）
  list.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-game-button');
    if (!button) return;
    playTap();
    openGame(button.dataset.gameId);
  });
}

// ---------- あそびかた設定画面（ゲーム別定義から都度組み立てる） ----------

// 「だれが あそぶ？」: 保護者画面で名前が登録されているときだけ出す（v0.16）
function buildPlayerPicker() {
  const names = registeredNames();
  if (!names.length) return null;
  const section = document.createElement('div');
  section.className = 'kgb-setup-group';
  section.dataset.groupKey = 'players';
  const label = document.createElement('p');
  label.className = 'kgb-setup-label';
  label.textContent = text.whoPlays;
  const row = document.createElement('div');
  row.className = 'kgb-player-pick';
  for (const which of [0, 1]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `kgb-player-pick-button kgb-player-${which}`;
    button.dataset.which = which;
    row.append(button);
  }
  section.append(label, row);
  return section;
}

function updatePlayerPicker() {
  const { slots, p1, p2 } = getPlayers();
  const selection = currentSelection();
  for (const button of document.querySelectorAll('.kgb-player-pick-button')) {
    const which = Number(button.dataset.which);
    const index = which === 0 ? p1 : p2;
    button.textContent = text.playerSlotPrefix[which] + (index >= 0 ? slots[index] : text.noName);
    // プレイヤー2は ふたりモードのときだけ意味がある
    button.hidden = which === 1 && selection.mode !== 'two';
  }
}

// タップで「なし → 登録名1 → 登録名2 …」と順に切り替える（一覧を出さずに済ませる）
function cyclePlayer(which) {
  const { p1, p2 } = getPlayers();
  const names = registeredNames();
  const current = which === 0 ? p1 : p2;
  const other = which === 0 ? p2 : p1;
  // 相手側に入っている子は候補から外す（同じ子を両方に入れない）
  const order = [-1, ...names.map((n) => n.index).filter((i) => i !== other)];
  const next = order[(order.indexOf(current) + 1) % order.length];
  assignPlayer(which, next);
  updatePlayerPicker();
}

function buildSetupScreen(gameId) {
  const body = document.getElementById('setupBody');
  const fragment = document.createDocumentFragment();
  const picker = buildPlayerPicker();
  if (picker) fragment.append(picker);
  for (const group of setupConfigs[gameId].groups) {
    const section = document.createElement('div');
    section.className = 'kgb-setup-group';
    section.dataset.groupKey = group.key;

    const label = document.createElement('p');
    label.className = 'kgb-setup-label';
    label.textContent = group.label;

    const row = document.createElement('div');
    // 文字ラベル4つは1行に収まらないため2×2にする（数字だけの5択は1行のまま）
    row.className = group.options.length >= 6 ? 'kgb-option-row is-grid-3'
      : group.options.length === 4 ? 'kgb-option-row is-grid' : 'kgb-option-row';
    for (const [value, optionLabel] of group.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kgb-option-button';
      button.dataset.key = group.key;
      button.dataset.value = value;
      button.textContent = optionLabel;
      row.append(button);
    }

    section.append(label, row);
    fragment.append(section);
  }
  body.replaceChildren(fragment);
  updateSetupScreen();
}

function updateSetupScreen() {
  const selection = currentSelection();
  // 選択状態は一括class切替（§9: ループ内で書き込むのはclassのみ）
  for (const button of document.querySelectorAll('.kgb-option-button')) {
    button.classList.toggle(
      'is-selected',
      selection[button.dataset.key] === button.dataset.value,
    );
  }
  // ロボット対戦のときだけ意味がある選択肢（つよさ・ロボットのかず）や、
  // 特定の選択のときだけ意味がある選択肢（when）を隠す
  for (const group of setupConfigs[currentGameId].groups) {
    if (!group.cpuOnly && !group.when) continue;
    const el = document.querySelector(`[data-group-key="${group.key}"]`);
    if (!el) continue;
    const visible = (group.cpuOnly ? selection.mode === 'cpu' : true) && (group.when ? group.when(selection) : true);
    el.hidden = !visible;
  }
  updatePlayerPicker();
}

// ---------- ゲーム起動 ----------

function openGame(gameId) {
  const game = games.find((g) => g.id === gameId);
  if (!game) return;
  currentGameId = gameId;
  if (gameMounters[gameId]) {
    document.getElementById('setupTitle').textContent = game.name;
    buildSetupScreen(gameId);
    showScreen('setup');
  } else {
    document.getElementById('dummyTitle').textContent = game.name;
    const icon = document.getElementById('dummyIcon');
    icon.textContent = game.icon;
    icon.className = `kgb-dummy-icon kgb-theme-${gameId}`;
    showScreen('dummy');
  }
}

function startGame() {
  const game = games.find((g) => g.id === currentGameId);
  document.getElementById('playTitle').textContent = game.name;
  showScreen('play');
  currentGame = gameMounters[currentGameId](
    document.getElementById('gameRoot'),
    { ...currentSelection() },
    { onExit: goHome },
  );
}

// ---------- ミュートボタン ----------

function renderMuteButton() {
  // 🔊/🔇の絵文字表示。aria-labelも状態に合わせて更新する
  muteButton.textContent = isMuted() ? '🔇' : '🔊';
  muteButton.setAttribute('aria-label', isMuted() ? text.soundOff : text.soundOn);
}

// ---------- 起動 ----------

applyStaticText();
buildGameList();
updateHomeStars();
renderMuteButton();

// 設定画面の選択肢は都度作り直すため、リスナーは親に1回だけ登録しておく
document.getElementById('setupBody').addEventListener('click', (event) => {
  const pick = event.target.closest('.kgb-player-pick-button');
  if (pick) {
    playTap();
    cyclePlayer(Number(pick.dataset.which));
    return;
  }
  const button = event.target.closest('.kgb-option-button');
  if (!button) return;
  playTap();
  currentSelection()[button.dataset.key] = button.dataset.value;
  updateSetupScreen();
});

// ---------- スタンプちょう・保護者画面（v0.16） ----------

document.getElementById('stampsButton').addEventListener('click', () => {
  playTap();
  renderStamps(document.getElementById('stampsBody'));
  showScreen('stamps');
});

document.getElementById('stampsBackButton').addEventListener('click', () => {
  playTap();
  showScreen('home');
});

const gateOverlay = document.getElementById('gateOverlay');
let parentAbort = null;

function closeParent() {
  parentAbort?.abort();
  parentAbort = null;
  document.getElementById('parentBody').replaceChildren();
  showScreen('home');
}

document.getElementById('parentButton').addEventListener('click', () => {
  playTap();
  parentAbort?.abort();
  parentAbort = new AbortController();
  renderGate(document.getElementById('gateBody'), {
    signal: parentAbort.signal,
    onPass: () => {
      gateOverlay.hidden = true;
      renderParent(document.getElementById('parentBody'), { signal: parentAbort.signal });
      showScreen('parent');
    },
    onFail: () => {
      // 不正解は静かに閉じる（仕様§3.4-3）
      gateOverlay.hidden = true;
      parentAbort.abort();
      parentAbort = null;
    },
  });
  gateOverlay.hidden = false;
});

// ゲートの外側タップで閉じる
gateOverlay.addEventListener('click', (event) => {
  if (event.target !== gateOverlay) return;
  gateOverlay.hidden = true;
  parentAbort?.abort();
  parentAbort = null;
});

document.getElementById('parentBackButton').addEventListener('click', () => {
  playTap();
  closeParent();
});

// ---------- きゅうけいリマインダー・スタンプのお祝い（1プレイの区切りで判定。仕様§3.4） ----------

const breakOverlay = document.getElementById('breakOverlay');
const stampToast = document.getElementById('stampToast');
let sessionStartedAt = Date.now(); // 連続で遊びはじめた時刻（きゅうけい後・長い離席後にリセット）
let hiddenAt = 0;
let toastTimer = null;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  } else if (hiddenAt && Date.now() - hiddenAt >= 10 * 60 * 1000) {
    sessionStartedAt = Date.now(); // 10分以上はなれていたら「連続」を仕切り直す
  }
});

document.addEventListener('kgb:playdone', (event) => {
  const breakMinutes = loadSettings().breakMinutes ?? 30;
  if (breakMinutes > 0 && Date.now() - sessionStartedAt >= breakMinutes * 60 * 1000) {
    breakOverlay.hidden = false; // 結果画面の上に全画面で出す（途中には割り込まない）
  }
  const stamps = event.detail?.stamps ?? 0;
  if (isMilestone(stamps)) {
    const stats = loadStats();
    if ((stats.stampCelebrated ?? 0) < stamps) {
      stats.stampCelebrated = stamps;
      saveStats(stats); // お祝いを二度出さないための記録（イベント区切りの書き込み）
      stampToast.textContent = `${text.stampsMilestonePrefix}${stamps}${text.stampsMilestoneSuffix}`;
      stampToast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        stampToast.hidden = true;
      }, 2600);
    }
  }
});

document.getElementById('breakOkButton').addEventListener('click', () => {
  playTap();
  breakOverlay.hidden = true;
  sessionStartedAt = Date.now();
});

document.getElementById('setupBackButton').addEventListener('click', () => {
  playTap();
  showScreen('home');
});

document.getElementById('dummyBackButton').addEventListener('click', () => {
  playTap();
  showScreen('home');
});

document.getElementById('startButton').addEventListener('click', () => {
  playTap();
  startGame();
});

// ゲーム中の「←」は誤タップ対策で確認ダイアログを挟む（仕様§3.1）
document.getElementById('playBackButton').addEventListener('click', () => {
  playTap();
  quitOverlay.hidden = false;
});

document.getElementById('quitYesButton').addEventListener('click', () => {
  playTap();
  goHome();
});

document.getElementById('quitNoButton').addEventListener('click', () => {
  playTap();
  quitOverlay.hidden = true;
});

muteButton.addEventListener('click', () => {
  toggleMute();
  renderMuteButton();
  playTap(); // ミュート解除時に「音が出るようになった」ことが分かるよう、切替後に鳴らす
});
