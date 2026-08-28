// i18n.js — UI文言の一元管理（v0.2）
// ルール: ひらがな・カタカナのみ（漢字禁止）。文言変更はこのファイルだけで済むようにする。

export const text = {
  appTitle: 'こどもゲームボックス',
  preparing: 'じゅんびちゅう…',
  back: 'もどる',
  soundOn: 'おと オン',
  soundOff: 'おと オフ',

  // あそびかた設定画面
  modeLabel: 'あそびかた',
  modeSolo: 'ひとりで',
  modeCpu: 'ロボットと',
  modeTwo: 'ふたりで',
  sizeLabel: 'カードの かず',
  sizeEasy: 'かんたん',
  sizeNormal: 'ふつう',
  sizeHard: 'むずかしい',
  levelLabel: 'ロボットの つよさ',
  levelWeak: 'よわい',
  levelNormal: 'ふつう',
  levelStrong: 'つよい',
  start: 'スタート！',

  // やめる確認ダイアログ
  quitMessage: 'ゲームを やめる？',
  quitYes: 'やめる',
  quitNo: 'つづける',

  // 手番・プレイヤー名
  turnYou: 'あなたの ばん',
  turnCpu: 'ロボットの ばん',
  turnRed: 'あかの ばん',
  turnBlue: 'あおの ばん',
  you: 'あなた',
  cpuName: 'ロボット',
  redName: 'あか',
  blueName: 'あお',
  blackName: 'くろ',
  whiteName: 'しろ',
  turnBlack: 'くろの ばん',
  turnWhite: 'しろの ばん',
  passSuffix: 'は パス！', // 「くろは パス！」のように名前の後ろに付ける

  // 結果画面（ネガティブ表現禁止。「またあそぼう！」トーン）
  movesLabel: 'めくった かいすう',
  bestLabel: 'さいこうきろく',
  newRecord: 'しんきろく！',
  winSolo: 'ぜんぶ そろえた！',
  winYou: 'あなたの かち！',
  winCpu: 'ロボットの かち！',
  winRed: 'あかの かち！',
  winBlue: 'あおの かち！',
  winBlack: 'くろの かち！',
  winWhite: 'しろの かち！',
  draw: 'ひきわけ！',
  playAgainTone: 'またあそぼう！',
  replay: 'もういちど',
  goHome: 'ホームへ',
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
