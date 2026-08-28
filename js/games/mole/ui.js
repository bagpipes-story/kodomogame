// ui.js — もぐらたたきの描画・入力（v0.6）
// 仕様§4.7の性能規定:
//   - もぐら・ちょうちょのDOMは9穴ぶん事前生成し、class切替だけで出し入れ（プレイ中のDOM生成・削除禁止）
//   - 判定はpointerdown（clickより速い）。マルチタッチ（両手たたき）対応
//   - 出現スケジューラは単一のsetInterval。ラウンド終了・画面離脱で必ずclear
//   - 残り時間バーはtransform: scaleXのみ

import {
  ROUND_SECONDS,
  DIFFICULTY,
  createGame,
  spawn,
  hide,
  hit,
  finishRound,
} from './game.js';
import { text } from '../../i18n.js';
import { playPop, playBonk, playFlutter, playWin, playTap } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

const OOPS_SHOW_MS = 900; // 「あっ、ちょうちょさん！」の表示時間

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();     // setTimeout
  const intervals = new Set();  // setInterval（スケジューラ・秒カウント）

  const isTwoMode = config.mode === 'two';
  const playerNames = [text.redName, text.blueName];
  const holeCount = DIFFICULTY[config.difficulty].holeCount;

  let state = null;
  let roundPlayer = 0;          // こうたい対戦で今ラウンドを遊んでいる人
  let scores = [0, 0];
  let secondsLeft = ROUND_SECONDS;
  let holeTokens = new Array(holeCount).fill(0); // 自動引っ込みタイマーの取り違え防止
  let playing = false;

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function every(fn, ms) {
    const id = setInterval(fn, ms);
    intervals.add(id);
    return id;
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const id of intervals) clearInterval(id);
    intervals.clear();
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-mole';

  // スコア表示（数唱: たたくたびに大きな数字が増える）
  const scoreRow = document.createElement('div');
  scoreRow.className = 'kgb-mole-score-row';
  const playerLabel = document.createElement('span');
  playerLabel.className = 'kgb-mole-player';
  const scoreEl = document.createElement('span');
  scoreEl.className = 'kgb-mole-score';
  const scoreUnit = document.createElement('span');
  scoreUnit.className = 'kgb-mole-score-unit';
  scoreUnit.textContent = text.moleCountSuffix;
  scoreRow.append(playerLabel, scoreEl, scoreUnit);

  // 残り時間: プログレスバー＋小さな秒数（仕様§4.7: 数字は補助的に小さく）
  const timeRow = document.createElement('div');
  timeRow.className = 'kgb-mole-time-row';
  const timeBar = document.createElement('div');
  timeBar.className = 'kgb-mole-time-bar';
  const timeFill = document.createElement('div');
  timeFill.className = 'kgb-mole-time-fill';
  timeBar.append(timeFill);
  const timeNum = document.createElement('span');
  timeNum.className = 'kgb-mole-time-num';
  timeRow.append(timeBar, timeNum);

  // コンボ／ちょうちょメッセージ（1行を使い回す）
  const statusEl = document.createElement('div');
  statusEl.className = 'kgb-mole-status';

  // 3×3の穴。キャラクターのspanも先に作っておく
  const field = document.createElement('div');
  // おとなモードは穴2倍(18こ)を6列で並べる
  field.className = holeCount > 9 ? 'kgb-mole-field is-wide' : 'kgb-mole-field';
  const charEls = [];
  {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < holeCount; i++) {
      const hole = document.createElement('div');
      hole.className = 'kgb-mole-hole';
      hole.dataset.index = i;
      const pit = document.createElement('div');
      pit.className = 'kgb-mole-pit';
      const char = document.createElement('span');
      char.className = 'kgb-mole-char';
      hole.append(char, pit);
      fragment.append(hole);
      charEls.push(char);
    }
    field.append(fragment);
  }

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
  startSub.textContent = text.handoverTap;
  startOverlay.append(startTitle, startSub);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(scoreRow, timeRow, statusEl, field);
  root.append(container, startOverlay, resultOverlay);

  // ---------- 表示の差分更新 ----------

  function updateScore(popAnim = false) {
    scoreEl.textContent = String(state ? state.score : 0);
    if (popAnim) {
      scoreEl.classList.remove('is-pop');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('is-pop');
    }
  }

  function updateTime() {
    timeFill.style.transform = `scaleX(${secondsLeft / ROUND_SECONDS})`;
    timeNum.textContent = secondsLeft + text.secondsSuffix;
  }

  function showCombo() {
    statusEl.textContent = state.combo >= 2 ? state.combo + text.comboSuffix : '';
    statusEl.classList.remove('is-oops');
  }

  function charUp(index, kind) {
    const char = charEls[index];
    char.textContent = kind === 'mole' ? '🐹' : '🦋';
    char.className = `kgb-mole-char is-up ${kind === 'mole' ? 'kgb-char-mole' : 'kgb-char-butterfly'}`;
  }

  function charDown(index) {
    charEls[index].classList.remove('is-up', 'is-hit');
  }

  // ---------- ラウンド進行 ----------

  function showStartOverlay() {
    startTitle.textContent = isTwoMode
      ? playerNames[roundPlayer] + text.turnSuffix
      : text.readyTitle;
    playerLabel.textContent = isTwoMode ? playerNames[roundPlayer] : '';
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    playTap();
    startOverlay.hidden = true;
    runRound();
  }, { signal: abort.signal });

  function runRound() {
    state = createGame({ difficulty: config.difficulty });
    resetPraise();
    secondsLeft = ROUND_SECONDS;
    playing = true;
    updateScore();
    updateTime();
    showCombo();

    // 出現スケジューラ（単一のsetInterval）
    every(() => {
      const spawned = spawn(state);
      if (!spawned) return;
      const token = ++holeTokens[spawned.index];
      charUp(spawned.index, spawned.kind);
      playPop();
      // 一定時間たったら自動で引っ込む（たたかれていなければ）
      later(() => {
        if (holeTokens[spawned.index] !== token) return; // もう別の出番になっている
        if (hide(state, spawned.index)) {
          holeTokens[spawned.index]++;
          charDown(spawned.index);
        }
      }, state.settings.spawnMs * 1.6);
    }, state.settings.spawnMs);

    // 秒カウント
    every(() => {
      secondsLeft--;
      updateTime();
      if (secondsLeft <= 0) endRound();
    }, 1000);
  }

  function endRound() {
    playing = false;
    clearAllTimers();
    finishRound(state);
    for (let i = 0; i < holeCount; i++) {
      holeTokens[i]++;
      charDown(i);
    }
    scores[roundPlayer] = state.score;

    // ほめイベント（仕様§4.7）
    if (state.hasButterflies && state.butterflyHits === 0) emitPraise('perfect_patience');
    emitPraise('finished_game');

    if (isTwoMode && roundPlayer === 0) {
      roundPlayer = 1;
      showStartOverlay(); // あおのラウンドへ
      return;
    }
    finishGame();
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame() {
    let isNewRecord = false;
    let bestForDifficulty = state.score;
    if (!isTwoMode) {
      // さいこうきろくは むずかしさ別（おとなの記録と子どもの記録を混ぜない）
      const stats = loadStats();
      stats.mole ??= { best: 0, plays: 0 };
      stats.mole.bestBy ??= {};
      const best = stats.mole.bestBy[config.difficulty] ?? 0;
      if (state.score > best) {
        stats.mole.bestBy[config.difficulty] = state.score;
        isNewRecord = true;
        emitPraise('new_record');
      }
      bestForDifficulty = Math.max(best, state.score);
      saveStats(stats);
    }
    recordPlay('mole', { won: false });

    let title;
    let detail = '';
    if (isTwoMode) {
      const [a, b] = scores;
      title = a === b ? text.draw : (a > b ? text.winRed : text.winBlue);
      detail = `${text.redName} ${a}${text.moleCountSuffix} ／ ${text.blueName} ${b}${text.moleCountSuffix}`;
    } else {
      title = text.moleResultPrefix + state.score + text.moleResultSuffix;
      detail = `${text.bestLabel}: ${bestForDifficulty}${text.moleCountSuffix}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
    }

    const dialog = document.createElement('div');
    dialog.className = 'kgb-dialog';
    const titleEl = document.createElement('p');
    titleEl.className = 'kgb-result-title';
    titleEl.textContent = title;
    const detailEl = document.createElement('p');
    detailEl.className = 'kgb-result-detail';
    detailEl.textContent = detail;

    const praiseBox = document.createElement('div');
    praiseBox.className = 'kgb-praise-box';
    const praiseLabel = document.createElement('p');
    praiseLabel.className = 'kgb-praise-label';
    praiseLabel.textContent = text.praiseTitle;
    const praiseText = document.createElement('p');
    praiseText.className = 'kgb-praise-text';
    praiseText.textContent = pickPraise();
    praiseBox.append(praiseLabel, praiseText);

    const buttons = document.createElement('div');
    buttons.className = 'kgb-dialog-buttons';
    const replayButton = document.createElement('button');
    replayButton.type = 'button';
    replayButton.className = 'kgb-dialog-button kgb-dialog-primary';
    replayButton.textContent = text.replay;
    const homeButton = document.createElement('button');
    homeButton.type = 'button';
    homeButton.className = 'kgb-dialog-button';
    homeButton.textContent = text.goHome;
    buttons.append(replayButton, homeButton);

    dialog.append(titleEl, detailEl, praiseBox, buttons);
    resultOverlay.replaceChildren(dialog);
    resultOverlay.prepend(buildConfetti()); // がんばりをたたえて毎回お祝い
    playWin();
    resultOverlay.hidden = false;

    replayButton.addEventListener('click', () => {
      playTap();
      restart();
    }, { signal: abort.signal });
    homeButton.addEventListener('click', () => {
      playTap();
      onExit();
    }, { signal: abort.signal });
  }

  function buildConfetti() {
    const wrap = document.createElement('div');
    wrap.className = 'kgb-confetti-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    const colors = ['#f6a6b2', '#f9c784', '#7fc8a9', '#a5b8f3', '#c9a7eb'];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('span');
      piece.className = 'kgb-confetti';
      piece.style.left = `${(i / 24) * 100 + Math.random() * 4}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.8}s`;
      piece.style.animationDuration = `${1.6 + Math.random()}s`;
      fragment.append(piece);
    }
    wrap.append(fragment);
    return wrap;
  }

  function restart() {
    clearAllTimers();
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    scores = [0, 0];
    roundPlayer = 0;
    state = null;
    scoreEl.textContent = '0';
    statusEl.textContent = '';
    showStartOverlay();
  }

  // ---------- 入力（pointerdownで即判定。リスナーは親に1つ） ----------

  field.addEventListener('pointerdown', (event) => {
    if (!playing) return;
    const hole = event.target.closest('.kgb-mole-hole');
    if (!hole) return;
    const index = Number(hole.dataset.index);
    const result = hit(state, index);
    if (result.type === 'mole') {
      // ヒット直後に同じ穴へ次が出ても消してしまわないよう、トークンで照合する
      const token = ++holeTokens[index];
      const char = charEls[index];
      char.classList.add('is-hit');
      playBonk();
      updateScore(true);
      showCombo();
      later(() => {
        if (holeTokens[index] === token) charDown(index);
      }, 160);
      return;
    }
    if (result.type === 'butterfly') {
      holeTokens[index]++;
      charDown(index);
      playFlutter();
      statusEl.textContent = text.butterflyOops;
      statusEl.classList.add('is-oops');
      later(() => showCombo(), OOPS_SHOW_MS);
      return;
    }
    if (result.type === 'miss') {
      showCombo(); // コンボ表示を消すだけ（音は鳴らさない: 連打を責めない）
    }
  }, { signal: abort.signal });

  restart();

  return {
    destroy() {
      clearAllTimers();
      abort.abort();
      root.replaceChildren();
    },
  };
}
