// ui.js — きいてタッチの描画・入力（v0.15。別冊04§5）
// 絵が4枚（2×2）。英語の指示を聞いて正しい絵をタップ。ひとり／ロボくんと早押し／ふたり同時（上下2分割）。
// 骨格はえいごカードあて(enword/ui.js)と同じ: タイル4枚×パネル数を最初に作り、以後は中身の差し替えとclass切替のみ。
// ロボくんのゲージはCSS transitionのscaleX。出題音声は「スタート／つぎ！」のタップ起点で鳴らす（iOSの制約）。
// 英語音声がない端末では指示文を文字で出す（視覚のみで成立）。

import {
  OPTION_COUNT,
  QUESTIONS_PER_ROUND,
  createGame,
  nextQuestion,
  addListen,
  answer,
  robotAnswer,
} from './game.js';
import { text } from '../../i18n.js';
import { getNames, turnOf, winOf } from '../../players.js';
import { playTap, playMatch, playFlutter, playTurn } from '../../sound.js';
import { loadStats, saveStats, loadSettings } from '../../storage.js';
import { createWordVisual } from '../../wordart.js';
import { say, hasEnglishVoice, cancelSpeech } from '../../speech.js';
import { createRace, robotChoice, assistExtraMs } from '../../race.js';
import { resetPraise, emitPraise, recordPlay } from '../../praise.js';
import { showResult, hideResult } from '../../resultView.js';

const ROBOT_MISS_MS = 900;
const CORRECT_WAIT_MS = 700;
const ROUND_END_MS = 1200;
const COMBO_PRAISE = 3;      // 連続正解のほめ（別冊04§5）
const MAX_QUEUED_SAYS = 2;   // 連打しても「鳴っている1回＋予約1回」まで

// タイルの中身: 種類ごとの描き方（絵文字／色つき図形／数だけ並べる／大小）
function renderItem(item) {
  const wrap = document.createElement('span');
  wrap.className = 'kgb-listen-item';
  if (item.color) {
    wrap.append(createWordVisual(item.word, { color: item.color.value }));
  } else if (item.count) {
    wrap.classList.add(`is-count-${item.count}`);
    for (let i = 0; i < item.count; i++) {
      const one = document.createElement('span');
      one.className = 'kgb-listen-one';
      one.textContent = item.word.value;
      wrap.append(one);
    }
  } else if (item.size) {
    wrap.classList.add(`is-${item.size}`);
    wrap.append(createWordVisual(item.word));
  } else {
    wrap.append(createWordVisual(item.word));
  }
  return wrap;
}

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const mode = config.mode ?? 'solo';
  const difficulty = ['easy', 'normal', 'hard'].includes(config.difficulty) ? config.difficulty : 'easy';
  const level = config.level ?? 'weak';
  const isCpu = mode === 'cpu';
  const isTwo = mode === 'two';
  const categories = config.category && config.category !== 'all'
    ? [config.category]
    : loadSettings().wordCategories;
  const voiceOk = hasEnglishVoice();
  const names = getNames(mode, isCpu ? [text.you, text.robotName] : [text.redName, text.blueName]);

  let state = null;
  let phase = 'idle'; // idle | ask | done | result
  let race = null;
  let queuedSays = 0;

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
  container.className = `kgb-listen is-${mode}`;

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner kgb-listen-banner';

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

  // 中央: 大きなスピーカー（タップで聞き直し）＋指示文（正解後、または音声なし端末）
  const center = document.createElement('div');
  center.className = 'kgb-listen-center';
  const speaker = document.createElement('button');
  speaker.type = 'button';
  speaker.className = 'kgb-listen-speaker';
  speaker.textContent = '🔊';
  speaker.setAttribute('aria-label', text.ewListen);
  const caption = document.createElement('p');
  caption.className = 'kgb-listen-caption';
  const nextHint = document.createElement('span');
  nextHint.className = 'kgb-listen-center-next';
  nextHint.textContent = text.ewNext;
  center.append(speaker, caption, nextHint);

  const panels = [];
  const tileEls = [];
  function buildPanel(playerIndex) {
    const panel = document.createElement('div');
    panel.className = `kgb-listen-panel kgb-player-${playerIndex}`;
    panel.dataset.player = playerIndex;
    const tiles = [];
    for (let i = 0; i < OPTION_COUNT; i++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'kgb-listen-tile';
      tile.dataset.index = i;
      panel.append(tile);
      tiles.push(tile);
    }
    if (isTwo) {
      const score = document.createElement('span');
      score.className = 'kgb-listen-panel-score';
      panel.append(score);
      const lock = document.createElement('div');
      lock.className = 'kgb-enword-lock';
      lock.textContent = text.koWait;
      panel.append(lock);
    }
    panels.push(panel);
    tileEls.push(tiles);
    return panel;
  }

  const stage = document.createElement('div');
  stage.className = 'kgb-listen-stage';
  if (isTwo) {
    const top = buildPanel(1);
    top.classList.add('is-top');
    const bottom = buildPanel(0);
    bottom.classList.add('is-bottom');
    stage.append(top, center, bottom);
  } else {
    stage.append(center, buildPanel(0));
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
  startTitle.textContent = text.liTitle;
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
    const n = `${state.questionIndex}/${QUESTIONS_PER_ROUND}`;
    if (mode === 'solo') {
      banner.textContent = `${n}　${text.ewCorrectLabel} ${state.scores[0]}`;
    } else if (isCpu) {
      banner.textContent = `${n}　${names[0]} ${state.scores[0]} ／ ${names[1]} ${state.scores[1]}`;
    } else {
      banner.textContent = `${state.questionIndex} / ${QUESTIONS_PER_ROUND}${text.ewQuestionSuffix}`;
      for (const panel of panels) {
        const p = Number(panel.dataset.player);
        panel.querySelector('.kgb-listen-panel-score').textContent = `${names[p]} ${state.scores[p]}`;
      }
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function renderQuestion(q) {
    for (let p = 0; p < panels.length; p++) {
      for (let i = 0; i < OPTION_COUNT; i++) {
        const tile = tileEls[p][i];
        tile.className = 'kgb-listen-tile';
        tile.replaceChildren(renderItem(q.options[i]));
      }
      panels[p].classList.remove('is-locked');
    }
    // 音声なし端末では指示文を最初から見せる（文字で成立させる）
    caption.textContent = voiceOk ? '' : q.label;
    caption.classList.toggle('is-on', !voiceOk);
    container.classList.remove('is-done');
  }

  function showCaption(q) {
    caption.textContent = `${q.label}！ ${q.ja}`;
    caption.classList.add('is-on');
  }

  function setTileClass(index, className) {
    for (const tiles of tileEls) tiles[index].classList.add(className);
  }

  // ---------- 音声・ゲージ ----------

  function speak(q) {
    if (queuedSays >= MAX_QUEUED_SAYS) return Promise.resolve();
    queuedSays += 1;
    addListen(state);
    speaker.classList.add('is-talking');
    return say(q.phrase).finally(() => {
      queuedSays -= 1;
      if (queuedSays === 0) speaker.classList.remove('is-talking');
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
    void gaugeFill.getBoundingClientRect();
    gaugeFill.style.transition = `transform ${Math.round(duration)}ms linear`;
    gaugeFill.style.transform = 'scaleX(1)';
  }

  function stopGauge() {
    race?.stop();
    const rect = gaugeFill.getBoundingClientRect();
    const full = gauge.getBoundingClientRect().width || 1;
    gaugeFill.style.transition = 'none';
    gaugeFill.style.transform = `scaleX(${Math.min(rect.width / full, 1)})`;
  }

  function robotTurn() {
    const q = state.current;
    if (phase !== 'ask' || !q) return;
    const choice = q.robotMissed ? q.correctIndex : robotChoice(level, q.correctIndex, OPTION_COUNT);
    const result = robotAnswer(state, choice);
    if (!result.ok) return;
    if (result.correct) {
      setTileClass(choice, 'is-robot');
      robotText.textContent = text.ewRobotGot;
      playTurn();
      showCaption(q);
      say(q.phrase);
      finishQuestion(result.roundOver);
      return;
    }
    setTileClass(choice, 'is-robot-miss');
    robotText.textContent = text.ewRobotOops;
    playFlutter();
    later(() => {
      for (const tiles of tileEls) tiles[choice].classList.remove('is-robot-miss');
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
    setStatus(voiceOk ? text.liHint : text.noVoiceNote);
    if (!voiceOk) {
      startGauge();
      return;
    }
    // 指示を1回読み終わってからゲージ開始（別冊04§2.3）
    speak(q).then(() => {
      if (phase === 'ask' && state.current === q) startGauge();
    });
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
      setTileClass(index, 'is-correct');
      if (state.combo === COMBO_PRAISE) emitPraise('combo');
      playMatch();
      showCaption(q);
      say(q.phrase);
      setStatus(isTwo ? `${names[player]}${text.ewGotSuffix}` : text.ewCorrect);
      finishQuestion(result.roundOver);
      return;
    }
    for (const tiles of tileEls) tiles[index].classList.add('is-wrong');
    playFlutter();
    if (isTwo) {
      panels.find((p) => Number(p.dataset.player) === player)?.classList.add('is-locked');
      if (result.bothLocked) {
        for (const p of panels) p.classList.remove('is-locked');
        setTileClass(q.correctIndex, 'is-reveal');
        setStatus(text.ewBothLocked);
        showCaption(q);
        say(q.phrase);
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
      const stats = loadStats();
      stats.lossStreak ??= {};
      stats.lossStreak.listen = a < b ? (stats.lossStreak.listen ?? 0) + 1 : 0;
      saveStats(stats);
    }
    recordPlay('listen', { won: childWon });

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
      else title = winOf(names[winner]);
      detail = `${names[0]} ${a} ／ ${names[1]} ${b}`;
      celebrate = isCpu ? winner === 0 : true;
    }
    showResult(resultOverlay, {
      title,
      detail,
      celebrate,
      signal: abort.signal,
      onReplay: () => {
        playTap();
        restart();
      },
      onHome: () => {
        playTap();
        onExit();
      },
    });
  }

  function restart() {
    clearAllTimers();
    cancelSpeech();
    race?.stop();
    hideResult(resultOverlay);
    resetPraise();
    state = createGame({ difficulty, mode, categories });
    if (isCpu) {
      const extraMs = assistExtraMs(level, loadStats().lossStreak?.listen ?? 0);
      race = createRace({ level, extraMs, onDone: robotTurn });
    }
    phase = 'idle';
    for (const tiles of tileEls) for (const tile of tiles) tile.replaceChildren();
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
    askQuestion();
  }, { signal: abort.signal });

  function goNext() {
    if (phase !== 'done') return;
    playTap();
    askQuestion();
  }
  nextButton.addEventListener('click', goNext, { signal: abort.signal });
  center.addEventListener('click', (event) => {
    if (event.target === speaker) return;
    goNext();
  }, { signal: abort.signal });

  speaker.addEventListener('click', () => {
    if (phase === 'done') {
      goNext();
      return;
    }
    if (phase !== 'ask') return;
    playTap();
    speak(state.current);
  }, { signal: abort.signal });

  for (const panel of panels) {
    panel.addEventListener('pointerdown', (event) => {
      const tile = event.target.closest('.kgb-listen-tile');
      if (!tile || tile.classList.contains('is-wrong')) return;
      handleAnswer(Number(panel.dataset.player), Number(tile.dataset.index));
    }, { signal: abort.signal });
  }

  restart();

  return {
    destroy() {
      clearAllTimers();
      race?.stop();
      cancelSpeech();
      abort.abort();
      root.replaceChildren();
    },
  };
}
