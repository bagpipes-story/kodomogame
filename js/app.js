// app.js — 画面遷移・共通UI制御（v0.2）
// 画面構成: ホーム → あそびかた設定 → ゲーム → (結果はゲーム内オーバーレイ)
// 未実装ゲームはダミー画面へ。ゲーム本体はgames/<id>/ui.jsのmountに任せる。

import { text, games } from './i18n.js';
import { playTap, isMuted, toggleMute } from './sound.js';
import { loadStats } from './storage.js';
import { mount as mountMemory } from './games/memory/ui.js';
import { mount as mountOthello } from './games/othello/ui.js';
import { mount as mountSevens } from './games/sevens/ui.js';
import { mount as mountTictactoe } from './games/tictactoe/ui.js';
import { mount as mountMole } from './games/mole/ui.js';

const APP_VERSION = 'v0.6.2';

// 実装済みゲームのマウント関数。ここに無いゲームはダミー画面に遷移する
const gameMounters = {
  memory: mountMemory,
  othello: mountOthello,
  sevens: mountSevens,
  tictactoe: mountTictactoe,
  mole: mountMole,
};

const screens = {
  home: document.getElementById('screen-home'),
  setup: document.getElementById('screen-setup'),
  play: document.getElementById('screen-play'),
  dummy: document.getElementById('screen-dummy'),
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

const setupConfigs = {
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
    defaults: { mode: 'cpu', size: 'easy', level: 'weak' },
    groups: [
      { key: 'mode', label: text.modeLabel, options: [['solo', text.modeSolo], ['cpu', text.modeCpu], ['two', text.modeTwo]] },
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

function buildSetupScreen(gameId) {
  const body = document.getElementById('setupBody');
  const fragment = document.createDocumentFragment();
  for (const group of setupConfigs[gameId].groups) {
    const section = document.createElement('div');
    section.className = 'kgb-setup-group';
    section.dataset.groupKey = group.key;

    const label = document.createElement('p');
    label.className = 'kgb-setup-label';
    label.textContent = group.label;

    const row = document.createElement('div');
    // 4択以上は1行に収まらないため2×2のグリッドにする
    row.className = group.options.length > 3 ? 'kgb-option-row is-grid' : 'kgb-option-row';
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
  // ロボット対戦のときだけ意味がある選択肢（つよさ・ロボットのかず）を隠す
  for (const group of setupConfigs[currentGameId].groups) {
    if (!group.cpuOnly) continue;
    const el = document.querySelector(`[data-group-key="${group.key}"]`);
    if (el) el.hidden = selection.mode !== 'cpu';
  }
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
  const button = event.target.closest('.kgb-option-button');
  if (!button) return;
  playTap();
  currentSelection()[button.dataset.key] = button.dataset.value;
  updateSetupScreen();
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
