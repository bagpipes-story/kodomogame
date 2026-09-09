// game.js — えいごカードあての純ロジック（v0.14。別冊04§3）
// DOM非依存。出題（正解語＋ダミー語の選び方）・回答判定・10問ラウンドの進行だけを持つ。
// 音声・ロボくんゲージ・演出はui.js側（speech.js / race.js を使う）。

import { WORDS, CATEGORIES } from '../../words.js';
import { createQuizState, beginQuestion, addListen, answer, robotAnswer } from '../../quiz.js';

export const QUESTIONS_PER_ROUND = 10;

// 難易度（別冊04§3の表）
//   options: 選択肢の枚数 / autoPlays: 出題時に自動で鳴る回数 / speaker: スピーカーボタンの有無
//   distractor: ダミーの選び方 'other'=別カテゴリ・頭文字違い / 'same'=同カテゴリ / 'initial'=同カテゴリ＋同じ頭文字を優先
export const DIFFICULTY = {
  easy: { options: 3, autoPlays: 2, speaker: false, distractor: 'other' },
  normal: { options: 4, autoPlays: 1, speaker: true, distractor: 'same' },
  hard: { options: 6, autoPlays: 0, speaker: true, distractor: 'initial' },
};

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 出題カテゴリの正規化: 空や不正な指定は全カテゴリ扱い（設定が壊れていても遊べるように）
export function normalizeCategories(categories) {
  const valid = (categories ?? []).filter((c) => CATEGORIES.includes(c));
  return valid.length ? valid : CATEGORIES.slice();
}

// ダミー語を優先度つきで選ぶ。足りない段階は次の候補群で埋める（語彙が少ないカテゴリでも成立させる）
function pickDistractors(answer, pool, count, mode, rng) {
  const others = pool.filter((w) => w.id !== answer.id);
  const initial = answer.en[0];
  let tiers;
  if (mode === 'other') {
    tiers = [
      others.filter((w) => w.cat !== answer.cat && w.en[0] !== initial),
      others.filter((w) => w.en[0] !== initial),
      others,
    ];
  } else if (mode === 'initial') {
    tiers = [
      others.filter((w) => w.cat === answer.cat && w.en[0] === initial),
      others.filter((w) => w.cat === answer.cat),
      others,
    ];
  } else {
    tiers = [others.filter((w) => w.cat === answer.cat), others];
  }
  const chosen = [];
  const used = new Set();
  for (const tier of tiers) {
    for (const w of shuffle(tier, rng)) {
      if (chosen.length >= count) break;
      if (used.has(w.id)) continue;
      used.add(w.id);
      chosen.push(w);
    }
    if (chosen.length >= count) break;
  }
  return chosen;
}

// 1問ぶんを作る。answerは出題カテゴリから、ダミーは全語彙から難易度ルールで選ぶ
export function buildQuestion(difficulty, { categories, exclude = [], rng = Math.random } = {}) {
  const settings = DIFFICULTY[difficulty] ?? DIFFICULTY.easy;
  const cats = normalizeCategories(categories);
  let answerPool = WORDS.filter((w) => cats.includes(w.cat) && !exclude.includes(w.id));
  if (!answerPool.length) answerPool = WORDS.filter((w) => cats.includes(w.cat));
  const answer = answerPool[Math.floor(rng() * answerPool.length)];
  const distractors = pickDistractors(answer, WORDS, settings.options - 1, settings.distractor, rng);
  const options = shuffle([answer, ...distractors], rng);
  return {
    answer,
    options,
    correctIndex: options.findIndex((w) => w.id === answer.id),
  };
}

// mode: 'solo'（ひとり）/ 'cpu'（ロボくんと早押し）/ 'two'（ふたり同時）
// 得点・ロック・ロボくんの回答は quiz.js の共通処理（answer / robotAnswer / addListen を再輸出）
export function createGame({ difficulty = 'easy', mode = 'solo', categories, rng = Math.random } = {}) {
  return {
    ...createQuizState({ mode, questions: QUESTIONS_PER_ROUND }),
    difficulty,
    categories: normalizeCategories(categories),
    rng,
    asked: [],             // このラウンドで出た語id（重複出題を避ける）
  };
}

export function nextQuestion(state) {
  if (state.questionIndex >= QUESTIONS_PER_ROUND) return null;
  // 語彙が10語未満のカテゴリでも回るよう、出し尽くしたら除外を解除
  const cats = state.categories;
  const remaining = WORDS.filter((w) => cats.includes(w.cat) && !state.asked.includes(w.id));
  if (!remaining.length) state.asked = [];
  const q = buildQuestion(state.difficulty, { categories: cats, exclude: state.asked, rng: state.rng });
  state.asked.push(q.answer.id);
  // simultaneous: ふたりモードは同時押し（まちがえた側をロック）
  return beginQuestion(state, { ...q, simultaneous: true });
}

export { addListen, answer, robotAnswer };
