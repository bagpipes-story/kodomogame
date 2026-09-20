// art.js — 自前のSVG絵素材（v0.17.1。別冊04§2.1「絵文字は仮、SVG化は仕上げ回で」の実施）
// 1ファイルに文字列で同梱する理由: ファイル数を増やさない（Service Workerのキャッシュ一覧も変わらない）、
// 実行時の読み込み待ちが無い、絵文字のように端末・OSで見た目が変わらない。
// すべて viewBox 0 0 100 100・同じ線色/太さで統一（フラット＋やわらかい輪郭）。
// 単語（words.jsのid）と、ホームのゲームアイコン（games[].id）を同じ仕組みで引く。

const LINE = '#5b4a3f';
const S = `stroke="${LINE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- どうぶつ ----------
const animal = {
  lion: `
    <circle cx="50" cy="52" r="40" fill="#e0862e" ${S}/>
    <circle cx="50" cy="52" r="28" fill="#f7c66b" ${S}/>
    <circle cx="40" cy="47" r="3.5" fill="${LINE}"/><circle cx="60" cy="47" r="3.5" fill="${LINE}"/>
    <ellipse cx="50" cy="59" rx="6" ry="4" fill="${LINE}"/>
    <path d="M44 66 Q50 71 56 66" fill="none" ${S}/>
    <path d="M28 40 L36 34 M72 40 L64 34" fill="none" ${S}/>`,
  elephant: `
    <circle cx="26" cy="46" r="16" fill="#a9b7c9" ${S}/><circle cx="74" cy="46" r="16" fill="#a9b7c9" ${S}/>
    <circle cx="50" cy="50" r="28" fill="#c2cedd" ${S}/>
    <path d="M50 62 Q52 80 42 90 Q36 86 40 78" fill="#c2cedd" ${S}/>
    <circle cx="40" cy="44" r="3.5" fill="${LINE}"/><circle cx="60" cy="44" r="3.5" fill="${LINE}"/>`,
  giraffe: `
    <path d="M40 92 L40 50 Q40 30 56 30 L58 92 Z" fill="#f4c75c" ${S}/>
    <circle cx="58" cy="30" r="16" fill="#f4c75c" ${S}/>
    <path d="M50 16 L46 6 M66 16 L70 6" fill="none" ${S}/>
    <circle cx="46" cy="6" r="3" fill="#c0554a"/><circle cx="70" cy="6" r="3" fill="#c0554a"/>
    <circle cx="44" cy="60" r="5" fill="#d29a3a"/><circle cx="52" cy="75" r="4" fill="#d29a3a"/><circle cx="46" cy="86" r="3" fill="#d29a3a"/>
    <circle cx="54" cy="28" r="3" fill="${LINE}"/><circle cx="64" cy="28" r="3" fill="${LINE}"/>
    <ellipse cx="60" cy="38" rx="6" ry="3.5" fill="#d29a3a"/>`,
  dog: `
    <circle cx="50" cy="52" r="30" fill="#e2b07a" ${S}/>
    <path d="M24 42 Q14 66 26 78 Q34 70 32 46 Z" fill="#a8713f" ${S}/>
    <path d="M76 42 Q86 66 74 78 Q66 70 68 46 Z" fill="#a8713f" ${S}/>
    <circle cx="40" cy="48" r="3.5" fill="${LINE}"/><circle cx="60" cy="48" r="3.5" fill="${LINE}"/>
    <ellipse cx="50" cy="60" rx="7" ry="5" fill="${LINE}"/>
    <path d="M50 65 L50 70 M42 72 Q50 78 58 72" fill="none" ${S}/>`,
  cat: `
    <path d="M22 44 L26 14 L44 30 Z" fill="#f2a65a" ${S}/><path d="M78 44 L74 14 L56 30 Z" fill="#f2a65a" ${S}/>
    <circle cx="50" cy="54" r="30" fill="#f2a65a" ${S}/>
    <circle cx="40" cy="50" r="3.5" fill="${LINE}"/><circle cx="60" cy="50" r="3.5" fill="${LINE}"/>
    <path d="M47 60 L53 60 L50 64 Z" fill="#e07a7a" ${S}/>
    <path d="M50 64 L50 68 M44 70 Q50 74 56 70" fill="none" ${S}/>
    <path d="M14 58 L34 62 M14 68 L34 66 M86 58 L66 62 M86 68 L66 66" fill="none" ${S}/>`,
  monkey: `
    <circle cx="22" cy="50" r="12" fill="#a06b3e" ${S}/><circle cx="78" cy="50" r="12" fill="#a06b3e" ${S}/>
    <circle cx="50" cy="50" r="30" fill="#a06b3e" ${S}/>
    <path d="M30 56 Q30 78 50 78 Q70 78 70 56 Q60 44 50 50 Q40 44 30 56 Z" fill="#f0cfa0" ${S}/>
    <circle cx="40" cy="48" r="3.5" fill="${LINE}"/><circle cx="60" cy="48" r="3.5" fill="${LINE}"/>
    <circle cx="46" cy="62" r="2" fill="${LINE}"/><circle cx="54" cy="62" r="2" fill="${LINE}"/>
    <path d="M42 70 Q50 75 58 70" fill="none" ${S}/>`,
  panda: `
    <circle cx="26" cy="30" r="12" fill="#3a3a3a" ${S}/><circle cx="74" cy="30" r="12" fill="#3a3a3a" ${S}/>
    <circle cx="50" cy="54" r="32" fill="#ffffff" ${S}/>
    <ellipse cx="38" cy="50" rx="9" ry="11" fill="#3a3a3a" transform="rotate(-20 38 50)"/>
    <ellipse cx="62" cy="50" rx="9" ry="11" fill="#3a3a3a" transform="rotate(20 62 50)"/>
    <circle cx="40" cy="51" r="3" fill="#ffffff"/><circle cx="60" cy="51" r="3" fill="#ffffff"/>
    <ellipse cx="50" cy="64" rx="5" ry="3.5" fill="#3a3a3a"/>
    <path d="M44 70 Q50 75 56 70" fill="none" ${S}/>`,
  koala: `
    <circle cx="20" cy="46" r="17" fill="#9aa4ad" ${S}/><circle cx="80" cy="46" r="17" fill="#9aa4ad" ${S}/>
    <circle cx="20" cy="46" r="9" fill="#e4b3b3"/><circle cx="80" cy="46" r="9" fill="#e4b3b3"/>
    <circle cx="50" cy="52" r="30" fill="#b8c2cb" ${S}/>
    <circle cx="40" cy="46" r="3.5" fill="${LINE}"/><circle cx="60" cy="46" r="3.5" fill="${LINE}"/>
    <ellipse cx="50" cy="62" rx="9" ry="11" fill="#3a3a3a"/>`,
};

// ---------- くだもの ----------
const fruit = {
  apple: `
    <path d="M50 30 Q30 14 20 40 Q14 66 34 84 Q42 90 50 84 Q58 90 66 84 Q86 66 80 40 Q70 14 50 30 Z" fill="#e63946" ${S}/>
    <path d="M50 30 Q52 18 60 12" fill="none" ${S}/>
    <path d="M52 22 Q66 10 72 22 Q60 30 52 22 Z" fill="#2dc653" ${S}/>`,
  orange: `
    <circle cx="50" cy="56" r="34" fill="#f5901e" ${S}/>
    <path d="M50 22 Q56 12 66 14 Q62 24 50 22 Z" fill="#2dc653" ${S}/>
    <circle cx="38" cy="48" r="2" fill="#d97a12"/><circle cx="54" cy="42" r="2" fill="#d97a12"/><circle cx="62" cy="60" r="2" fill="#d97a12"/><circle cx="44" cy="68" r="2" fill="#d97a12"/>`,
  grapes: `
    <path d="M50 12 L50 28" fill="none" ${S}/>
    <path d="M50 18 Q64 8 70 18 Q60 24 50 18 Z" fill="#2dc653" ${S}/>
    <circle cx="36" cy="40" r="11" fill="#8e55c9" ${S}/><circle cx="64" cy="40" r="11" fill="#8e55c9" ${S}/>
    <circle cx="50" cy="42" r="11" fill="#a06fd9" ${S}/>
    <circle cx="30" cy="58" r="11" fill="#8e55c9" ${S}/><circle cx="70" cy="58" r="11" fill="#8e55c9" ${S}/>
    <circle cx="50" cy="60" r="11" fill="#a06fd9" ${S}/>
    <circle cx="40" cy="76" r="11" fill="#8e55c9" ${S}/><circle cx="60" cy="76" r="11" fill="#8e55c9" ${S}/>`,
  strawberry: `
    <path d="M50 30 Q20 30 22 56 Q26 82 50 92 Q74 82 78 56 Q80 30 50 30 Z" fill="#e63946" ${S}/>
    <path d="M30 30 L40 20 L50 30 L60 20 L70 30 L60 36 L50 30 L40 36 Z" fill="#2dc653" ${S}/>
    <path d="M50 12 L50 24" fill="none" ${S}/>
    <circle cx="40" cy="50" r="2.5" fill="#fff3d6"/><circle cx="60" cy="50" r="2.5" fill="#fff3d6"/><circle cx="50" cy="62" r="2.5" fill="#fff3d6"/><circle cx="38" cy="70" r="2.5" fill="#fff3d6"/><circle cx="62" cy="70" r="2.5" fill="#fff3d6"/>`,
  banana: `
    <path d="M24 30 Q26 76 66 82 Q84 84 90 68 Q76 74 60 66 Q36 56 34 30 Z" fill="#f8d64e" ${S}/>
    <path d="M24 30 L34 30 L36 20 L26 18 Z" fill="#a67c2e" ${S}/>`,
  watermelon: `
    <path d="M12 40 Q50 100 88 40 Z" fill="#2dc653" ${S}/>
    <path d="M20 42 Q50 88 80 42 Z" fill="#e63946"/>
    <path d="M12 40 L88 40" fill="none" ${S}/>
    <circle cx="40" cy="52" r="2.5" fill="${LINE}"/><circle cx="60" cy="52" r="2.5" fill="${LINE}"/><circle cx="50" cy="64" r="2.5" fill="${LINE}"/>`,
  melon: `
    <circle cx="50" cy="56" r="34" fill="#9bcf6b" ${S}/>
    <path d="M26 40 Q50 50 74 40 M22 56 Q50 66 78 56 M28 72 Q50 82 72 72 M38 26 Q40 56 38 86 M62 26 Q60 56 62 86" fill="none" stroke="#e9f3d0" stroke-width="2"/>
    <path d="M50 22 L48 8" fill="none" ${S}/>`,
  peach: `
    <path d="M50 28 Q22 24 20 52 Q20 80 50 90 Q80 80 80 52 Q78 24 50 28 Z" fill="#f7a58e" ${S}/>
    <path d="M50 28 Q46 56 50 90" fill="none" stroke="#e07d64" stroke-width="3"/>
    <path d="M50 28 Q52 16 62 12 Q66 26 50 28 Z" fill="#2dc653" ${S}/>`,
};

// ---------- からだ（部分をオレンジで強調） ----------
const face = `<circle cx="50" cy="54" r="34" fill="#f7dcc0" ${S}/>`;
const body = {
  head: `<circle cx="50" cy="54" r="34" fill="#f28b3b" ${S}/>
    <circle cx="40" cy="50" r="3" fill="${LINE}"/><circle cx="60" cy="50" r="3" fill="${LINE}"/>
    <path d="M42 66 Q50 72 58 66" fill="none" ${S}/>`,
  eye: `<path d="M12 50 Q50 14 88 50 Q50 86 12 50 Z" fill="#ffffff" ${S}/>
    <circle cx="50" cy="50" r="16" fill="#f28b3b" ${S}/><circle cx="50" cy="50" r="7" fill="${LINE}"/>`,
  ear: `<path d="M38 24 Q66 12 68 44 Q66 70 54 84 Q40 90 36 74 Q42 60 46 52 Q30 40 38 24 Z" fill="#f28b3b" ${S}/>
    <path d="M48 36 Q58 34 58 46 Q58 56 50 60" fill="none" ${S}/>`,
  nose: `${face}<path d="M50 34 L40 66 Q50 74 60 66 Z" fill="#f28b3b" ${S}/>
    <circle cx="38" cy="46" r="3" fill="${LINE}"/><circle cx="62" cy="46" r="3" fill="${LINE}"/>`,
  mouth: `${face}<path d="M30 60 Q50 84 70 60 Z" fill="#f28b3b" ${S}/>
    <circle cx="40" cy="46" r="3" fill="${LINE}"/><circle cx="60" cy="46" r="3" fill="${LINE}"/>`,
  hand: `<path d="M34 92 L34 50 Q34 42 42 42 Q42 26 50 26 Q58 26 58 42 L58 30 Q58 22 66 22 Q74 22 74 30 L74 48 Q74 40 82 40 Q90 40 90 48 L90 72 Q90 92 70 92 Z" fill="#f28b3b" ${S}/>
    <path d="M34 60 Q22 50 16 60 Q14 68 30 74" fill="#f28b3b" ${S}/>`,
  foot: `<path d="M30 20 Q54 16 56 40 L60 70 Q86 70 88 82 Q88 90 76 90 L34 90 Q26 90 26 80 L26 40 Q26 22 30 20 Z" fill="#f28b3b" ${S}/>
    <circle cx="74" cy="66" r="4" fill="#f28b3b" ${S}/><circle cx="84" cy="70" r="3" fill="#f28b3b" ${S}/>`,
  hair: `<circle cx="50" cy="58" r="30" fill="#f7dcc0" ${S}/>
    <path d="M20 56 Q16 16 50 14 Q84 16 80 56 Q74 36 62 34 Q50 40 38 34 Q26 36 20 56 Z" fill="#f28b3b" ${S}/>
    <circle cx="40" cy="58" r="3" fill="${LINE}"/><circle cx="60" cy="58" r="3" fill="${LINE}"/>
    <path d="M42 72 Q50 78 58 72" fill="none" ${S}/>`,
};

// ---------- ホームのゲームアイコン（白い線画寄り。テーマ色の四角の上に載せる） ----------
const W = `fill="#ffffff" ${S}`;
const games = {
  tictactoe: `<circle cx="34" cy="34" r="16" fill="none" stroke="#ffffff" stroke-width="8"/>
    <path d="M54 54 L82 82 M82 54 L54 82" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>`,
  memory: `<rect x="16" y="24" width="38" height="52" rx="6" ${W}/>
    <rect x="46" y="24" width="38" height="52" rx="6" fill="#ffe4b8" ${S}/>
    <circle cx="65" cy="50" r="9" fill="#e63946"/>`,
  enword: `<path d="M18 22 H82 Q90 22 90 30 V62 Q90 70 82 70 H48 L30 86 V70 H18 Q10 70 10 62 V30 Q10 22 18 22 Z" ${W}/>
    <text x="50" y="58" text-anchor="middle" font-size="30" font-weight="800" fill="${LINE}" font-family="sans-serif">A</text>`,
  abc: `<text x="50" y="66" text-anchor="middle" font-size="44" font-weight="800" fill="#ffffff" stroke="${LINE}" stroke-width="2" font-family="sans-serif">ABC</text>`,
  listen: `<path d="M34 26 Q60 10 64 40 Q64 56 52 64 Q44 70 44 84 Q42 92 34 88" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
    <path d="M72 30 Q84 50 72 70 M82 22 Q98 50 82 78" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>`,
  flash: `<rect x="14" y="14" width="32" height="32" rx="6" ${W}/><rect x="54" y="14" width="32" height="32" rx="6" ${W}/><rect x="14" y="54" width="32" height="32" rx="6" ${W}/><rect x="54" y="54" width="32" height="32" rx="6" fill="#ffe4b8" ${S}/>
    <text x="30" y="38" text-anchor="middle" font-size="22" font-weight="800" fill="${LINE}" font-family="sans-serif">1</text>
    <text x="70" y="38" text-anchor="middle" font-size="22" font-weight="800" fill="${LINE}" font-family="sans-serif">2</text>
    <text x="30" y="78" text-anchor="middle" font-size="22" font-weight="800" fill="${LINE}" font-family="sans-serif">3</text>
    <text x="70" y="78" text-anchor="middle" font-size="22" font-weight="800" fill="${LINE}" font-family="sans-serif">?</text>`,
  othello: `<circle cx="36" cy="40" r="20" fill="#2b2b2b" ${S}/><circle cx="64" cy="60" r="20" ${W}/>`,
  sevens: `<rect x="30" y="14" width="40" height="60" rx="6" ${W}/>
    <text x="50" y="56" text-anchor="middle" font-size="34" font-weight="800" fill="#e63946" font-family="sans-serif">7</text>
    <rect x="22" y="26" width="40" height="60" rx="6" fill="#ffffff" ${S} transform="rotate(-12 42 56)" opacity="0.9"/>
    <text x="42" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="${LINE}" font-family="sans-serif" transform="rotate(-12 42 56)">8</text>`,
  oldmaid: `<rect x="30" y="14" width="40" height="64" rx="6" ${W}/>
    <path d="M50 30 L58 48 L42 48 Z" fill="#f4a261" ${S}/><circle cx="50" cy="56" r="8" fill="#f7dcc0" ${S}/>
    <circle cx="42" cy="34" r="3" fill="#e63946"/><circle cx="58" cy="34" r="3" fill="#3a86ff"/>`,
  balance: `<rect x="22" y="62" width="56" height="20" rx="4" ${W}/><rect x="30" y="40" width="40" height="20" rx="4" fill="#ffe4b8" ${S}/><rect x="40" y="18" width="24" height="20" rx="4" ${W}/>`,
  rollcatch: `<path d="M12 40 L88 68" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
    <circle cx="36" cy="34" r="12" fill="#e63946" ${S}/>
    <rect x="66" y="76" width="24" height="12" rx="4" ${W}/>`,
  korinto: `<circle cx="30" cy="30" r="5" ${W}/><circle cx="50" cy="30" r="5" ${W}/><circle cx="70" cy="30" r="5" ${W}/>
    <circle cx="40" cy="50" r="5" ${W}/><circle cx="60" cy="50" r="5" ${W}/>
    <circle cx="30" cy="70" r="5" ${W}/><circle cx="50" cy="70" r="5" ${W}/><circle cx="70" cy="70" r="5" ${W}/>
    <circle cx="50" cy="14" r="8" fill="#e63946" ${S}/>`,
  maze: `<rect x="14" y="14" width="72" height="72" rx="6" fill="none" stroke="#ffffff" stroke-width="6"/>
    <path d="M14 38 H50 M38 38 V62 M62 26 V62 H86 M26 74 H62" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
    <circle cx="26" cy="26" r="7" fill="#e63946" ${S}/>`,
  mole: `<ellipse cx="50" cy="78" rx="34" ry="10" fill="#7a5a3a" ${S}/>
    <path d="M28 78 Q28 40 50 40 Q72 40 72 78 Z" fill="#a8713f" ${S}/>
    <circle cx="42" cy="58" r="3.5" fill="${LINE}"/><circle cx="58" cy="58" r="3.5" fill="${LINE}"/>
    <ellipse cx="50" cy="68" rx="6" ry="4" fill="#e07a7a"/>`,
};

// ---------- ゲーム内のキャラクター・UI部品（絵文字の置き換え。v0.17.2） ----------
const parts = {
  // もぐらたたきのもぐら（穴から顔を出す。下は平らにして穴に隠れる）
  moleChar: `
    <path d="M18 96 L18 52 Q18 18 50 18 Q82 18 82 52 L82 96 Z" fill="#a8713f" ${S}/>
    <path d="M36 62 Q50 50 64 62 Q64 78 50 80 Q36 78 36 62 Z" fill="#e8c9a0"/>
    <circle cx="38" cy="46" r="4" fill="${LINE}"/><circle cx="62" cy="46" r="4" fill="${LINE}"/>
    <ellipse cx="50" cy="60" rx="7" ry="5" fill="#e07a7a" ${S}/>
    <path d="M44 70 Q50 74 56 70" fill="none" ${S}/>
    <path d="M10 60 L30 66 M10 72 L30 70 M90 60 L70 66 M90 72 L70 70" fill="none" ${S}/>`,
  butterfly: `
    <path d="M50 50 Q20 10 12 34 Q10 52 44 54 Z" fill="#f6a6b2" ${S}/><path d="M50 50 Q80 10 88 34 Q90 52 56 54 Z" fill="#f6a6b2" ${S}/>
    <path d="M50 54 Q22 60 20 78 Q28 92 46 62 Z" fill="#c9a7eb" ${S}/><path d="M50 54 Q78 60 80 78 Q72 92 54 62 Z" fill="#c9a7eb" ${S}/>
    <ellipse cx="50" cy="56" rx="5" ry="18" fill="${LINE}"/>
    <path d="M46 40 Q40 26 34 24 M54 40 Q60 26 66 24" fill="none" ${S}/>
    <circle cx="30" cy="34" r="4" fill="#fff3d6"/><circle cx="70" cy="34" r="4" fill="#fff3d6"/>`,
  robot: `
    <rect x="22" y="30" width="56" height="50" rx="12" fill="#a5b8f3" ${S}/>
    <path d="M50 30 L50 16" fill="none" ${S}/><circle cx="50" cy="12" r="5" fill="#f28b3b" ${S}/>
    <rect x="32" y="42" width="14" height="14" rx="4" fill="#ffffff" ${S}/><rect x="54" y="42" width="14" height="14" rx="4" fill="#ffffff" ${S}/>
    <circle cx="39" cy="49" r="3" fill="${LINE}"/><circle cx="61" cy="49" r="3" fill="${LINE}"/>
    <path d="M38 66 Q50 74 62 66" fill="none" ${S}/>
    <rect x="12" y="46" width="10" height="16" rx="3" fill="#a5b8f3" ${S}/><rect x="78" y="46" width="10" height="16" rx="3" fill="#a5b8f3" ${S}/>`,
  speaker: `
    <path d="M18 40 H34 L54 24 V76 L34 60 H18 Z" fill="#ffffff" ${S}/>
    <path d="M64 38 Q74 50 64 62 M74 28 Q90 50 74 72" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>`,
  soundOn: `
    <path d="M18 40 H34 L54 24 V76 L34 60 H18 Z" fill="#f28b3b" ${S}/>
    <path d="M64 38 Q74 50 64 62 M74 28 Q90 50 74 72" fill="none" ${S}/>`,
  soundOff: `
    <path d="M18 40 H34 L54 24 V76 L34 60 H18 Z" fill="#c9c3ba" ${S}/>
    <path d="M66 40 L86 60 M86 40 L66 60" fill="none" ${S}/>`,
  stampBook: `
    <rect x="20" y="14" width="60" height="72" rx="8" fill="#f4a261" ${S}/>
    <rect x="20" y="14" width="14" height="72" rx="6" fill="#e0862e" ${S}/>
    <circle cx="58" cy="40" r="10" fill="#ffffff" ${S}/><circle cx="58" cy="66" r="10" fill="#ffffff" ${S}/>
    <circle cx="58" cy="40" r="4" fill="#e63946"/><circle cx="58" cy="66" r="4" fill="#2dc653"/>`,
  tea: `
    <path d="M22 44 H74 L70 84 Q68 92 60 92 H36 Q28 92 26 84 Z" fill="#7fc8a9" ${S}/>
    <path d="M74 52 Q92 50 90 64 Q88 76 72 76" fill="none" ${S}/>
    <path d="M22 44 Q48 36 74 44 Q48 52 22 44 Z" fill="#b8e6cf" ${S}/>
    <path d="M40 28 Q36 20 42 12 M56 28 Q52 20 58 12" fill="none" stroke="#c9c3ba" stroke-width="3" stroke-linecap="round"/>`,
  star: `<polygon points="50,8 61,38 94,38 67,58 78,90 50,71 22,90 33,58 6,38 39,38" fill="#fff3d6" ${S}/>`,
  joker: `
    <path d="M50 88 Q30 88 26 66 L22 34 L40 46 L50 22 L60 46 L78 34 L74 66 Q70 88 50 88 Z" fill="#c9a7eb" ${S}/>
    <circle cx="22" cy="34" r="5" fill="#e63946" ${S}/><circle cx="50" cy="22" r="5" fill="#f0c94a" ${S}/><circle cx="78" cy="34" r="5" fill="#3a86ff" ${S}/>
    <circle cx="50" cy="66" r="14" fill="#f7dcc0" ${S}/>
    <circle cx="45" cy="64" r="2.5" fill="${LINE}"/><circle cx="55" cy="64" r="2.5" fill="${LINE}"/>
    <path d="M44 71 Q50 76 56 71" fill="none" ${S}/>`,
  smile: `
    <circle cx="50" cy="52" r="34" fill="#f7dcc0" ${S}/>
    <circle cx="38" cy="46" r="3.5" fill="${LINE}"/><circle cx="62" cy="46" r="3.5" fill="${LINE}"/>
    <path d="M36 62 Q50 74 64 62" fill="none" ${S}/>`,
  bear: `
    <circle cx="26" cy="30" r="12" fill="#a06b3e" ${S}/><circle cx="74" cy="30" r="12" fill="#a06b3e" ${S}/>
    <circle cx="50" cy="54" r="32" fill="#b98652" ${S}/>
    <ellipse cx="50" cy="66" rx="14" ry="10" fill="#e8c9a0"/>
    <circle cx="40" cy="48" r="3.5" fill="${LINE}"/><circle cx="60" cy="48" r="3.5" fill="${LINE}"/>
    <ellipse cx="50" cy="62" rx="5" ry="3.5" fill="${LINE}"/>`,
  rabbit: `
    <ellipse cx="38" cy="22" rx="9" ry="20" fill="#ffffff" ${S}/><ellipse cx="62" cy="22" rx="9" ry="20" fill="#ffffff" ${S}/>
    <ellipse cx="38" cy="22" rx="4" ry="13" fill="#f6a6b2"/><ellipse cx="62" cy="22" rx="4" ry="13" fill="#f6a6b2"/>
    <circle cx="50" cy="60" r="28" fill="#ffffff" ${S}/>
    <circle cx="40" cy="56" r="3.5" fill="${LINE}"/><circle cx="60" cy="56" r="3.5" fill="${LINE}"/>
    <path d="M47 66 L53 66 L50 70 Z" fill="#f6a6b2" ${S}/><path d="M50 70 L50 74 M44 76 Q50 80 56 76" fill="none" ${S}/>`,
  chick: `
    <circle cx="50" cy="54" r="32" fill="#f8d64e" ${S}/>
    <path d="M42 18 Q50 6 58 18" fill="none" ${S}/>
    <circle cx="40" cy="50" r="3.5" fill="${LINE}"/><circle cx="60" cy="50" r="3.5" fill="${LINE}"/>
    <path d="M44 60 L56 60 L50 68 Z" fill="#f28b3b" ${S}/>`,
  redDot: `<circle cx="50" cy="50" r="30" fill="#e63946" ${S}/>`,
  blueDot: `<circle cx="50" cy="50" r="30" fill="#3a86ff" ${S}/>`,
};

export const ART = { ...animal, ...fruit, ...body, ...games, ...parts };

export function hasArt(id) {
  return Object.hasOwn(ART, id);
}

// SVG要素を返す（無いidはnull → 呼び出し側が絵文字にフォールバック）。中身は自前の静的文字列のみ
const template = globalThis.document?.createElement('template');
export function createArt(id, className = 'kgb-art') {
  if (!hasArt(id) || !template) return null;
  template.innerHTML = `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true">${ART[id]}</svg>`;
  return template.content.firstElementChild.cloneNode(true);
}
