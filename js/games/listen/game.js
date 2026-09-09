// game.js — きいてタッチの純ロジック（v0.15。別冊04§5）
// 英語の指示を聞いて4枚の絵から正しいものをタップ。出題は素材を増やさずプログラムで生成する:
//   かんたん: 単語1語（"apple"） / ふつう: 色×形（"Touch the red star."）
//   むずかしい: 数×どうぶつ（"Touch three cats."）・大小（"Touch the big dog."）
// 得点・ロック・ロボくんは quiz.js。DOM非依存。

import { WORDS, CATEGORIES, wordsByCategory } from '../../words.js';
import { createQuizState, beginQuestion, addListen, answer, robotAnswer } from '../../quiz.js';

export const OPTION_COUNT = 4;
export const QUESTIONS_PER_ROUND = 10;
export const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five'];
export const MAX_COUNT = 5;

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

// 選択肢1枚（item）の同一判定キー
export function itemKey(item) {
  return [item.word.id, item.color?.id ?? '', item.count ?? '', item.size ?? ''].join('|');
}

function plural(word, n) {
  return n === 1 ? word.en : `${word.en}s`; // どうぶつ8語はすべて規則変化
}

// ---------- 難易度ごとの出題 ----------

function buildWordQuestion(categories, exclude, rng) {
  let pool = WORDS.filter((w) => categories.includes(w.cat) && !exclude.includes(w.id));
  if (!pool.length) pool = WORDS.filter((w) => categories.includes(w.cat));
  const word = pick(pool, rng);
  // ダミーは同カテゴリを優先（足りなければ全語彙）
  const same = shuffle(WORDS.filter((w) => w.cat === word.cat && w.id !== word.id), rng);
  const others = shuffle(WORDS.filter((w) => w.cat !== word.cat), rng);
  const dummies = [...same, ...others].slice(0, OPTION_COUNT - 1);
  return {
    kind: 'word',
    key: word.id,
    phrase: word.en,
    label: word.en,
    ja: word.ja,
    items: [{ word }, ...dummies.map((w) => ({ word: w }))],
  };
}

// しろは白いカードに描けないので除外
const COLORS = () => wordsByCategory('color').filter((c) => c.id !== 'white');
const SHAPES = () => wordsByCategory('shape');
const ANIMALS = () => wordsByCategory('animal');

function buildColorShapeQuestion(exclude, rng) {
  const colors = COLORS();
  const shapes = SHAPES();
  let color = pick(colors, rng);
  let shape = pick(shapes, rng);
  for (let i = 0; i < 20 && exclude.includes(`${color.id}|${shape.id}`); i++) {
    color = pick(colors, rng);
    shape = pick(shapes, rng);
  }
  const otherColors = shuffle(colors.filter((c) => c.id !== color.id), rng);
  const otherShapes = shuffle(shapes.filter((s) => s.id !== shape.id), rng);
  // ダミー: 同じ色で別の形／別の色で同じ形／両方ちがう（色だけ・形だけ聞き取っても迷う構成）
  const items = [
    { word: shape, color },
    { word: otherShapes[0], color },
    { word: shape, color: otherColors[0] },
    { word: otherShapes[1], color: otherColors[1] },
  ];
  return {
    kind: 'colorShape',
    key: `${color.id}|${shape.id}`,
    phrase: `Touch the ${color.en} ${shape.en}.`,
    label: `${color.en} ${shape.en}`,
    ja: `${color.ja}の ${shape.ja}`,
    items,
  };
}

function buildCountQuestion(exclude, rng) {
  const animals = ANIMALS();
  let animal = pick(animals, rng);
  let n = 1 + Math.floor(rng() * MAX_COUNT);
  for (let i = 0; i < 20 && exclude.includes(`${animal.id}|${n}`); i++) {
    animal = pick(animals, rng);
    n = 1 + Math.floor(rng() * MAX_COUNT);
  }
  const otherCounts = shuffle([1, 2, 3, 4, 5].filter((k) => k !== n), rng);
  const otherAnimal = pick(animals.filter((a) => a.id !== animal.id), rng);
  const items = [
    { word: animal, count: n },
    { word: animal, count: otherCounts[0] },
    { word: animal, count: otherCounts[1] },
    { word: otherAnimal, count: n },
  ];
  return {
    kind: 'count',
    key: `${animal.id}|${n}`,
    phrase: `Touch ${COUNT_WORDS[n - 1]} ${plural(animal, n)}.`,
    label: `${COUNT_WORDS[n - 1]} ${plural(animal, n)}`,
    ja: `${animal.ja} ${n}ひき`,
    items,
  };
}

function buildSizeQuestion(exclude, rng) {
  const animals = ANIMALS();
  let animal = pick(animals, rng);
  let size = rng() < 0.5 ? 'big' : 'small';
  for (let i = 0; i < 20 && exclude.includes(`${animal.id}|${size}`); i++) {
    animal = pick(animals, rng);
    size = rng() < 0.5 ? 'big' : 'small';
  }
  const other = size === 'big' ? 'small' : 'big';
  const otherAnimal = pick(animals.filter((a) => a.id !== animal.id), rng);
  const items = [
    { word: animal, size },
    { word: animal, size: other },
    { word: otherAnimal, size },
    { word: otherAnimal, size: other },
  ];
  return {
    kind: 'size',
    key: `${animal.id}|${size}`,
    phrase: `Touch the ${size} ${animal.en}.`,
    label: `${size} ${animal.en}`,
    ja: `${size === 'big' ? 'おおきい' : 'ちいさい'} ${animal.ja}`,
    items,
  };
}

// 1問ぶん。items[0]が正解の状態で作り、シャッフルして correctIndex を決める
export function buildQuestion(difficulty, { categories = CATEGORIES, exclude = [], rng = Math.random } = {}) {
  let q;
  if (difficulty === 'normal') q = buildColorShapeQuestion(exclude, rng);
  else if (difficulty === 'hard') q = rng() < 0.5 ? buildCountQuestion(exclude, rng) : buildSizeQuestion(exclude, rng);
  else q = buildWordQuestion(categories, exclude, rng);
  const answerKey = itemKey(q.items[0]);
  const options = shuffle(q.items, rng);
  return {
    ...q,
    items: undefined,
    options,
    correctIndex: options.findIndex((it) => itemKey(it) === answerKey),
  };
}

export function createGame({ difficulty = 'easy', mode = 'solo', categories = CATEGORIES, rng = Math.random } = {}) {
  const cats = (categories ?? []).filter((c) => CATEGORIES.includes(c));
  return {
    ...createQuizState({ mode, questions: QUESTIONS_PER_ROUND }),
    difficulty,
    categories: cats.length ? cats : CATEGORIES.slice(),
    rng,
    asked: [],
  };
}

export function nextQuestion(state) {
  if (state.questionIndex >= QUESTIONS_PER_ROUND) return null;
  if (state.asked.length >= 8) state.asked = state.asked.slice(-4); // 直近だけ避ける（出題の種類が少ない難易度でも回る）
  const q = buildQuestion(state.difficulty, { categories: state.categories, exclude: state.asked, rng: state.rng });
  state.asked.push(q.key);
  return beginQuestion(state, { ...q, simultaneous: true });
}

export { addListen, answer, robotAnswer };
