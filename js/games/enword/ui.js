// ui.js — えいごカードあての描画・入力（v0.14。別冊04§3）
// 中央に絵、まわりに英単語カードを円環状に配置。ひとり／ロボくんと早押し／ふたり同時（上下2分割）。
// 性能規定: カードは最大6枚×パネル数を最初に作り、以後はテキスト・class・位置変数の差分更新のみ。
// ロボくんの考え中ゲージはCSS transitionのscaleX（毎フレームJS更新なし）。
// iOSの制約: 出題音声は「タップ」を起点に鳴らす（スタート／つぎ！のタップ内で say() を呼ぶ）。

import {
  DIFFICULTY,
  QUESTIONS_PER_ROUND,
  createGame,
  nextQuestion,
  addListen,
  answer,
  robotAnswer,
} from './game.js';
import { text } from '../../i18n.js';
import { playTap, playMatch, playFlutter, playWin, playTurn } from '../../sound.js';
import { loadStats, saveStats, loadSettings } from '../../storage.js';
import { createWordVisual } from '../../wordart.js';
import { say, hasEnglishVoice, cancelSpeech } from '../../speech.js';
import { createRace, robotChoice, assistExtraMs } from '../../race.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';

const MAX_OPTIONS = 6;
const ROBOT_MISS_MS = 900;   // 「あれれ？」を見せてから考え直すまで
const CORRECT_WAIT_MS = 700; // 正解演出のあと「つぎ！」を出すまで
const ROUND_END_MS = 1200;   // 最終問の演出のあと結果を出すまで

// 円環配置: 枚数ごとの角度（度）と半径（px）。上から時計回り
const RING = {
  3: { r: 118, angles: [-90, 30, 150] },
  4: { r: 112, angles: [-90, 0, 90, 180] },
  6: { r: 128, angles: [-90, -30, 30, 90, 150, 210] },
};

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const mode = config.mode ?? 'solo';
  const difficulty = DIFFICULTY[config.difficulty] ? config.difficulty : 'easy';
  const def = DIFFICULTY[difficulty];
  const level = config.level ?? 'weak';
  const isCpu = mode === 'cpu';
  const isTwo = mode === 'two';
  const categories = config.category && config.category !== 'all'
    ? [config.category]
    : loadSettings().wordCategories;
  const voiceOk = hasEnglishVoice();
  const names = isCpu ? [text.you, text.robotName] : [text.redName, text.blueName];

  let state = null;
  let phase = 'idle'; // idle | ask | done | result
  let race = null;
  let extraMs = 0;

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = `kgb-enword is-${mode}`;

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner kgb-enword-banner';

  // ロボくん（cpuモードのみ）: 顔＋考え中ゲージ＋ひとこと
  const robotRow = document.createElement('div');
  robotRow.className = 'kgb-enword-robot';
  robotRow.hidden = !isCpu;
  const robotFace = document.createElement('span');
  robotFace.className = 'kgb-enword-robot-face';
  robotFace.textContent = '🤖';
  const gauge = document.createElement('div');
  gauge.className = 'kgb-enword-gauge';
  const gaugeFill = document.createElement('div');
  gaugeFill.className = 'kgb-enword-gauge-fill';
  gauge.append(gaugeFill);
  const robotText = document.createElement('span');
  robotText.className = 'kgb-enword-robot-text';
  robotRow.append(robotFace, gauge, robotText);

  // 中央: 絵＋スピーカー＋正解後の「apple！ りんご」
  const center = document.createElement('div');
  center.className = 'kgb-enword-center';
  const picture = document.createElement('div');
  picture.className = 'kgb-enword-picture';
  const caption = document.createElement('p');
  caption.className = 'kgb-enword-caption';
  const speaker = document.createElement('button');
  speaker.type = 'button';
  speaker.className = 'kgb-enword-speaker';
  speaker.textContent = '🔊';
  speaker.setAttribute('aria-label', text.ewListen);
  speaker.hidden = !(def.speaker && voiceOk);
  const nextHint = document.createElement('span');
  nextHint.className = 'kgb-enword-center-next';
  nextHint.textContent = text.ewNext;
  center.append(picture, speaker, caption, nextHint);

  // カードパネル: ひとり/ロボくんは円環1つ、ふたりは上下2パネル（上は180°回転）
  const panels = [];
  const cardEls = []; // panels[p] のカード配列
  function buildPanel(playerIndex, ring) {
    const panel = document.createElement('div');
    panel.className = ring ? 'kgb-enword-ring' : `kgb-enword-panel kgb-player-${playerIndex}`;
    panel.dataset.player = playerIndex;
    const cards = [];
    for (let i = 0; i < MAX_OPTIONS; i++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kgb-enword-card';
      card.dataset.index = i;
      const initial = document.createElement('span');
      initial.className = 'kgb-enword-card-initial';
      const rest = document.createElement('span');
      rest.className = 'kgb-enword-card-rest';
      card.append(initial, rest);
      panel.append(card);
      cards.push(card);
    }
    if (!ring) {
      const score = document.createElement('span');
      score.className = 'kgb-enword-panel-score';
      panel.append(score);
      const lock = document.createElement('div');
      lock.className = 'kgb-enword-lock';
      lock.textContent = text.koWait;
      panel.append(lock);
    }
    panels.push(panel);
    cardEls.push(cards);
    return panel;
  }

  const stage = document.createElement('div');
  stage.className = 'kgb-enword-stage';
  if (isTwo) {
    const top = buildPanel(1, false);
    top.classList.add('is-top');
    const bottom = buildPanel(0, false);
    bottom.classList.add('is-bottom');
    stage.append(top, center, bottom);
  } else {
    const ring = buildPanel(0, true);
    ring.append(center);
    stage.append(ring);
  }

  const statusEl = document.createElement('p');
  statusEl.className = 'kgb-enword-status';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'kgb-enword-next';
  nextButton.textContent = text.ewNext;
  nextButton.hidden = true;

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  startTitle.textContent = text.readyTitle;
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
  startSub.textContent = text.handoverTap;
  startOverlay.append(startTitle, startSub);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, robotRow, stage, statusEl);
  if (!isTwo) container.append(nextButton);
  root.append(container, startOverlay, resultOverlay);

  // ---------- 表示の差分更新 ----------

  function updateBanner() {
    const counter = `${state.questionIndex} / ${QUESTIONS_PER_ROUND}${text.ewQuestionSuffix}`;
    if (mode === 'solo') {
      banner.textContent = `${counter}　${text.ewCorrectLabel} ${state.scores[0]}`;
    } else if (isCpu) {
      // 1行に収めるため問数は「1/10」の短い形
      banner.textContent = `${state.questionIndex}/${QUESTIONS_PER_ROUND}　${names[0]} ${state.scores[0]} ／ ${names[1]} ${state.scores[1]}`;
    } else {
      banner.textContent = counter;
      for (const panel of panels) {
        const p = Number(panel.dataset.player);
        panel.querySelector('.kgb-enword-panel-score').textContent = `${names[p]} ${state.scores[p]}`;
      }
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  // 円環の位置は枚数で決まる。カードごとにCSS変数を書く（1問あたり最大6回の書き込み）
  function placeRing(cards, count) {
    const { r, angles } = RING[count] ?? RING[3];
    for (let i = 0; i < MAX_OPTIONS; i++) {
      const card = cards[i];
      if (i >= count) continue;
      const rad = (angles[i] * Math.PI) / 180;
      card.style.setProperty('--x', `${Math.round(Math.cos(rad) * r)}px`);
      card.style.setProperty('--y', `${Math.round(Math.sin(rad) * r)}px`);
    }
  }

  function renderQuestion(q) {
    const count = q.options.length;
    for (let p = 0; p < panels.length; p++) {
      const cards = cardEls[p];
      for (let i = 0; i < MAX_OPTIONS; i++) {
        const card = cards[i];
        card.hidden = i >= count;
        if (i >= count) continue;
        const word = q.options[i].en;
        card.firstChild.textContent = word[0];
        card.lastChild.textContent = word.slice(1);
        card.className = `kgb-enword-card ${word.length >= 8 ? 'is-long' : word.length >= 6 ? 'is-mid' : ''}`;
      }
      if (!isTwo) placeRing(cards, count);
      panels[p].classList.remove('is-locked');
    }
    picture.replaceChildren(createWordVisual(q.answer));
    picture.classList.remove('is-pop');
    caption.textContent = '';
    caption.classList.remove('is-on');
    container.classList.remove('is-done');
  }

  function showCaption(q) {
    caption.textContent = `${q.answer.en}！ ${q.answer.ja}`;
    caption.classList.add('is-on');
    picture.classList.add('is-pop');
  }

  function setCardClass(index, className) {
    for (const cards of cardEls) cards[index].classList.add(className);
  }

  // ---------- 音声・ゲージ ----------

  // 読み上げは「いま鳴っている1回＋予約1回」まで。連打しても2回ぶんで打ち止め（それ以上は無視）
  const MAX_QUEUED_SAYS = 2;
  let queuedSays = 0;
  function speak(q) {
    if (queuedSays >= MAX_QUEUED_SAYS) return Promise.resolve();
    queuedSays += 1;
    addListen(state);
    return say(q.answer.en).finally(() => {
      queuedSays -= 1;
    });
  }

  function resetGauge() {
    gaugeFill.style.transition = 'none';
    gaugeFill.style.transform = 'scaleX(0)';
    robotText.textContent = '';
  }

  function startGauge() {
    if (!isCpu || !race) return;
    const duration = race.start();
    robotText.textContent = text.ewRobotThinking;
    gaugeFill.style.transition = 'none';
    gaugeFill.style.transform = 'scaleX(0)';
    void gaugeFill.getBoundingClientRect(); // transitionのリセットを確定させる
    gaugeFill.style.transition = `transform ${Math.round(duration)}ms linear`;
    gaugeFill.style.transform = 'scaleX(1)';
  }

  function stopGauge() {
    race?.stop();
    // 今の伸び位置で止める（計測値をそのまま書く。1回だけ）
    const rect = gaugeFill.getBoundingClientRect();
    const full = gauge.getBoundingClientRect().width || 1;
    gaugeFill.style.transition = 'none';
    gaugeFill.style.transform = `scaleX(${Math.min(rect.width / full, 1)})`;
  }

  // ロボくんの番（ゲージ満タン）
  function robotTurn() {
    const q = state.current;
    if (phase !== 'ask' || !q) return;
    const choice = q.robotMissed
      ? q.correctIndex
      : robotChoice(level, q.correctIndex, q.options.length);
    const result = robotAnswer(state, choice);
    if (!result.ok) return;
    if (result.correct) {
      // ロボくんが先取り。正解カードを光らせてもう一度鳴らす（負けても学習が成立する。別冊04§2.3）
      setCardClass(choice, 'is-robot');
      robotText.textContent = text.ewRobotGot;
      playTurn();
      showCaption(q);
      say(q.answer.en);
      finishQuestion(result.roundOver);
      return;
    }
    setCardClass(choice, 'is-robot-miss');
    robotText.textContent = text.ewRobotOops;
    playFlutter();
    later(() => {
      for (const cards of cardEls) cards[choice].classList.remove('is-robot-miss');
      if (phase === 'ask' && state.current === q) startGauge();
    }, ROBOT_MISS_MS);
  }

  // ---------- 出題の流れ ----------

  // タップ起点で呼ぶこと（iOSの読み上げ制約）
  function askQuestion() {
    const q = nextQuestion(state);
    if (!q) return;
    phase = 'ask';
    renderQuestion(q);
    updateBanner();
    resetGauge();
    nextButton.hidden = true;
    if (!voiceOk) setStatus(text.noVoiceNote);
    else if (def.autoPlays === 0) setStatus(text.ewTapToHear);
    else setStatus('');

    // 自動再生（かんたん2回・ふつう1回）が鳴り終わってからゲージ開始（別冊04§2.3）
    let plays = voiceOk ? def.autoPlays : 0;
    const chain = () => {
      if (phase !== 'ask' || state.current !== q) return;
      if (plays <= 0) {
        startGauge();
        return;
      }
      plays -= 1;
      speak(q).then(chain);
    };
    chain();
  }

  function finishQuestion(roundOver) {
    phase = 'done';
    updateBanner();
    if (roundOver) {
      later(() => finishGame(roundOver), ROUND_END_MS);
      return;
    }
    later(() => {
      container.classList.add('is-done');
      nextButton.hidden = false;
    }, CORRECT_WAIT_MS);
  }

  function handleAnswer(player, index) {
    if (phase !== 'ask') return;
    const q = state.current;
    const result = answer(state, player, index);
    if (!result.ok) return;
    if (result.correct) {
      if (isCpu) stopGauge();
      setCardClass(index, 'is-correct');
      // 音声1回で正解（別冊04§3のほめ）: 自動再生＋スピーカーの合計が1回
      if (q.listens === 1 && q.wrong.size === 0) emitPraise('one_listen');
      playMatch();
      showCaption(q);
      say(q.answer.en);
      setStatus(isTwo ? `${names[player]}${text.ewGotSuffix}` : text.ewCorrect);
      finishQuestion(result.roundOver);
      return;
    }
    // 不正解: そのカードを灰色に（選び直し可。ゲージは止めない）
    for (const cards of cardEls) cards[index].classList.add('is-wrong');
    playFlutter();
    if (isTwo) {
      panels.find((p) => Number(p.dataset.player) === player)?.classList.add('is-locked');
      if (result.bothLocked) {
        for (const p of panels) p.classList.remove('is-locked'); // 幕を外して正解を見せる
        setCardClass(q.correctIndex, 'is-reveal');
        setStatus(text.ewBothLocked);
        showCaption(q);
        say(q.answer.en);
        finishQuestion(result.roundOver);
        return;
      }
    }
    setStatus(text.ewWrong);
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame(over) {
    phase = 'result';
    emitPraise('finished_game');
    const [a, b] = over.scores;
    const childWon = isCpu && a > b;
    if (childWon) emitPraise('beat_robot');
    if (mode === 'solo' && state.firstTryCorrect === QUESTIONS_PER_ROUND) emitPraise('perfect_first_try');

    if (isCpu) {
      // 難易度アシスト用の連敗カウント（負けたら+1、それ以外は0）
      const stats = loadStats();
      stats.lossStreak ??= {};
      stats.lossStreak.enword = a < b ? (stats.lossStreak.enword ?? 0) + 1 : 0;
      saveStats(stats);
    }
    recordPlay('enword', { won: childWon });

    let title;
    let detail;
    let celebrate;
    if (mode === 'solo') {
      title = `${QUESTIONS_PER_ROUND}${text.ewResultMid}${a}${text.ewResultSuffix}`;
      detail = text.playAgainTone;
      celebrate = a >= QUESTIONS_PER_ROUND;
    } else {
      const winner = over.winner;
      if (winner === null) title = text.draw;
      else if (isCpu) title = winner === 0 ? text.winYou : text.winRobot;
      else title = winner === 0 ? text.winRed : text.winBlue;
      detail = `${names[0]} ${a} ／ ${names[1]} ${b}`;
      celebrate = isCpu ? winner === 0 : true;
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
    if (celebrate) {
      resultOverlay.prepend(buildConfetti());
      playWin();
    } else {
      playMatch();
    }
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
    cancelSpeech();
    race?.stop();
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();
    state = createGame({ difficulty, mode, categories });
    if (isCpu) {
      extraMs = assistExtraMs(level, loadStats().lossStreak?.enword ?? 0);
      race = createRace({ level, extraMs, onDone: robotTurn });
    }
    phase = 'idle';
    for (const cards of cardEls) for (const card of cards) card.hidden = true;
    picture.replaceChildren();
    caption.textContent = '';
    caption.classList.remove('is-on');
    container.classList.remove('is-done');
    nextButton.hidden = true;
    resetGauge();
    setStatus('');
    updateBanner();
    startOverlay.hidden = false;
  }

  // ---------- 入力 ----------

  startOverlay.addEventListener('click', () => {
    if (phase !== 'idle') return;
    playTap();
    startOverlay.hidden = true;
    askQuestion(); // タップ内で出題音声を鳴らす
  }, { signal: abort.signal });

  function goNext() {
    if (phase !== 'done') return;
    playTap();
    askQuestion();
  }
  nextButton.addEventListener('click', goNext, { signal: abort.signal });
  // 中央の絵: 出題中はタップで聞き直し（スピーカーと同じ）、正解後はタップで次へ
  // （ふたりモードは上下どちらの席からも届く）
  center.addEventListener('click', (event) => {
    if (event.target === speaker) return;
    if (phase === 'done') {
      goNext();
    } else if (phase === 'ask' && def.speaker && voiceOk) {
      playTap();
      speak(state.current);
    }
  }, { signal: abort.signal });

  speaker.addEventListener('click', () => {
    if (phase !== 'ask' && phase !== 'done') return;
    playTap();
    speak(state.current);
  }, { signal: abort.signal });

  // カードはpointerdownで判定（ふたり同時のマルチタッチを両方拾う。別冊04§2.3）
  for (const panel of panels) {
    panel.addEventListener('pointerdown', (event) => {
      const card = event.target.closest('.kgb-enword-card');
      if (!card || card.hidden) return;
      if (card.classList.contains('is-wrong')) return;
      handleAnswer(Number(panel.dataset.player), Number(card.dataset.index));
    }, { signal: abort.signal });
  }

  restart();

  return {
    destroy() {
      clearAllTimers(); // §9: 画面遷移時にタイマーを必ず解除
      race?.stop();
      cancelSpeech();   // 読み上げ中の離脱でも音を止める（別冊04§10）
      abort.abort();
      root.replaceChildren();
    },
  };
}
