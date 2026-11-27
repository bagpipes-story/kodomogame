// catalog/animal.js — どうぶつの ずかん画（v0.21.0。別冊05 §3）。はじめの 30種＝バランスゲームと 同じ ID（ずかんの 記録を 消さない ため）。
// むずかしい・おとなの なまえあてと その ずかんで 使う。かんたん・ふつうは いままでの つみきの 絵。
// この ファイルは なかま（GROUPS）と タブ（ORDERS）だけ。絵は animal2〜animal4.js（10種ずつ）。registry.js が 4つを 1つに まとめる。
// （3つの 絵の ファイルを 同時に 描き進めた ため、どれかが 書きかけでも ほかが 読める ように 分けた）
// きまり（むし・うみと 同じ）:
// - かわいさより「その種類だと 見分けられる」こと。見分けポイントを 先に 決めて その とおりに 描く
// - ほにゅうるい・とりは 真横から（左むき）で 立った すがた（図鑑と 同じ）。つかまる・すわる くらしの ものは その すがた
// - からだは ひとつづきの りんかく（あたま・あし・しっぽを べつの 形で かさねて つなぎめに 線を 出さない）
// - オスと メスで ちがう 種類は オス（ライオンの たてがみ、ニワトリの とさか など）
// どうぶつの なかまには、いままでの つみきに あわせて とり（ニワトリ・フクロウ・フラミンゴ・ダチョウ）と ワニ・ヘビ・カエルも 入って いる

// GROUPS = タブの 中の 見出し（科 くらいの なかま）、ORDERS = タブ（大きな なかま）。分類の「目」は 種類ごとに 文字の ファイルで 持つ
export const GROUPS = [
  'cat', 'dog', 'bear',
  'pig', 'hippo', 'bovid', 'giraffe', 'camel', 'horse', 'rhino', 'elephant',
  'monkey', 'rabbit', 'rodent', 'hedgehog',
  'kangaroo', 'koala',
  'fowl', 'owl', 'flamingo', 'ratite',
  'croc', 'snake', 'frog',
];
export const ORDERS = [
  { key: 'carnivore', groups: ['cat', 'dog', 'bear'] },
  { key: 'hoofed', groups: ['pig', 'hippo', 'bovid', 'giraffe', 'camel', 'horse', 'rhino', 'elephant'] },
  { key: 'small', groups: ['monkey', 'rabbit', 'rodent', 'hedgehog'] },
  { key: 'marsupial', groups: ['kangaroo', 'koala'] },
  { key: 'bird', groups: ['fowl', 'owl', 'flamingo', 'ratite'] },
  { key: 'reptile', groups: ['croc', 'snake', 'frog'] },
];

export const SPECIES = {};
