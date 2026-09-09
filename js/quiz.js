// quiz.js — 「10問クイズ」の共通状態管理（別冊04 E1/E2/E3で共用）
// 得点・ふたり同時のロック・ロボくんの回答・一発正解や連続正解の数え上げをここに集約する。
// 出題（問題の中身）は各ゲームのgame.jsが作り、beginQuestion()で渡す。DOM非依存（Nodeテスト可能）。

export const DEFAULT_QUESTIONS = 10;

// mode: 'solo'（ひとり）/ 'cpu'（ロボくんと早押し）/ 'two'（ふたり同時 or こうたい）
// scores[0]=あなた（あか）, scores[1]=ロボくん（あお）
export function createQuizState({ mode = 'solo', questions = DEFAULT_QUESTIONS } = {}) {
  return {
    mode,
    questions,
    questionIndex: 0,      // 出題済みの数（1問目を出すと1）
    scores: [0, 0],
    current: null,
    firstTryCorrect: 0,    // 間違えずに正解した問数
    combo: 0,              // あなた（player 0）の連続正解（まちがえるか取られると0）
    maxCombo: 0,
  };
}

// 問題を登録して「答え待ち」にする。q は { correctIndex, options, ... } を持つ任意のオブジェクト
export function beginQuestion(state, q) {
  if (state.questionIndex >= state.questions) return null;
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

function roundOverIfDone(state) {
  if (state.questionIndex < state.questions) return null;
  const [a, b] = state.scores;
  let winner = null;
  if (state.mode !== 'solo') winner = a === b ? null : a > b ? 0 : 1;
  return { scores: state.scores.slice(), winner };
}

function bumpCombo(state, player) {
  if (player !== 0) {
    state.combo = 0;
    return;
  }
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
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
    bumpCombo(state, player);
    return { ok: true, correct: true, roundOver: roundOverIfDone(state) };
  }
  q.wrong.add(optionIndex);
  if (player === 0) state.combo = 0;
  if (state.mode === 'two' && q.simultaneous) {
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
    state.combo = 0;
    return { ok: true, correct: true, roundOver: roundOverIfDone(state) };
  }
  // 外したら次は必ず当てる（「あれれ？」→考え直し。子どもにもう一度チャンス）
  q.robotMissed = true;
  return { ok: true, correct: false };
}
