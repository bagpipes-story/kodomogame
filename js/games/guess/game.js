// game.js — なまえあての純ロジック（v0.18。v0.18.1 で しょうぶ・ずかん）
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
// strict = しょうぶ（v0.18.1。むずかしい いじょう）: まちがえたら その問題は おわり（えらびなおせない）・時間せいげん limitMs・
//          正解すると ずかんに のる。かんたん・ふつうは 小さい 子むけに えらびなおせて 時間ぎれも ない
// book = どちらの ずかんに のるか（v0.19.1）。かんたん・ふつうは バランスゲームと 同じ つみきの 絵で 'easy' の ずかん、
//        むずかしい・おとなは ずかん画（別冊05）で 'hard' の ずかん。絵が ちがうので ずかんも わける
export const DIFFICULTY = {
  easy: { revealMs: 8000, strict: false, limitMs: null, book: 'easy' },
  normal: { revealMs: 10000, strict: false, limitMs: null, book: 'easy' },
  // v0.18.2: 時間せいげんを 12→8びょう・10→6びょう、見えて くる はやさも はやく。
  // v0.18.4: 8・6びょうでは かんたん すぎたので 5・3びょうに。見えて くる はやさは そのまま
  //          （時間ぎれの とき むずかしいは 5わり・おとなは 4わりしか 見えて いない）
  // v0.19.1: ずかん画は つみきより こまかく 見分けに 時間が かかるので 6・4びょうに
  hard: { revealMs: 9000, strict: true, limitMs: 6000, book: 'hard' },
  adult: { revealMs: 7500, strict: true, limitMs: 4000, book: 'hard' },
};

// ずかんの 保存先（stats.guess の キー）。'hard' は v0.18.1 からの 'zukan' を そのまま つかう
// （いままでの 記録は しょうぶで あつめた もの なので むずかしい・おとなの ずかんに のこす）
export const ZUKAN_KEYS = { easy: 'zukanEasy', hard: 'zukan' };
export function bookOf(difficulty) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY, difficulty) ? DIFFICULTY[difficulty].book : 'easy';
}

// この わりあいより 前に あてたら「はやわかり」（ほめ）。
// 見えきる 時間と 時間せいげんの みじかい ほうの 6わり（v0.18.4: しょうぶで ぜんぶ はやわかりに ならない ように）
export const EARLY_RATIO = 0.6;
export function earlyLimitMs(state) {
  return Math.min(state.revealMs, state.limitMs ?? Infinity) * EARLY_RATIO;
}

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
    strict: DIFFICULTY[safeDifficulty].strict,
    limitMs: DIFFICULTY[safeDifficulty].limitMs,
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

function roundOverOf(state) {
  return state.questionIndex >= QUESTIONS_PER_ROUND ? { scores: state.scores.slice(), winner: null } : null;
}

// 子どもの 回答。elapsedMs = 見えはじめて からの 時間（はやわかりの 判定に つかう）
// しょうぶ（strict）では まちがえたら その問題は おわり（final: true。正解を 見せて つぎへ）
export function answerAt(state, optionIndex, elapsedMs) {
  const q = state.current;
  const result = quizAnswer(state, 0, optionIndex);
  if (result.ok && !result.correct && state.strict) {
    q.done = true;
    return { ...result, early: false, final: true, roundOver: roundOverOf(state) };
  }
  if (!result.ok || !result.correct) return { ...result, early: false };
  const firstTry = q.wrong.size === 0;
  const early = firstTry && elapsedMs < earlyLimitMs(state);
  if (early) state.early += 1;
  // collect = ずかんに のせる（v0.19.1）: 1かいめで あてた とき。しょうぶは まちがえると おわるので 正解なら いつも
  return { ...result, early, collect: firstTry };
}

// 時間ぎれ（しょうぶの とき）。その問題は 正解なしで おわり
export function timeUp(state) {
  const q = state.current;
  if (!q || q.done || !state.limitMs) return { ok: false };
  q.done = true;
  q.timedOut = true;
  state.combo = 0;
  return { ok: true, roundOver: roundOverOf(state) };
}

// ---------- ずかん（v0.18.1）: 正解した 子を なかまごとに あつめる ----------
// zukan = { sea: ['whale', ...], ... }（保存は ui.js が storage.js 経由で 正解の ときだけ）
// v0.19.1: ずかんは 2さつ（ZUKAN_KEYS）。all = その ずかんの ぜんぶ（ずかん画の なかまは ずかん画の しゅるい。なければ zukanAll）

// その なかまの ぜんぶ（ずかんの ページ。バランスゲームの おとなの 顔ぶれ）
export function zukanAll(set) {
  return poolOf(set, 'adult');
}

// 正解した 子を ずかんに 入れる。もとの ずかんは かえずに 新しい ずかんを かえす
export function addToZukan(zukan, set, id, all = zukanAll(set)) {
  const found = Array.isArray(zukan?.[set]) ? zukan[set].filter((x) => all.includes(x)) : [];
  if (!all.includes(id) || found.includes(id)) return { zukan: { ...zukan, [set]: found }, isNew: false };
  const next = { ...zukan, [set]: [...found, id] };
  return { zukan: next, isNew: true, complete: next[set].length === all.length };
}

export function zukanProgress(zukan, set, all = zukanAll(set)) {
  const found = Array.isArray(zukan?.[set]) ? zukan[set].filter((x) => all.includes(x)) : [];
  return { found: new Set(found).size, total: all.length };
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
