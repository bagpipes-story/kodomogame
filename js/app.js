// app.js — 画面遷移・共通UI制御（v0.1）
// v0.1の画面構成: ホーム ⇄ ダミー画面（全ゲーム共通）。
// v0.2以降、ゲームごとのui.jsをここから呼び出す形に拡張する。

import { text, games } from './i18n.js';
import { playTap, isMuted, toggleMute } from './sound.js';

const APP_VERSION = 'v0.1';

const homeScreen = document.getElementById('screen-home');
const gameScreen = document.getElementById('screen-game');
const gameTitle = document.getElementById('gameTitle');
const gameIcon = document.getElementById('gameIcon');
const muteButton = document.getElementById('muteButton');

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

    const label = document.createElement('span');
    label.textContent = game.name;

    button.append(icon, label);
    fragment.append(button);
  }
  list.append(fragment);

  // リスナーはボタンごとではなく親に1つだけ（イベント委譲）
  list.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-game-button');
    if (!button) return;
    playTap();
    showGameScreen(button.dataset.gameId);
  });
}

// ---------- 画面遷移（hidden属性の切り替えのみ。再描画コストなし） ----------

function showGameScreen(gameId) {
  const game = games.find((g) => g.id === gameId);
  if (!game) return;
  gameTitle.textContent = game.name;
  gameIcon.textContent = game.icon;
  gameIcon.className = `kgb-dummy-icon kgb-theme-${gameId}`;
  homeScreen.hidden = true;
  gameScreen.hidden = false;
}

function showHomeScreen() {
  gameScreen.hidden = true;
  homeScreen.hidden = false;
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
renderMuteButton();

document.getElementById('backButton').addEventListener('click', () => {
  playTap();
  showHomeScreen();
});

muteButton.addEventListener('click', () => {
  toggleMute();
  renderMuteButton();
  playTap(); // ミュート解除時に「音が出るようになった」ことが分かるよう、切替後に鳴らす
});
