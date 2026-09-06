// words.js — 英単語データ（別冊04§2.1のwords.json相当。fetch禁止のためJSモジュール）
// 6カテゴリ50語。絵は当面絵文字（いろ・かず・かたちはwordart.jsがプログラム描画）。
// 単語の追加はこの配列に1行足すだけで、ゲーム側にカテゴリをハードコードしない。
// kind: 'emoji'=絵文字 / 'color'=色の丸 / 'number'=数字＋ドット / 'shape'=図形(SVG)

export const CATEGORIES = ['animal', 'fruit', 'color', 'number', 'shape', 'body'];

export const WORDS = [
  // animal（神経衰弱のどうぶつテーマと共通）
  { id: 'lion', en: 'lion', ja: 'ライオン', cat: 'animal', kind: 'emoji', value: '🦁' },
  { id: 'elephant', en: 'elephant', ja: 'ぞう', cat: 'animal', kind: 'emoji', value: '🐘' },
  { id: 'giraffe', en: 'giraffe', ja: 'キリン', cat: 'animal', kind: 'emoji', value: '🦒' },
  { id: 'dog', en: 'dog', ja: 'いぬ', cat: 'animal', kind: 'emoji', value: '🐶' },
  { id: 'cat', en: 'cat', ja: 'ねこ', cat: 'animal', kind: 'emoji', value: '🐱' },
  { id: 'monkey', en: 'monkey', ja: 'さる', cat: 'animal', kind: 'emoji', value: '🐵' },
  { id: 'panda', en: 'panda', ja: 'パンダ', cat: 'animal', kind: 'emoji', value: '🐼' },
  { id: 'koala', en: 'koala', ja: 'コアラ', cat: 'animal', kind: 'emoji', value: '🐨' },
  // fruit（みかん=orange）
  { id: 'apple', en: 'apple', ja: 'りんご', cat: 'fruit', kind: 'emoji', value: '🍎' },
  { id: 'orange', en: 'orange', ja: 'みかん', cat: 'fruit', kind: 'emoji', value: '🍊' },
  { id: 'grapes', en: 'grapes', ja: 'ぶどう', cat: 'fruit', kind: 'emoji', value: '🍇' },
  { id: 'strawberry', en: 'strawberry', ja: 'いちご', cat: 'fruit', kind: 'emoji', value: '🍓' },
  { id: 'banana', en: 'banana', ja: 'バナナ', cat: 'fruit', kind: 'emoji', value: '🍌' },
  { id: 'watermelon', en: 'watermelon', ja: 'スイカ', cat: 'fruit', kind: 'emoji', value: '🍉' },
  { id: 'melon', en: 'melon', ja: 'メロン', cat: 'fruit', kind: 'emoji', value: '🍈' },
  { id: 'peach', en: 'peach', ja: 'もも', cat: 'fruit', kind: 'emoji', value: '🍑' },
  // color（色の丸。valueは色コード）
  { id: 'red', en: 'red', ja: 'あか', cat: 'color', kind: 'color', value: '#e63946' },
  { id: 'blue', en: 'blue', ja: 'あお', cat: 'color', kind: 'color', value: '#3a86ff' },
  { id: 'yellow', en: 'yellow', ja: 'きいろ', cat: 'color', kind: 'color', value: '#ffd166' },
  { id: 'green', en: 'green', ja: 'みどり', cat: 'color', kind: 'color', value: '#2dc653' },
  { id: 'pink', en: 'pink', ja: 'ピンク', cat: 'color', kind: 'color', value: '#ff8fab' },
  { id: 'purple', en: 'purple', ja: 'むらさき', cat: 'color', kind: 'color', value: '#9b5de5' },
  { id: 'black', en: 'black', ja: 'くろ', cat: 'color', kind: 'color', value: '#2b2b2b' },
  { id: 'white', en: 'white', ja: 'しろ', cat: 'color', kind: 'color', value: '#ffffff' },
  // number（数字＋ドット。valueは数）
  { id: 'one', en: 'one', ja: 'いち', cat: 'number', kind: 'number', value: 1 },
  { id: 'two', en: 'two', ja: 'に', cat: 'number', kind: 'number', value: 2 },
  { id: 'three', en: 'three', ja: 'さん', cat: 'number', kind: 'number', value: 3 },
  { id: 'four', en: 'four', ja: 'よん', cat: 'number', kind: 'number', value: 4 },
  { id: 'five', en: 'five', ja: 'ご', cat: 'number', kind: 'number', value: 5 },
  { id: 'six', en: 'six', ja: 'ろく', cat: 'number', kind: 'number', value: 6 },
  { id: 'seven', en: 'seven', ja: 'なな', cat: 'number', kind: 'number', value: 7 },
  { id: 'eight', en: 'eight', ja: 'はち', cat: 'number', kind: 'number', value: 8 },
  { id: 'nine', en: 'nine', ja: 'きゅう', cat: 'number', kind: 'number', value: 9 },
  { id: 'ten', en: 'ten', ja: 'じゅう', cat: 'number', kind: 'number', value: 10 },
  // shape（wordart.jsがSVGで描く。valueは図形名）
  { id: 'circle', en: 'circle', ja: 'まる', cat: 'shape', kind: 'shape', value: 'circle' },
  { id: 'triangle', en: 'triangle', ja: 'さんかく', cat: 'shape', kind: 'shape', value: 'triangle' },
  { id: 'square', en: 'square', ja: 'ましかく', cat: 'shape', kind: 'shape', value: 'square' },
  { id: 'star', en: 'star', ja: 'ほし', cat: 'shape', kind: 'shape', value: 'star' },
  { id: 'heart', en: 'heart', ja: 'ハート', cat: 'shape', kind: 'shape', value: 'heart' },
  { id: 'rectangle', en: 'rectangle', ja: 'ながしかく', cat: 'shape', kind: 'shape', value: 'rectangle' },
  { id: 'oval', en: 'oval', ja: 'だえん', cat: 'shape', kind: 'shape', value: 'oval' },
  { id: 'diamond', en: 'diamond', ja: 'ひしがた', cat: 'shape', kind: 'shape', value: 'diamond' },
  // body（絵文字の仮表示。SVG化はv0.17）
  { id: 'head', en: 'head', ja: 'あたま', cat: 'body', kind: 'emoji', value: '👤' },
  { id: 'eye', en: 'eye', ja: 'め', cat: 'body', kind: 'emoji', value: '👁️' },
  { id: 'ear', en: 'ear', ja: 'みみ', cat: 'body', kind: 'emoji', value: '👂' },
  { id: 'nose', en: 'nose', ja: 'はな', cat: 'body', kind: 'emoji', value: '👃' },
  { id: 'mouth', en: 'mouth', ja: 'くち', cat: 'body', kind: 'emoji', value: '👄' },
  { id: 'hand', en: 'hand', ja: 'て', cat: 'body', kind: 'emoji', value: '✋' },
  { id: 'foot', en: 'foot', ja: 'あし', cat: 'body', kind: 'emoji', value: '🦶' },
  { id: 'hair', en: 'hair', ja: 'かみのけ', cat: 'body', kind: 'emoji', value: '💇' },
];

const byId = new Map(WORDS.map((w) => [w.id, w]));

export function wordById(id) {
  return byId.get(id) ?? null;
}

export function wordsByCategory(cat) {
  return WORDS.filter((w) => w.cat === cat);
}

// 指定カテゴリから重複なくcount語えらぶ（rng注入でテスト可能）
export function pickWords(count, { categories = CATEGORIES, exclude = [], rng = Math.random } = {}) {
  const pool = WORDS.filter((w) => categories.includes(w.cat) && !exclude.includes(w.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
