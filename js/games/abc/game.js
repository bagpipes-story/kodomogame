// game.js — ABCタッチの純ロジック（v0.15。別冊04§4）
// モード1「じゅんばんABC」: 散らばった文字をA→B→C…の順にタップ（タイム計測。すうじフラッシュと同じ骨格）
// モード2「はじめのもじ」: 絵の頭文字を3択からえらぶ（quiz.jsの10問クイズ）
// DOM非依存。時刻は引数nowで受け取る（Nodeテストで固定できるように）。

import { WORDS } from '../../words.js';
import { createQuizState, beginQuestion, answer as quizAnswer } from '../../quiz.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// じゅんばんABC: 文字数・大小・盤のマス数（別冊04§4の表）
export const ORDER_LEVELS = {
  easy: { count: 8, lower: false, cols: 4, rows: 3 },
  normal: { count: 16, lower: false, cols: 4, rows: 5 },
  hard: { count: 26, lower: true, cols: 5, rows: 6 },
};

export const MISS_PENALTY_MS = 2000; // まちがえ1回ぶんのタイム加算（当てずっぽう連打を得にしない）
export const INITIAL_QUESTIONS = 10;
export const INITIAL_OPTIONS = 3;

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function lettersFor(difficulty) {
  const def = ORDER_LEVELS[difficulty] ?? ORDER_LEVELS.easy;
  const letters = ALPHABET.slice(0, def.count);
  return (def.lower ? letters.toLowerCase() : letters).split('');
}

// ---------- モード1: じゅんばんABC ----------

// mode: 'solo' / 'two'（こうたい: あかが全部→あおが全部。タイムの短い方が勝ち）
export function createOrderGame({ difficulty = 'easy', mode = 'solo', rng = Math.random } = {}) {
  const def = ORDER_LEVELS[difficulty] ?? ORDER_LEVELS.easy;
  return {
    difficulty,
    mode,
    rng,
    cols: def.cols,
    rows: def.rows,
    letters: lettersFor(difficulty),
    currentPlayer: 0,
    results: [null, null], // { timeMs, misses, scoreMs }
    cards: [],
    nextIndex: 0,
    misses: 0,
    startedAt: 0,
  };
}

// 盤に文字を散らす。cellは行優先のマス番号（cols×rows）
export function dealBoard(state, now) {
  const cells = shuffle([...Array(state.cols * state.rows).keys()], state.rng);
  state.cards = state.letters.map((letter, i) => ({ letter, cell: cells[i] }));
  state.nextIndex = 0;
  state.misses = 0;
  state.startedAt = now;
  return state.cards;
}

export function scoreOf(result) {
  return result.timeMs + result.misses * MISS_PENALTY_MS;
}

// 文字をタップ。正しい順なら進む。全部押せたら done（タイム確定）
export function tapLetter(state, letter, now) {
  if (state.nextIndex >= state.letters.length) return { ok: false };
  const expected = state.letters[state.nextIndex];
  if (letter !== expected) {
    state.misses += 1;
    return { ok: true, correct: false, expected };
  }
  state.nextIndex += 1;
  if (state.nextIndex < state.letters.length) {
    return { ok: true, correct: true, done: false };
  }
  const result = { timeMs: now - state.startedAt, misses: state.misses };
  result.scoreMs = scoreOf(result);
  state.results[state.currentPlayer] = result;
  let roundOver = null;
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    roundOver = { nextPlayer: 1 };
  } else {
    const [a, b] = state.results;
    let winner = null;
    if (state.mode === 'two') winner = a.scoreMs === b.scoreMs ? null : a.scoreMs < b.scoreMs ? 0 : 1;
    roundOver = { winner, results: state.results.slice() };
  }
  return { ok: true, correct: true, done: true, result, roundOver };
}

// ---------- モード2: はじめのもじ ----------

// 選択肢の文字は「どれかの単語の頭文字」から選ぶ（もっともらしい候補にする）
const INITIALS = [...new Set(WORDS.map((w) => w.en[0].toUpperCase()))].sort();

export function buildInitialQuestion(difficulty, { categories, exclude = [], rng = Math.random } = {}) {
  const lower = difficulty === 'hard';
  const cats = categories && categories.length ? categories : null;
  let pool = WORDS.filter((w) => (!cats || cats.includes(w.cat)) && !exclude.includes(w.id));
  if (!pool.length) pool = WORDS.filter((w) => !cats || cats.includes(w.cat));
  const word = pool[Math.floor(rng() * pool.length)];
  const initial = word.en[0].toUpperCase();
  const others = shuffle(INITIALS.filter((c) => c !== initial), rng).slice(0, INITIAL_OPTIONS - 1);
  const letters = shuffle([initial, ...others], rng).map((c) => (lower ? c.toLowerCase() : c));
  const correctLetter = lower ? initial.toLowerCase() : initial;
  return {
    word,
    letter: correctLetter,
    options: letters,
    correctIndex: letters.indexOf(correctLetter),
    lower,
  };
}

// mode: 'solo' / 'two'（こうたい: 1問ごとに あか→あお）
export function createInitialGame({ difficulty = 'easy', mode = 'solo', categories, rng = Math.random } = {}) {
  return {
    ...createQuizState({ mode, questions: INITIAL_QUESTIONS }),
    difficulty,
    categories,
    rng,
    asked: [],
  };
}

// 今の問に答えるプレイヤー（こうたい: 奇数問=あか、偶数問=あお）
export function currentPlayerOf(state) {
  if (state.mode !== 'two') return 0;
  return (state.questionIndex - 1) % 2;
}

export function nextInitialQuestion(state) {
  if (state.questionIndex >= state.questions) return null;
  const remaining = WORDS.filter((w) => (!state.categories || state.categories.includes(w.cat)) && !state.asked.includes(w.id));
  if (!remaining.length) state.asked = [];
  const q = buildInitialQuestion(state.difficulty, { categories: state.categories, exclude: state.asked, rng: state.rng });
  state.asked.push(q.word.id);
  return beginQuestion(state, q); // こうたいなので simultaneous なし（まちがえてもロックしない）
}

export function answerInitial(state, optionIndex) {
  return quizAnswer(state, currentPlayerOf(state), optionIndex);
}
