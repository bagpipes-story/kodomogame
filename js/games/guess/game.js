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
  // v0.19.2: 時間が 0に なった ときに ちょうど すっかり 見えて いる ように、見えて くる 時間を 時間せいげんと 同じに
  // v0.19.4: むずかしいも 時間が 0の とき 9わり だけ 見えて いる（6 ÷ 0.9 ≒ 6.7びょうで 見えきる）
  hard: { revealMs: 6000 / 0.9, strict: true, limitMs: 6000, book: 'hard' },
  // v0.19.3: おとなは もう すこし きびしく、時間が 0の とき 8わり だけ 見えて いる（4 ÷ 0.8 = 5びょうで 見えきる）
  adult: { revealMs: 5000, strict: true, limitMs: 4000, book: 'hard' },
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

// ---------- ずかん画の 出題（v0.19.7。別冊05 §5.1。むずかしい・おとなで ずかん画の ある なかま だけ） ----------
// ずかん画の データは ui.js が わたす（game.js は 絵の ファイルを 読まない＝DOM・import() に よらない）:
// zukan = { ids: [えらべる 種類（なかまを しぼった あと）], allIds: [その なかまの ぜんぶ], levelOf(id),
//           closeOf(id) → { similar: [], group: [], order: [] }（にている・同じ 科・同じ 目）, unseen: Set（まだ ずかんに ない） }

// むずかしいは level 2まで、おとなは ぜんぶ（level 3 = くわしい人むけ）
export const ZUKAN_LEVEL = { hard: 2, adult: 3 };
// 10問の うち、まだ ずかんに ない 種類を この 数まで 先に 入れる（数が ふえても「同じ ものばかり 出て 集まらない」を ふせぐ。
// 運まかせに しない ため、確率では なく 数で きめる）
export const UNSEEN_PER_ROUND = 7;
// 4つの えらぶ ボタンの うち、にている 種類を 2つ 入れる（ミヤマクワガタの 問題に ノコギリ・オオクワガタ など）
export const CLOSE_OPTIONS = 2;

export function zukanPool(zukan, difficulty) {
  const max = ZUKAN_LEVEL[difficulty] ?? 3;
  return zukan.ids.filter((id) => (zukan.levelOf(id) ?? 1) <= max);
}

// 10問の こたえの じゅんばんを はじめに きめる（まだの 子を 先に えらび、あとは のこりから。同じ 子は つづけない）
export function planRound(pool, unseen, rng = Math.random) {
  if (!pool.length) return [];
  const fresh = shuffle(pool.filter((id) => unseen.has(id)), rng).slice(0, UNSEEN_PER_ROUND);
  const picked = [...fresh];
  let rest = shuffle(pool.filter((id) => !fresh.includes(id)), rng);
  while (picked.length < QUESTIONS_PER_ROUND) {
    if (!rest.length) rest = shuffle(pool, rng); // 顔ぶれが 10より すくない ときは もう1しゅう
    picked.push(rest.shift());
  }
  // となりどうしが 同じ 子に ならない ように 1つずつ ならべる。のこりの 数が 多い 子は 先に 入れないと
  // あとで つづいて しまうので、その ときだけ その 子に きめる（顔ぶれが 1つ だけの ときは しかたない）
  const count = new Map();
  for (const id of picked) count.set(id, (count.get(id) ?? 0) + 1);
  const plan = [];
  let last = null;
  for (let left = picked.length; left > 0; left--) {
    let ids = [...count.keys()].filter((id) => count.get(id) > 0 && id !== last);
    if (!ids.length) ids = [last];
    const forced = ids.find((id) => count.get(id) > Math.ceil((left - 1) / 2));
    const id = forced ?? ids[Math.floor(rng() * ids.length)];
    plan.push(id);
    count.set(id, count.get(id) - 1);
    last = id;
  }
  return plan;
}

// えらぶ ボタンの 4つ: こたえ＋にている 種類 2つ（にている → 同じ 科 → 同じ 目 の じゅん）＋ ほかから 1つ
export function zukanOptions(answer, zukan, pool, rng = Math.random) {
  const inPool = new Set(pool);
  const close = zukan.closeOf(answer);
  const chosen = [];
  for (const tier of [close.similar, close.group, close.order]) {
    for (const id of shuffle(tier ?? [], rng)) {
      if (chosen.length >= CLOSE_OPTIONS) break;
      if (id !== answer && inPool.has(id) && !chosen.includes(id)) chosen.push(id);
    }
  }
  const fill = (list) => {
    for (const id of shuffle(list, rng)) {
      if (chosen.length >= OPTIONS - 1) break;
      if (id !== answer && !chosen.includes(id)) chosen.push(id);
    }
  };
  fill(pool);
  fill(zukan.allIds ?? []); // しぼった なかまが 4つ より すくない とき
  return shuffle([answer, ...chosen], rng);
}

export function createGame({ set = 'sea', difficulty = 'easy', rng = Math.random, zukan = null } = {}) {
  const safeSet = GUESS_SETS.includes(set) ? set : 'sea';
  const safeDifficulty = Object.prototype.hasOwnProperty.call(DIFFICULTY, difficulty) ? difficulty : 'easy';
  // ずかん画の 出題は しょうぶ（むずかしい・おとな）だけ
  const useZukan = !!zukan && DIFFICULTY[safeDifficulty].strict;
  const pool = useZukan ? zukanPool(zukan, safeDifficulty) : null;
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
    zukan: useZukan ? zukan : null,
    pool,
    plan: useZukan ? planRound(pool, zukan.unseen ?? new Set(), rng) : null,
  };
}

export function nextQuestion(state) {
  if (state.questionIndex >= QUESTIONS_PER_ROUND) return null;
  if (state.plan?.length) {
    const answerId = state.plan[state.questionIndex];
    state.asked.push(answerId);
    const options = zukanOptions(answerId, state.zukan, state.pool, state.rng);
    return beginQuestion(state, { answer: answerId, options, correctIndex: options.indexOf(answerId) });
  }
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
