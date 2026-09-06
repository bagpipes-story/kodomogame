// game.js — 神経衰弱の純ロジック（DOM非依存・Nodeテスト可能）
// 状態はこのファイルの関数だけが変更する。描画はui.jsの責務。

// 難易度ごとのペア数（仕様§4.3: かんたん8枚/ふつう16枚/むずかしい24枚）
export const PAIR_COUNTS = { easy: 4, normal: 8, hard: 12 };

// rngを引数で受け取るのは、テストで並び順を固定できるようにするため。
// variantはペアの片割れ番号（0/1）。えいご=絵↔ことば、ABC=大文字↔小文字のように
// 「同じfaceで見た目が違う」テーマで使う（別冊04§6）。絵合わせテーマは無視してよい
export function createGame({ pairCount, playerCount = 1, rng = Math.random }) {
  const faces = [];
  for (let face = 0; face < pairCount; face++) {
    faces.push({ face, variant: 0 }, { face, variant: 1 });
  }
  // Fisher-Yatesシャッフル
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  return {
    cards: faces.map(({ face, variant }) => ({ face, variant, matched: false })),
    playerCount,
    currentPlayer: 0,
    scores: new Array(playerCount).fill(0),
    faceUp: [],   // このターンで表になっているカードのindex（最大2）
    moves: 0,     // めくったペア数（ひとりプレイの記録用）
    finished: false,
  };
}

export function canFlip(state, index) {
  if (state.finished) return false;
  const card = state.cards[index];
  if (!card || card.matched) return false;
  if (state.faceUp.includes(index)) return false;
  if (state.faceUp.length >= 2) return false; // 3枚目は不一致解決まで待つ
  return true;
}

// カードを1枚めくる。2枚目なら一致判定まで行う。
// 戻り値: { ok, type: 'first' | 'match' | 'mismatch', indices?, finished? }
export function flipCard(state, index) {
  if (!canFlip(state, index)) return { ok: false };
  state.faceUp.push(index);
  if (state.faceUp.length < 2) {
    return { ok: true, type: 'first' };
  }
  state.moves++;
  const [a, b] = state.faceUp;
  if (state.cards[a].face === state.cards[b].face) {
    state.cards[a].matched = true;
    state.cards[b].matched = true;
    state.scores[state.currentPlayer]++;
    state.faceUp = [];
    state.finished = state.cards.every((c) => c.matched);
    // 一致したら手番はそのまま（もう1回めくれるルール）
    return { ok: true, type: 'match', indices: [a, b], finished: state.finished };
  }
  // 不一致はすぐ裏返さない。ui側が1秒見せてからresolveMismatchを呼ぶ
  return { ok: true, type: 'mismatch', indices: [a, b] };
}

// 不一致カードを裏に戻して手番を交代する。戻したindexの配列を返す。
export function resolveMismatch(state) {
  const indices = state.faceUp;
  state.faceUp = [];
  state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
  return indices;
}

// ABCテーマ用: アルファベットから重複なくcount文字えらぶ（テーマの中身はui.jsが決める）
export function pickLetters(count, rng = Math.random) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.slice(0, count);
}

// 最多スコアのプレイヤーindex一覧（同点なら複数=ひきわけ）
export function getWinners(state) {
  const max = Math.max(...state.scores);
  return state.scores
    .map((score, player) => ({ score, player }))
    .filter((s) => s.score === max)
    .map((s) => s.player);
}
