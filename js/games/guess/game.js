// game.js — なまえあての純ロジック（v0.18）
// バランスゲームの いきもの・地図の つみき（図形いがい）の 絵を つかって、黒い かげから 名前を 4つから えらぶ。
// DOM非依存（Nodeテスト可能）。出題・回答判定・10問ラウンド・「見えて くる」ぐあいの 計算だけを 持つ。
// 絵の 描画・モザイク・音声は ui.js。

import { BLOCK_SETS } from '../balance/game.js';
import { createQuizState, beginQuestion, answer as quizAnswer } from '../../quiz.js';

export const QUESTIONS_PER_ROUND = 10;
export const OPTIONS = 4; // 4たく

// えらべる なかま（バランスゲームの つみきの うち 図形いがい。メニューの じゅん）
export const GUESS_SETS = ['sea', 'animal', 'bird', 'fresh', 'insect', 'deep', 'dino', 'pref', 'world'];

// むずかしさ: 出る 顔ぶれは バランスゲームと 同じ（かんたん=よく 知られた 子 → おとな=ぜんぶ）。
// revealMs = 黒い かげが すっかり 見える までの 時間。むずかしいほど ゆっくり 見えて くる
export const DIFFICULTY = {
  easy: { revealMs: 8000 },
  normal: { revealMs: 10000 },
  hard: { revealMs: 12000 },
  adult: { revealMs: 15000 },
};

// この わりあいより 前に あてたら「はやわかり」（モザイクが サーっと とける 演出・ほめ）
export const EARLY_RATIO = 0.6;

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 出題の 顔ぶれ（へんな 指定は うみ・かんたん）
export function poolOf(set, difficulty) {
  const table = Object.prototype.hasOwnProperty.call(BLOCK_SETS, set) && GUESS_SETS.includes(set) ? BLOCK_SETS[set] : BLOCK_SETS.sea;
  return Object.prototype.hasOwnProperty.call(table, difficulty) ? table[difficulty] : table.easy;
}

export function createGame({ set = 'sea', difficulty = 'easy', rng = Math.random } = {}) {
  const safeSet = GUESS_SETS.includes(set) ? set : 'sea';
  const safeDifficulty = Object.prototype.hasOwnProperty.call(DIFFICULTY, difficulty) ? difficulty : 'easy';
  return {
    ...createQuizState({ mode: 'solo', questions: QUESTIONS_PER_ROUND }),
    set: safeSet,
    difficulty: safeDifficulty,
    revealMs: DIFFICULTY[safeDifficulty].revealMs,
    rng,
    asked: [],  // この ラウンドで 出た id（10問の 中で かさならない ように。顔ぶれが 10より 少なければ 出しきってから もう1しゅう）
    early: 0,   // はやわかりの かず
  };
}

export function nextQuestion(state) {
  if (state.questionIndex >= QUESTIONS_PER_ROUND) return null;
  const pool = poolOf(state.set, state.difficulty);
  let remaining = pool.filter((id) => !state.asked.includes(id));
  if (!remaining.length) {
    // 出しきったら もう1しゅう（ただし さっきと 同じ 子が つづけて 出ない ように）
    const last = state.asked[state.asked.length - 1];
    state.asked = [];
    remaining = pool.filter((id) => id !== last);
  }
  const answerId = remaining[Math.floor(state.rng() * remaining.length)];
  state.asked.push(answerId);
  // ほかの 3つは 同じ 顔ぶれから（足りなければ その なかまの ぜんぶから）
  let others = pool.filter((id) => id !== answerId);
  if (others.length < OPTIONS - 1) others = poolOf(state.set, 'adult').filter((id) => id !== answerId);
  const options = shuffle([answerId, ...shuffle(others, state.rng).slice(0, OPTIONS - 1)], state.rng);
  return beginQuestion(state, { answer: answerId, options, correctIndex: options.indexOf(answerId) });
}

// 子どもの 回答。elapsedMs = 見えはじめて からの 時間（はやわかりの 判定に つかう）
export function answerAt(state, optionIndex, elapsedMs) {
  const q = state.current;
  const result = quizAnswer(state, 0, optionIndex);
  if (!result.ok || !result.correct) return { ...result, early: false };
  const early = q.wrong.size === 0 && elapsedMs < state.revealMs * EARLY_RATIO;
  if (early) state.early += 1;
  return { ...result, early };
}

// どれくらい 見えたか（0=まっくろ、1=すっかり 見えた）
export function revealProgress(elapsedMs, revealMs) {
  if (!(revealMs > 0)) return 1;
  return Math.min(1, Math.max(0, elapsedMs / revealMs));
}

// かげを こまかい マスに わけて、マスごとに 見えはじめる じこく（0〜1）を きめる。
// ばらばらに しつつ、時間に そって だいたい 同じ はやさで 見えて いく ように 間を あけて ならべる
export function tileRevealTimes(count, rng = Math.random) {
  const times = [];
  for (let i = 0; i < count; i++) times.push(0.04 + ((i + rng()) / count) * 0.84);
  return shuffle(times, rng);
}

// モザイクの ます目の 大きさ（px）。はじめは あらく、見えて いくほど こまかく、さいごは もとの 絵（1）
export const MOSAIC_MAX = 14;
export function mosaicSize(progress) {
  const p = Math.min(1, Math.max(0, progress));
  return Math.max(1, Math.round(MOSAIC_MAX * (1 - p) ** 1.6));
}
