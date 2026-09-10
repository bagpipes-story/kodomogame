// ui.js — ABCタッチの描画・入力（v0.15。別冊04§4）
// モード1「じゅんばんABC」: 散らばった文字をA→B→C…の順にタップ（すうじフラッシュと同じ骨格。
//   カードは26枚を最初に作り、以後はテキスト・class・配置スタイルの差分更新のみ）
// モード2「はじめのもじ」: 絵の頭文字を3択（えいごカードあてと同じ「つぎ！」タップ起点の音声）
// どちらもタップごとに文字名を読み上げる（小文字で渡す: iOSが「capital A」と読むのを避ける）

import {
  ORDER_LEVELS,
  INITIAL_QUESTIONS,
  INITIAL_OPTIONS,
  createOrderGame,
  dealBoard,
  tapLetter,
  createInitialGame,
  currentPlayerOf,
  nextInitialQuestion,
  answerInitial,
} from './game.js';
import { text } from '../../i18n.js';
import { getNames, turnOf, winOf } from '../../players.js';
import { playTap, playPlace, playMatch, playFlutter } from '../../sound.js';
import { loadStats, saveStats, loadSettings } from '../../storage.js';
import { createWordVisual } from '../../wordart.js';
import { say, cancelSpeech } from '../../speech.js';
import { resetPraise, emitPraise, recordPlay } from '../../praise.js';
import { showResult, hideResult } from '../../resultView.js';

const MAX_LETTERS = 26;
const WRONG_SHAKE_MS = 450;
const DONE_WAIT_MS = 900;
const CORRECT_WAIT_MS = 700;
const ROUND_END_MS = 1200;

function formatSec(ms) {
  return (ms / 1000).toFixed(1);
}

export function mount(root, config, { onExit }) {
  return config.game === 'initial' ? mountInitial(root, config, { onExit }) : mountOrder(root, config, { onExit });
}

// ================= モード1: じゅんばんABC =================

function mountOrder(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();
  const isTwoMode = config.mode === 'two';
  const difficulty = ORDER_LEVELS[config.difficulty] ? config.difficulty : 'easy';
  const names = getNames(config.mode, [text.redName, text.blueName]);

  let state = null;
  let phase = 'idle'; // idle | play | wait

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

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-abc';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const statusEl = document.createElement('p');
  statusEl.className = 'kgb-abc-status';

  const board = document.createElement('div');
  board.className = `kgb-abc-board is-cols-${ORDER_LEVELS[difficulty].cols}`;
  const cardEls = [];
  {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < MAX_LETTERS; i++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kgb-abc-card';
      card.hidden = true;
      fragment.append(card);
      cardEls.push(card);
    }
    board.append(fragment);
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

  container.append(banner, statusEl, board);
  root.append(container, startOverlay, resultOverlay);

  function updateBanner() {
    const first = state.letters[0];
    const last = state.letters[state.letters.length - 1];
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${first} → ${last}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = `${first} → ${last}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function renderBoard() {
    for (const card of cardEls) card.hidden = true;
    state.cards.forEach(({ letter, cell }, i) => {
      const card = cardEls[i];
      card.hidden = false;
      card.className = 'kgb-abc-card';
      card.textContent = letter;
      card.dataset.letter = letter;
      card.style.gridColumn = (cell % state.cols) + 1;
      card.style.gridRow = Math.floor(cell / state.cols) + 1;
    });
  }

  function showStartOverlay() {
    startTitle.textContent = isTwoMode ? names[state.currentPlayer] + text.turnSuffix : text.readyTitle;
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    if (phase !== 'idle') return;
    playTap();
    startOverlay.hidden = true;
    dealBoard(state, performance.now()); // ここからタイム計測
    updateBanner();
    renderBoard();
    setStatus(`${state.letters[0]}${text.abcStartSuffix}`);
    phase = 'play';
  }, { signal: abort.signal });

  board.addEventListener('click', (event) => {
    if (phase !== 'play') return;
    const card = event.target.closest('.kgb-abc-card');
    if (!card || card.hidden || card.classList.contains('is-done')) return;
    const letter = card.dataset.letter;
    const result = tapLetter(state, letter, performance.now());
    if (!result.ok) return;
    if (!result.correct) {
      playFlutter();
      card.classList.add('is-wrong');
      later(() => card.classList.remove('is-wrong'), WRONG_SHAKE_MS);
      setStatus(`${text.abcOops}${result.expected}`);
      return;
    }
    card.classList.add('is-done');
    playPlace();
    say(letter.toLowerCase()); // タップ内なのでiOSでも鳴る
    if (!result.done) {
      setStatus(`${text.abcNextPrefix}${state.letters[state.nextIndex]}`);
      return;
    }
    phase = 'wait';
    playMatch();
    setStatus(`${text.abcAllDone}　${formatSec(result.result.timeMs)}${text.rcSecSuffix}`);
    const over = result.roundOver;
    if (over.nextPlayer !== undefined) {
      later(() => {
        phase = 'idle';
        updateBanner();
        showStartOverlay();
      }, DONE_WAIT_MS);
    } else {
      later(() => finishGame(over), DONE_WAIT_MS);
    }
  }, { signal: abort.signal });

  function finishGame(over) {
    emitPraise('finished_game');
    const [a, b] = over.results;
    if (over.results.every((r) => r && r.misses === 0)) emitPraise('perfect_first_try');

    let title;
    let detail;
    let celebrate = false;
    if (isTwoMode) {
      title = over.winner === null ? text.draw : winOf(names[over.winner]);
      detail = `${names[0]} ${formatSec(a.scoreMs)}${text.rcSecSuffix} ／ ${names[1]} ${formatSec(b.scoreMs)}${text.rcSecSuffix}`;
      celebrate = true;
    } else {
      // ひとり: むずかしさ別のベストタイム（ミス加算込み）を保存
      const stats = loadStats();
      stats.abc ??= { bestBy: {}, plays: 0 };
      stats.abc.bestBy ??= {};
      const prev = stats.abc.bestBy[difficulty];
      const isNewRecord = prev === undefined || a.scoreMs < prev;
      if (isNewRecord) {
        stats.abc.bestBy[difficulty] = a.scoreMs;
        saveStats(stats);
        emitPraise('new_record');
      }
      // タイトルも記録も「タイム＋まちがえ加算」でそろえる（表示と記録がずれないように）
      title = `${formatSec(a.scoreMs)}${text.abcResultSuffix}`;
      detail = `${text.abcMissLabel}: ${a.misses}${text.abcMissSuffix}`;
      if (a.misses > 0) detail += `（＋${formatSec(a.scoreMs - a.timeMs)}${text.rcSecSuffix}）`;
      detail += `　${text.bestLabel}: ${formatSec(stats.abc.bestBy[difficulty])}${text.rcSecSuffix}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      celebrate = isNewRecord || a.misses === 0;
    }
    recordPlay('abc', { won: false });
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
    hideResult(resultOverlay);
    resetPraise();
    state = createOrderGame({ difficulty, mode: config.mode });
    phase = 'idle';
    for (const card of cardEls) card.hidden = true;
    setStatus('');
    updateBanner();
    showStartOverlay();
  }

  restart();

  return {
    destroy() {
      clearAllTimers();
      cancelSpeech();
      abort.abort();
      root.replaceChildren();
    },
  };
}

// ================= モード2: はじめのもじ =================

function mountInitial(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();
  const isTwoMode = config.mode === 'two';
  const difficulty = ['easy', 'normal', 'hard'].includes(config.difficulty) ? config.difficulty : 'easy';
  const categories = config.category && config.category !== 'all'
    ? [config.category]
    : loadSettings().wordCategories;
  const names = getNames(config.mode, [text.redName, text.blueName]);

  let state = null;
  let phase = 'idle'; // idle | ask | done | result

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

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-abc kgb-abc-initial';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const picture = document.createElement('div');
  picture.className = 'kgb-abc-picture';
  const caption = document.createElement('p');
  caption.className = 'kgb-abc-caption';

  const choices = document.createElement('div');
  choices.className = 'kgb-abc-choices';
  const choiceEls = [];
  for (let i = 0; i < INITIAL_OPTIONS; i++) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'kgb-abc-card kgb-abc-choice';
    card.dataset.index = i;
    choices.append(card);
    choiceEls.push(card);
  }

  const statusEl = document.createElement('p');
  statusEl.className = 'kgb-abc-status';

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
  startTitle.textContent = text.abcInitialHint;
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
  startSub.textContent = text.handoverTap;
  startOverlay.append(startTitle, startSub);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, picture, caption, choices, statusEl, nextButton);
  root.append(container, startOverlay, resultOverlay);

  function updateBanner() {
    const counter = `${state.questionIndex} / ${INITIAL_QUESTIONS}${text.ewQuestionSuffix}`;
    if (isTwoMode) {
      const p = currentPlayerOf(state);
      banner.textContent = `${names[p]}${text.turnSuffix}　${names[0]} ${state.scores[0]} ／ ${names[1]} ${state.scores[1]}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${p}`;
    } else {
      banner.textContent = `${counter}　${text.ewCorrectLabel} ${state.scores[0]}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  // タップ起点で呼ぶこと（iOSの読み上げ制約）
  function askQuestion() {
    const q = nextInitialQuestion(state);
    if (!q) return;
    phase = 'ask';
    picture.replaceChildren(createWordVisual(q.word));
    picture.classList.remove('is-pop');
    caption.textContent = '';
    caption.classList.remove('is-on');
    q.options.forEach((letter, i) => {
      choiceEls[i].textContent = letter;
      choiceEls[i].className = 'kgb-abc-card kgb-abc-choice';
    });
    nextButton.hidden = true;
    updateBanner();
    setStatus(text.abcInitialHint);
    say(q.word.en);
  }

  function finishQuestion(roundOver) {
    phase = 'done';
    updateBanner();
    if (roundOver) {
      later(() => finishGame(roundOver), ROUND_END_MS);
      return;
    }
    later(() => {
      nextButton.hidden = false;
    }, CORRECT_WAIT_MS);
  }

  choices.addEventListener('click', (event) => {
    if (phase !== 'ask') return;
    const card = event.target.closest('.kgb-abc-choice');
    if (!card || card.classList.contains('is-wrong')) return;
    const q = state.current;
    const index = Number(card.dataset.index);
    const result = answerInitial(state, index);
    if (!result.ok) return;
    if (result.correct) {
      card.classList.add('is-done');
      playMatch();
      picture.classList.add('is-pop');
      caption.textContent = `${q.word.en} → ${q.letter}　${q.word.ja}`;
      caption.classList.add('is-on');
      setStatus(text.ewCorrect);
      // 「apple. A!」: 単語→文字名の順に読む（文字は小文字で渡す）
      say(q.word.en).then(() => say(q.letter.toLowerCase()));
      finishQuestion(result.roundOver);
      return;
    }
    card.classList.add('is-wrong');
    playFlutter();
    setStatus(text.ewWrong);
  }, { signal: abort.signal });

  function finishGame(over) {
    phase = 'result';
    emitPraise('finished_game');
    const [a, b] = over.scores;
    if (!isTwoMode && state.firstTryCorrect === INITIAL_QUESTIONS) emitPraise('perfect_first_try');
    recordPlay('abc', { won: false });

    let title;
    let detail;
    let celebrate;
    if (isTwoMode) {
      title = over.winner === null ? text.draw : winOf(names[over.winner]);
      detail = `${names[0]} ${a} ／ ${names[1]} ${b}`;
      celebrate = true;
    } else {
      title = `${INITIAL_QUESTIONS}${text.ewResultMid}${a}${text.ewResultSuffix}`;
      detail = text.playAgainTone;
      celebrate = a >= INITIAL_QUESTIONS;
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
    hideResult(resultOverlay);
    resetPraise();
    state = createInitialGame({ difficulty, mode: config.mode, categories });
    phase = 'idle';
    picture.replaceChildren();
    caption.textContent = '';
    caption.classList.remove('is-on');
    for (const card of choiceEls) card.textContent = '';
    nextButton.hidden = true;
    setStatus('');
    updateBanner();
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    if (phase !== 'idle') return;
    playTap();
    startOverlay.hidden = true;
    askQuestion();
  }, { signal: abort.signal });

  nextButton.addEventListener('click', () => {
    if (phase !== 'done') return;
    playTap();
    askQuestion();
  }, { signal: abort.signal });

  // 絵をタップで聞き直し
  picture.addEventListener('click', () => {
    if (phase !== 'ask') return;
    playTap();
    say(state.current.word.en);
  }, { signal: abort.signal });

  restart();

  return {
    destroy() {
      clearAllTimers();
      cancelSpeech();
      abort.abort();
      root.replaceChildren();
    },
  };
}
