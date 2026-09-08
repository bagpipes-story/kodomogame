// game.js — えいごカードあての純ロジック（v0.14。別冊04§3）
// DOM非依存。出題（正解語＋ダミー語の選び方）・回答判定・10問ラウンドの進行だけを持つ。
// 音声・ロボくんゲージ・演出はui.js側（speech.js / race.js を使う）。

import { WORDS, CATEGORIES } from '../../words.js';

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
// scores[0]=あなた（あか）, scores[1]=ロボくん（あお）
export function createGame({ difficulty = 'easy', mode = 'solo', categories, rng = Math.random } = {}) {
  return {
    difficulty,
    mode,
    categories: normalizeCategories(categories),
    rng,
    questionIndex: 0,      // 出題済みの数（1問目を出すと1）
    asked: [],             // このラウンドで出た語id（重複出題を避ける）
    scores: [0, 0],
    current: null,         // { answer, options, correctIndex, done, locked:[bool,bool], wrong:Set, listens, robotMissed }
    firstTryCorrect: 0,    // 間違えずに正解した問数（ひとり用の記録）
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
  state.questionIndex += 1;
  state.current = {
    ...q,
    done: false,
    winner: null,          // 正解した側 0/1、だれも取れなければnull
    locked: [false, false],
    wrong: new Set(),      // 灰色にした選択肢index
    listens: 0,
    robotMissed: false,
  };
  return state.current;
}

export function addListen(state) {
  if (state.current) state.current.listens += 1;
}

// 子ども（ふたりモードでは各プレイヤー）の回答
export function answer(state, player, optionIndex) {
  const q = state.current;
  if (!q || q.done) return { ok: false };
  if (q.locked[player]) return { ok: false };
  if (optionIndex === q.correctIndex) {
    q.done = true;
    q.winner = player;
    state.scores[player] += 1;
    if (q.wrong.size === 0) state.firstTryCorrect += 1;
    return { ok: true, correct: true, roundOver: roundOverIfDone(state) };
  }
  q.wrong.add(optionIndex);
  if (state.mode === 'two') {
    // ふたり同時: まちがえた側はこの問だけロック。両方ロックなら正解を見せて次へ
    q.locked[player] = true;
    if (q.locked[0] && q.locked[1]) {
      q.done = true;
      return { ok: true, correct: false, bothLocked: true, roundOver: roundOverIfDone(state) };
    }
  }
  return { ok: true, correct: false };
}

// ロボくんの回答（cpuモード）。choiceはrace.jsのrobotChoiceで決めた選択肢
export function robotAnswer(state, choice) {
  const q = state.current;
  if (!q || q.done) return { ok: false };
  if (choice === q.correctIndex) {
    q.done = true;
    q.winner = 1;
    state.scores[1] += 1;
    return { ok: true, correct: true, roundOver: roundOverIfDone(state) };
  }
  // 外したら次は必ず当てる（「あれれ？」→考え直し。子どもにもう一度チャンス）
  q.robotMissed = true;
  return { ok: true, correct: false };
}

function roundOverIfDone(state) {
  if (state.questionIndex < QUESTIONS_PER_ROUND) return null;
  const [a, b] = state.scores;
  let winner = null;
  if (state.mode !== 'solo') winner = a === b ? null : a > b ? 0 : 1;
  return { scores: state.scores.slice(), winner };
}
