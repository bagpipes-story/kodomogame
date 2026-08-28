// i18n.js — UI文言の一元管理（v0.1）
// ルール: ひらがな・カタカナのみ（漢字禁止）。文言変更はこのファイルだけで済むようにする。

export const text = {
  appTitle: 'こどもゲームボックス',
  preparing: 'じゅんびちゅう…',
  back: 'もどる',
  soundOn: 'おと オン',
  soundOff: 'おと オフ',
};

// ゲーム一覧: idはファイル構成（js/games/<id>/）と一致させる。
// iconはv0.1の仮表示（絵文字）。v0.7でSVGアイコンに置き換える予定。
export const games = [
  { id: 'othello', name: 'オセロ', icon: '⚫' },
  { id: 'sevens', name: 'しちならべ', icon: '7' },
  { id: 'memory', name: 'しんけいすいじゃく', icon: '🍎' },
  { id: 'oldmaid', name: 'ばばぬき', icon: '🃏' },
  { id: 'balance', name: 'バランスゲーム', icon: '🧱' },
];
