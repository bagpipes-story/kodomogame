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

  // 7ならべ
  passButton: 'パス',
  remainPrefix: 'のこり ',
  sheetsSuffix: ' まい',
  handoverTap: 'タップして スタート',
  reasonEmpty: 'てふだを ぜんぶ だした！',
  reasonPassOver: 'パスが なくなった',
  robotsLabel: 'ロボットの かず',
  turnSuffix: 'の ばん',   // 「ロボット2の ばん」のように名前と組み合わせる
  winSuffix: 'の かち！',
  retireSuffix: 'は パスが なくなった',

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

  // ◯×ゲーム
  tttCircle: 'まる',
  tttCross: 'ばつ',
  reachLabel: 'あとひとつ！',
  drawStrong: 'ひきわけ！ふたりとも つよい！',

  // もぐらたたき
  difficultyLabel: 'むずかしさ',
  sizeAdult: 'おとな',
  readyTitle: 'じゅんびは いいかな？',
  moleCountSuffix: ' ひき',
  moleResultPrefix: 'きょうは ',
  moleResultSuffix: ' ひき たたけたね！',
  comboSuffix: 'こ つづけて！',
  butterflyOops: 'あっ、ちょうちょさん！',
  secondsSuffix: ' びょう',

  // 具体ほめシステム（仕様§3.4: 行動をほめる具体文。「てんさい！」の乱発はしない）
  praiseTitle: 'きょうの すごいところ',
  praise: {
    finished_game: 'さいごまで できたね！',
    waited_turn: 'じゅんばんを まてたね！',
    blocked_reach: 'あいての リーチに きづいて ふせげたね！',
    draw_positive: 'さいごまで よく かんがえたね！',
    took_corner: 'かどを とれたね！',
    comeback: 'ぎゃくてん できたね！',
    remembered_pair: 'ばしょを よく おぼえてたね！',
    combo: 'つづけて あてられたね！',
    found_pair: 'おなじ すうじを みつけられたね！',
    thought_long: 'じっくり かんがえられたね！',
    new_record: 'じぶんの きろくを こえたね！',
    retried: 'なんかいも チャレンジして えらい！',
    perfect_patience: 'たたかないで がまん できたね！',
  },
  draw: 'ひきわけ！',
  playAgainTone: 'またあそぼう！',
  replay: 'もういちど',
  goHome: 'ホームへ',
};

// ゲーム一覧: idはファイル構成（js/games/<id>/）と一致させる。
// iconは仮表示（絵文字）。v0.10でSVGアイコンに置き換える予定。
export const games = [
  { id: 'tictactoe', name: 'まるばつ', icon: '⭕' },
  { id: 'memory', name: 'しんけいすいじゃく', icon: '🍎' },
  { id: 'othello', name: 'オセロ', icon: '⚫' },
  { id: 'sevens', name: 'しちならべ', icon: '7' },
  { id: 'oldmaid', name: 'ばばぬき', icon: '🃏' },
  { id: 'balance', name: 'バランスゲーム', icon: '🧱' },
  { id: 'mole', name: 'もぐらたたき', icon: '🔨' },
];
