// ui.js — なまえあての描画・入力（v0.18。v0.18.1 で しょうぶ・ずかん）
// まんなかに 黒い かげ。時間が たつと マスごとに かげが うすく なり、下から モザイクの 絵が 見えて くる
// （モザイクは だんだん こまかく なり、さいごは もとの 絵）。下の 4つから 名前を えらぶ。
// 早く あてると のこりの かげが 上から サーっと とけて、くっきりした 絵に なる。
// 性能規定（§9）:
// - 絵は 1問ごとに 1回だけ オフスクリーンに 描いて とっておく（毎フレームは コピーと マスの 消しこみだけ）
// - 毎フレーム 書きかえるのは まんなかの キャンバスだけ。見えて くる あいだ／とける あいだ だけ rAF を 回し、おわったら 止める
// - えらぶ ボタンは 4つを 最初に 作って 使いまわす（テキストと class の 差分更新のみ）
// - 記録の 保存は さいごの 1回だけ（recordPlay）。ずかんは 新しく 正解した ときだけ（storage.js 経由）
// - 時間の バーと 左右の「？」は CSS の transition／animation（毎フレームの JS 更新なし）
// iOSの制約: 読み上げは タップを きっかけに 鳴らす（スタート／つぎ！／こたえの タップの 中で sayJa）。
// v0.18.1: むずかしい いじょうは しょうぶ（まちがい・時間ぎれで その問題は おわり）。左右の「？」で あせりを 演出、
//          正解すると なかまごとの ずかんに のる

import {
  QUESTIONS_PER_ROUND,
  OPTIONS,
  GUESS_SETS,
  DIFFICULTY,
  createGame,
  nextQuestion,
  answerAt,
  timeUp,
  addToZukan,
  zukanAll,
  bookOf,
  ZUKAN_KEYS,
  zukanProgress,
  revealProgress,
  tileRevealTimes,
  mosaicSize,
} from './game.js';
import { PIECE_SETS } from '../balance/pieceSets.js';
import { boundsOf } from '../balance/kit.js';
import { hasZukanArt, loadZukanSet } from '../../zukan/registry.js';
import { openZukanView } from './zukanView.js';
import { text } from '../../i18n.js';
import { playTap, playMatch, playFlutter } from '../../sound.js';
import { sayJa, cancelSpeech } from '../../speech.js';
import { resetPraise, emitPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';
import { showResult, hideResult } from '../../resultView.js';

const CALL_MS = 1400;      // 「おなまえ な〜んだ？」を 見せてから かげが うすく なりはじめる まで
const DISSOLVE_MS = 900;   // 正解で のこりの かげが サーっと とける 時間
const TILE_FADE = 0.07;    // マス1つが うすく なる 長さ（見えて くる 時間の わりあい）
const GRID = 9;            // かげを 9×9 の マスに わける
const NEXT_WAIT_MS = 900;  // 正解の あと「つぎ！」を 出すまで
const ROUND_END_MS = 1500; // さいごの 問題の あと 結果を 出すまで
const FIT = 0.84;          // 絵を キャンバスの 何わりの 大きさに 描くか
const HURRY_LAST_MS = 2000; // のこり この 時間で「？」が はやく なる（v0.18.4: おとな 3びょうに あわせて 3→2びょう）
const BOTTOM_BAND = 0.2;   // 絵の 下に あける わりあい（「？」と 名前の ばしょ。v0.18.3）
const THUMB = 64;          // ずかんの 絵の 大きさ（px）

// ずかんの 見出し（メニューと 同じ なまえ）
const SET_LABEL = {
  sea: 'balanceBlocksSea', animal: 'balanceBlocksAnimal', bird: 'balanceBlocksBird', fresh: 'balanceBlocksFresh',
  insect: 'balanceBlocksInsect', deep: 'balanceBlocksDeep', dino: 'balanceBlocksDino', pref: 'balanceBlocksPref', world: 'balanceBlocksWorld',
};

// 描いた 絵を まっくろな かげに する。すきとおった はね（セミ・トンボ）の ところも こい かげに して、
// かげの 中に 脈が すけて 見えない ように する（v0.19.1。ヒントに なって しまうため）。
// 1問に 1回だけ（毎フレームでは ない）なので getImageData でも 重く ならない
const SHADOW_RGB = [0x2f, 0x2a, 0x26]; // かげの 色（まっくろより すこし やわらかく。#2f2a26）
function solidShadow(g, W, H) {
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // うすい ところは 4ばい こく（はねは まっくろ、りんかくの なめらかさは のこす）
    d[i] = SHADOW_RGB[0];
    d[i + 1] = SHADOW_RGB[1];
    d[i + 2] = SHADOW_RGB[2];
    d[i + 3] = Math.min(255, d[i + 3] * 4);
  }
  g.putImageData(img, 0, 0);
}

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const set = GUESS_SETS.includes(config.set) ? config.set : 'sea';
  const difficulty = Object.prototype.hasOwnProperty.call(DIFFICULTY, config.difficulty) ? config.difficulty : 'easy';
  const rule = DIFFICULTY[difficulty];
  const strict = rule.strict; // しょうぶ（むずかしい いじょう）
  const pieceSet = PIECE_SETS[set];
  // v0.19.0: ずかん画が ある なかま（むし）は ずかん画で 出す（別冊05）。読みこむ までは スタートを 待つ
  // v0.19.1: ずかん画は むずかしい・おとな だけ。かんたん・ふつうは バランスゲームと 同じ つみきの 絵（ずかんも べつ）
  const book = bookOf(difficulty);
  const zukanKey = ZUKAN_KEYS[book];
  const needsZukanArt = book === 'hard' && hasZukanArt(set);
  let zset = null;
  // 絵: { minX, minY, w, h, pad, draw(ctx) }。ずかん画が なければ いままでの つみきの 絵
  function artOf(id) {
    if (zset) return zset.art(id);
    const piece = pieceSet.pieces[id];
    const box = boundsOf(piece);
    return { minX: box.minX, minY: box.minY, w: box.w, h: box.h, pad: piece.pad ?? 8, draw: (c) => piece.draw(c, piece) };
  }
  function nameOf(id) {
    return zset ? zset.name(id) : pieceSet.names[id];
  }

  let state = null;
  let phase = 'idle'; // idle | call | ask | done | result
  let rafId = 0;
  let revealStart = 0;   // かげが うすく なりはじめた 時刻（0 = まだ）
  let dissolveStart = 0; // サーっと とけはじめた 時刻（0 = まだ）
  let dissolveFrom = 0;  // とけはじめた ときの 見えぐあい
  let tiles = [];        // { x, y, w, h, t, delay }
  let limitTimer = 0;    // 時間ぎれの タイマー（しょうぶ）
  let newInZukan = 0;    // この ラウンドで ずかんに のった かず
  let completedZukan = false;

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearLimit() {
    if (!limitTimer) return;
    clearTimeout(limitTimer);
    timers.delete(limitTimer);
    limitTimer = 0;
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-guess';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner kgb-guess-banner';

  const stage = document.createElement('div');
  stage.className = 'kgb-guess-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-guess-canvas';
  const callEl = document.createElement('p');
  callEl.className = 'kgb-guess-call';
  callEl.textContent = text.guessCall;
  const nameEl = document.createElement('p');
  nameEl.className = 'kgb-guess-name';
  const nextHint = document.createElement('span');
  nextHint.className = 'kgb-guess-next-hint';
  nextHint.textContent = text.ewNext;
  // 左右の「？」: 色ちがいで かわりばんこに 大きく・小さく（あせりの 演出。CSS animation。v0.18.2 から どの むずかしさでも）
  const qLeft = document.createElement('span');
  qLeft.className = 'kgb-guess-q is-left';
  qLeft.textContent = '?';
  qLeft.setAttribute('aria-hidden', 'true');
  const qRight = document.createElement('span');
  qRight.className = 'kgb-guess-q is-right';
  qRight.textContent = '?';
  qRight.setAttribute('aria-hidden', 'true');
  stage.append(canvas, qLeft, qRight, nameEl, nextHint);

  // 時間の バー（しょうぶ）: CSS transition の scaleX で へっていく
  const timerBar = document.createElement('div');
  timerBar.className = 'kgb-guess-timer';
  timerBar.hidden = !strict;
  const timerFill = document.createElement('div');
  timerFill.className = 'kgb-guess-timer-fill';
  timerBar.append(timerFill);

  const statusEl = document.createElement('p');
  statusEl.className = 'kgb-guess-status';

  const choices = document.createElement('div');
  choices.className = 'kgb-guess-choices';
  const choiceEls = [];
  for (let i = 0; i < OPTIONS; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kgb-guess-choice';
    button.dataset.index = i;
    choices.append(button);
    choiceEls.push(button);
  }

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'kgb-guess-next';
  nextButton.textContent = text.ewNext;
  nextButton.classList.add('is-off'); // ばしょは はじめから とっておく（こたえあわせで 絵が ちぢまない ように。v0.18.4）

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  startTitle.textContent = text.readyTitle;
  // 「タップして スタート」は オレンジの ボタンに（どこを おしたら よいか 子どもに わかる ように。v0.19.2）。
  // ボタンの ほかの ばしょを おしても スタートする（ずかんの ボタンは のぞく）。おすと 下の startOverlay の click で はじまる
  const startSub = document.createElement('button');
  startSub.type = 'button';
  startSub.className = 'kgb-guess-start';
  startSub.textContent = text.handoverTap;
  const startZukan = document.createElement('button');
  startZukan.type = 'button';
  startZukan.className = 'kgb-guess-zukan-open';
  startOverlay.append(startTitle, startSub, startZukan);

  const zukanOverlay = document.createElement('div');
  zukanOverlay.className = 'kgb-guess-zukan';
  zukanOverlay.hidden = true;

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  // よびかけは 絵の 上に かさねず、上の「○/10もんめ」に かさねる（かげが かくれない ように。v0.19.1）
  container.append(banner, stage, timerBar, statusEl, choices, nextButton, callEl);
  root.append(container, startOverlay, resultOverlay, zukanOverlay);

  // ---------- キャンバス（オフスクリーンは 最初に 作って 使いまわす） ----------

  const ctx = canvas.getContext('2d');
  const colorCanvas = document.createElement('canvas');  // もとの 絵
  const shadowCanvas = document.createElement('canvas'); // 黒い かげ
  const overlayCanvas = document.createElement('canvas'); // かげ から 見えた マスを 消した もの（毎フレーム）
  const smallCanvas = document.createElement('canvas');  // モザイク用の 小さい 絵
  const colorCtx = colorCanvas.getContext('2d');
  const shadowCtx = shadowCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');
  const smallCtx = smallCanvas.getContext('2d');
  let dpr = 1;
  let lastBlock = 0;

  // 1問ごとに 1回: キャンバスの 大きさを あわせ、もとの 絵と かげを 描いて とっておく
  function preparePicture(id) {
    const art = artOf(id);
    dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    const cw = canvas.clientWidth || 300;
    const ch = canvas.clientHeight || 230;
    const W = Math.round(cw * dpr);
    const H = Math.round(ch * dpr);
    for (const c of [canvas, colorCanvas, shadowCanvas, overlayCanvas]) {
      c.width = W;
      c.height = H;
    }
    const box = art;
    const pad = art.pad;
    const fullW = box.w + pad * 2;
    const fullH = box.h + pad * 2;
    // 小さい 国も 大きい 子も キャンバスに あわせて 同じくらいの 大きさに 描く。
    // 下の すみに「？」と 名前を 出すので、絵は 下を すこし あけて 上よりに（v0.18.3）
    const band = ch * BOTTOM_BAND;
    const scale = Math.min((cw * FIT) / fullW, ((ch - band) * 0.92) / fullH) * dpr;
    const cx = box.minX + box.w / 2;
    const cy = box.minY + box.h / 2;
    const midY = ((ch - band) / 2) * dpr;
    colorCtx.setTransform(1, 0, 0, 1, 0, 0);
    colorCtx.clearRect(0, 0, W, H);
    colorCtx.setTransform(scale, 0, 0, scale, W / 2 - cx * scale, midY - cy * scale);
    art.draw(colorCtx);
    colorCtx.setTransform(1, 0, 0, 1, 0, 0);

    shadowCtx.globalCompositeOperation = 'source-over';
    shadowCtx.clearRect(0, 0, W, H);
    shadowCtx.drawImage(colorCanvas, 0, 0);
    solidShadow(shadowCtx, W, H);

    // かげを おおう はんい（絵の はこ）を GRID×GRID の マスに わける
    const x0 = W / 2 - (fullW / 2) * scale;
    const y0 = midY - (fullH / 2) * scale;
    const tw = (fullW * scale) / GRID;
    const th = (fullH * scale) / GRID;
    const times = tileRevealTimes(GRID * GRID, state.rng);
    tiles = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        tiles.push({
          x: Math.floor(x0 + c * tw), y: Math.floor(y0 + r * th), w: Math.ceil(tw) + 1, h: Math.ceil(th) + 1,
          t: times[r * GRID + c],
          // サーっと とける ときは 上の マスから じゅんに（すこし ばらつかせる）
          delay: (r / (GRID - 1)) * 0.55 + state.rng() * 0.15,
        });
      }
    }
    lastBlock = 0;
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // 1フレームぶん 描く。progress = 見えぐあい、dissolve = とけぐあい（null = まだ とけていない）
  function drawFrame(progress, dissolve) {
    const W = canvas.width;
    const H = canvas.height;
    const eased = dissolve === null ? progress : dissolveFrom + (1 - dissolveFrom) * (1 - (1 - dissolve) ** 2);
    ctx.clearRect(0, 0, W, H);
    // 下の 絵: モザイク（ます目は だんだん こまかく）
    const block = Math.max(1, Math.round(mosaicSize(eased) * dpr));
    if (block > 1) {
      const sw = Math.max(1, Math.ceil(W / block));
      const sh = Math.max(1, Math.ceil(H / block));
      if (block !== lastBlock) {
        smallCanvas.width = sw;
        smallCanvas.height = sh;
        smallCtx.imageSmoothingEnabled = true;
        smallCtx.clearRect(0, 0, sw, sh);
        smallCtx.drawImage(colorCanvas, 0, 0, sw, sh);
        lastBlock = block;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(smallCanvas, 0, 0, sw, sh, 0, 0, sw * block, sh * block);
      ctx.imageSmoothingEnabled = true;
      // モザイクの マスが かげの 外に はみ出さない ように、もとの 絵の かたちで きりぬく（りんかくは くっきり）
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(colorCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.drawImage(colorCanvas, 0, 0);
    }
    // 上の かげ: 見えた マスを 消す
    overlayCtx.globalCompositeOperation = 'source-over';
    overlayCtx.globalAlpha = 1;
    overlayCtx.clearRect(0, 0, W, H);
    overlayCtx.drawImage(shadowCanvas, 0, 0);
    overlayCtx.globalCompositeOperation = 'destination-out';
    let covered = false;
    for (const tile of tiles) {
      let a = clamp01((progress - tile.t) / TILE_FADE);
      if (dissolve !== null) a = Math.max(a, clamp01((dissolve - tile.delay) / 0.3));
      if (a >= 1) {
        overlayCtx.globalAlpha = 1;
        overlayCtx.fillRect(tile.x, tile.y, tile.w, tile.h);
      } else {
        covered = true;
        if (a > 0) {
          overlayCtx.globalAlpha = a;
          overlayCtx.fillRect(tile.x, tile.y, tile.w, tile.h);
        }
      }
    }
    overlayCtx.globalAlpha = 1;
    overlayCtx.globalCompositeOperation = 'source-over';
    if (covered) ctx.drawImage(overlayCanvas, 0, 0);
    return !covered && block === 1;
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const progress = revealStart ? revealProgress(now - revealStart, state.revealMs) : 0;
    const dissolve = dissolveStart ? clamp01((now - dissolveStart) / DISSOLVE_MS) : null;
    const finished = drawFrame(progress, dissolve);
    // すっかり 見えたら 止める（とけおわり、または 時間いっぱいで 見えきった とき）
    if (dissolve !== null ? dissolve >= 1 : finished || progress >= 1) {
      drawFrame(1, null);
      stopLoop();
      if (phase === 'ask') setStatus(text.guessLook); // こたえる まえに 見えきった
    }
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  // ---------- 表示の差分更新 ----------

  function updateBanner() {
    const counter = `${state.questionIndex} / ${QUESTIONS_PER_ROUND}${text.ewQuestionSuffix}`;
    banner.textContent = strict ? `${counter}　${text.ewCorrectLabel} ${state.scores[0]}` : counter;
  }

  // ---------- 時間の バーと「？」（しょうぶ） ----------

  function resetHurry() {
    stage.classList.remove('is-hurry', 'is-gentle', 'is-last');
    timerBar.classList.remove('is-last');
    timerFill.style.transition = 'none';
    timerFill.style.transform = 'scaleX(1)';
  }

  // 左右の「？」を 出す（よびかけと 同時。v0.18.3）。どの むずかしさでも 出す（v0.18.2）。
  // かんたん・ふつうは ゆっくり やさしく、しょうぶは はやく
  function showQuestionMarks() {
    stage.classList.add('is-hurry');
    if (!strict) stage.classList.add('is-gentle');
  }

  // 時間の バー（しょうぶ）: 見えはじめと 同時に へりはじめる
  function startHurry() {
    if (!strict) return;
    void timerFill.getBoundingClientRect(); // transition の リセットを 確定させる
    timerFill.style.transition = `transform ${rule.limitMs}ms linear`;
    timerFill.style.transform = 'scaleX(0)';
    later(() => {
      if (phase !== 'ask') return;
      stage.classList.add('is-last');
      timerBar.classList.add('is-last');
    }, rule.limitMs - HURRY_LAST_MS);
    limitTimer = later(onTimeUp, rule.limitMs);
  }

  // こたえが きまったら 止める（バーは その 位置で とめる。1回だけ 位置を 読む）
  function stopHurry() {
    clearLimit();
    stage.classList.remove('is-hurry', 'is-gentle', 'is-last');
    if (!strict) return;
    const rect = timerFill.getBoundingClientRect();
    const full = timerBar.getBoundingClientRect().width || 1;
    timerFill.style.transition = 'none';
    timerFill.style.transform = `scaleX(${Math.min(rect.width / full, 1)})`;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function renderChoices(q) {
    for (let i = 0; i < OPTIONS; i++) {
      const button = choiceEls[i];
      const name = nameOf(q.options[i]);
      button.textContent = name;
      // ながい 名前（「リュウグウノツカイ」「パプアニューギニア」など）は 文字を 小さく
      button.className = `kgb-guess-choice${name.length >= 9 ? ' is-long' : name.length >= 7 ? ' is-mid' : ''}`;
      button.disabled = false;
    }
  }

  // ---------- 出題の流れ ----------

  // タップ起点で呼ぶこと（iOSの読み上げ制約）
  function askQuestion() {
    const q = nextQuestion(state);
    if (!q) return;
    stopLoop();
    phase = 'call';
    revealStart = 0;
    dissolveStart = 0;
    updateBanner();
    renderChoices(q);
    nameEl.textContent = '';
    nameEl.classList.remove('is-on');
    stage.classList.remove('is-pop', 'is-done');
    nextButton.classList.add('is-off');
    setStatus('');
    clearLimit();
    resetHurry();
    preparePicture(q.answer);
    drawFrame(0, null); // まっくろな かげ
    callEl.classList.add('is-on');
    showQuestionMarks();
    sayJa(text.guessCallSpeak);
    later(() => {
      if (phase !== 'call' && phase !== 'ask') return;
      callEl.classList.remove('is-on');
      if (phase === 'call') phase = 'ask';
      revealStart = performance.now();
      startLoop();
      startHurry();
    }, CALL_MS);
  }

  function handleChoice(index) {
    if (phase !== 'ask' && phase !== 'call') return;
    const now = performance.now();
    const elapsed = revealStart ? now - revealStart : 0;
    const result = answerAt(state, index, elapsed);
    if (!result.ok) return;
    const button = choiceEls[index];
    if (!result.correct && !result.final) {
      // まちがい（かんたん・ふつう）: その ボタンを 灰色に（えらびなおせる。かげは そのまま 見えつづける）
      button.classList.add('is-wrong');
      button.disabled = true;
      playFlutter();
      setStatus(text.guessWrong);
      return;
    }
    if (!result.correct) {
      // まちがい（しょうぶ）: その問題は おわり。正解を 見せて つぎへ
      button.classList.add('is-wrong');
      playFlutter();
      endQuestion(result, now, elapsed, `${text.guessAnswerIs}${nameOf(state.current.answer)}${text.guessAnswerSuffix}`);
      return;
    }
    button.classList.add('is-correct');
    playMatch();
    if (result.early) emitPraise('early_guess');
    let message = result.early ? text.guessEarly : text.guessCorrect;
    if (result.collect && recordZukan(state.current.answer)) message = `${message}　${text.guessZukanNew}`;
    endQuestion(result, now, elapsed, message);
  }

  // 時間ぎれ（しょうぶ）: その問題は おわり。正解を 見せて つぎへ
  function onTimeUp() {
    limitTimer = 0;
    if (phase !== 'ask') return;
    const result = timeUp(state);
    if (!result.ok) return;
    playFlutter();
    const now = performance.now();
    endQuestion(result, now, now - revealStart, `${text.guessTimeUp}${text.guessAnswerIs}${nameOf(state.current.answer)}${text.guessAnswerSuffix}`);
  }

  // 問題の おわり（正解・まちがい・時間ぎれ 共通）: のこりの かげを サーっと とかして 名前を 出す
  function endQuestion(result, now, elapsed, message) {
    const q = state.current;
    phase = 'done';
    stopHurry();
    callEl.classList.remove('is-on');
    for (const b of choiceEls) b.disabled = true;
    if (q.winner === null) choiceEls[q.correctIndex].classList.add('is-reveal'); // 正解の ボタンを おしえる
    // のこりの かげを サーっと とかす（見えはじめる 前に こたえても 同じ）
    dissolveFrom = revealStart ? revealProgress(elapsed, state.revealMs) : 0;
    if (!revealStart) revealStart = now;
    dissolveStart = now;
    startLoop();
    const name = nameOf(q.answer);
    nameEl.textContent = `${name}！`;
    nameEl.classList.add('is-on');
    stage.classList.add('is-pop');
    sayJa(name);
    setStatus(message);
    updateBanner();
    if (result.roundOver) {
      later(finishGame, ROUND_END_MS);
      return;
    }
    later(() => {
      stage.classList.add('is-done');
      nextButton.classList.remove('is-off');
    }, NEXT_WAIT_MS);
  }

  // ---------- ずかん（v0.18.1） ----------

  function loadZukan() {
    return loadStats().guess?.[zukanKey] ?? {};
  }

  // この ずかんの ぜんぶ（ずかん画の なかまは ずかん画の しゅるい。v0.19.1）
  function zukanList() {
    return zset ? zset.ids : zukanAll(set);
  }

  // 1かいめで 正解した 子を ずかんに 入れる。新しい ときだけ 保存（イベントの 区切り。§9）
  function recordZukan(id) {
    const stats = loadStats();
    stats.guess ??= { plays: 0 };
    const result = addToZukan(stats.guess[zukanKey] ?? {}, set, id, zukanList());
    if (!result.isNew) return false;
    stats.guess[zukanKey] = result.zukan;
    saveStats(stats);
    newInZukan += 1;
    if (result.complete) completedZukan = true;
    return true;
  }

  function zukanButtonLabel() {
    const { found, total } = zukanProgress(loadZukan(), set, zukanList());
    return `${text.guessZukan}  ${found} / ${total}`;
  }

  // ずかんの 1まいの 絵（見つけた 子は いろ、まだの 子は 黒い かげ）
  function drawThumb(id, found) {
    const art = artOf(id);
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
    const c = document.createElement('canvas');
    c.className = 'kgb-guess-zukan-pic';
    c.width = THUMB * ratio;
    c.height = THUMB * ratio;
    const g = c.getContext('2d');
    const box = art;
    const pad = art.pad;
    const scale = Math.min(THUMB / (box.w + pad * 2), THUMB / (box.h + pad * 2)) * 0.92 * ratio;
    g.setTransform(scale, 0, 0, scale, c.width / 2 - (box.minX + box.w / 2) * scale, c.height / 2 - (box.minY + box.h / 2) * scale);
    art.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!found) solidShadow(g, c.width, c.height);
    return c;
  }

  // ずかんを ひらく（ひらいた ときに 作る。とじたら すてる）。画面は zukanView.js（v0.19.3）。
  // むずかしい・おとなの ずかん画の ずかんは なかまタブと 詳細ページ つき、かんたん・ふつうの ずかんは 一覧だけ
  function openZukan() {
    const found = new Set(loadZukan()[set] ?? []);
    const ids = zukanList();
    let tabs = null;
    let detail = null;
    let allSections = null;
    if (zset) {
      // タブ＝目（こうちゅう・チョウ…）、タブの 中の 見出し＝科（カブトムシの なかま…）。図鑑と 同じ 2だん（v0.19.4）
      const idsOfGroup = (g) => ids.filter((id) => zset.species[id].group === g);
      tabs = zset.orders
        .map((o) => {
          const sections = o.groups.map((g) => ({ label: zset.groupName(g), ids: idsOfGroup(g) })).filter((x) => x.ids.length);
          return { key: o.key, label: zset.orderName(o.key), ids: sections.flatMap((x) => x.ids), sections };
        })
        .filter((t) => t.ids.length > 0);
      allSections = tabs.map((t) => ({ label: t.label, ids: t.ids }));
      detail = (id) => {
        const info = zset.info(id);
        const sp = zset.species[id];
        if (!info || !sp) return null;
        return {
          name: info.name, groupLabel: `${zset.orderName(zset.orderOf(sp.group))} ／ ${zset.groupName(sp.group)}`, size: info.size, where: info.where,
          marks: info.marks, points: sp.marks ?? [], similar: sp.similar ?? [], art: zset.art(id),
          // ぶんるい（v0.19.5）: 目・科・属・しゅ（図鑑と 同じ じゅん）
          tax: [
            [text.guessZukanTaxOrder, `${zset.taxOrderName(zset.orderOf(sp.group))}${text.guessZukanTaxOrder}`],
            [text.guessZukanTaxFamily, `${info.family}${text.guessZukanTaxFamily}`],
            [text.guessZukanTaxGenus, `${info.genus}${text.guessZukanTaxGenus}`],
            [text.guessZukanTaxSpecies, info.name],
          ],
        };
      };
    }
    openZukanView(zukanOverlay, {
      title: `${text[SET_LABEL[set]]} ${text.guessZukan}`,
      bookLabel: book === 'hard' ? text.guessZukanBookHard : text.guessZukanBookEasy,
      note: book === 'hard' ? text.guessZukanNoteHard : text.guessZukanNoteEasy,
      ids, found, tabs, allSections, detail,
      nameOf,
      thumb: drawThumb,
      onTap: playTap,
      signal: abort.signal,
    });
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame() {
    phase = 'result';
    stopLoop();
    stopHurry();
    emitPraise('finished_game');
    if (state.firstTryCorrect === QUESTIONS_PER_ROUND) emitPraise('all_first_try');
    recordPlay('guess');
    const score = state.scores[0];
    let title;
    let detail;
    let celebrate = true; // かんたん・ふつうは 10問 さいごまで できたら いつでも おいわい
    if (strict) {
      title = `${score} / ${QUESTIONS_PER_ROUND} ${text.guessScoreSuffix}`; // 「3 / 10 せいかい！」（みじかく）
      if (completedZukan) detail = text.guessZukanComplete;
      else if (newInZukan > 0) detail = `${text.guessZukanAdded}${newInZukan}${text.guessZukanAddedSuffix}`;
      else detail = text.playAgainTone;
      celebrate = score >= 7 || newInZukan > 0;
    } else {
      title = `${QUESTIONS_PER_ROUND}${text.guessResultSuffix}`;
      detail = state.early > 0 ? `${text.guessEarlyLabel} ${state.early}${text.guessTimesSuffix}` : text.playAgainTone;
    }
    showResult(resultOverlay, {
      title,
      detail,
      celebrate,
      signal: abort.signal,
      onReplay: () => {
        playTap();
        restart();
      },
      onHome: () => {
        playTap();
        onExit();
      },
    });
    // ずかんを 見る ボタン（結果の ボタンの ならびに たす）
    const zukanButton = document.createElement('button');
    zukanButton.type = 'button';
    zukanButton.className = 'kgb-dialog-button kgb-guess-zukan-result';
    zukanButton.textContent = zukanButtonLabel();
    zukanButton.addEventListener('click', () => {
      playTap();
      openZukan();
    }, { signal: abort.signal });
    resultOverlay.querySelector('.kgb-dialog-buttons')?.after(zukanButton);
  }

  function restart() {
    clearAllTimers();
    stopLoop();
    cancelSpeech();
    hideResult(resultOverlay);
    resetPraise();
    state = createGame({ set, difficulty });
    phase = 'idle';
    revealStart = 0;
    dissolveStart = 0;
    newInZukan = 0;
    completedZukan = false;
    clearLimit();
    resetHurry();
    startZukan.textContent = zukanButtonLabel();
    for (const b of choiceEls) {
      b.textContent = '';
      b.className = 'kgb-guess-choice';
      b.disabled = true;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    nameEl.textContent = '';
    nameEl.classList.remove('is-on');
    callEl.classList.remove('is-on');
    stage.classList.remove('is-pop', 'is-done');
    nextButton.classList.add('is-off');
    setStatus('');
    updateBanner();
    startOverlay.hidden = false;
  }

  // ---------- 入力 ----------

  startZukan.addEventListener('click', (event) => {
    event.stopPropagation(); // スタートの タップに しない
    playTap();
    openZukan();
  }, { signal: abort.signal });

  startOverlay.addEventListener('click', () => {
    if (phase !== 'idle') return;
    if (needsZukanArt && !zset) return; // ずかん画を 読みこみ中（ふつうは 一しゅん）
    playTap();
    startOverlay.hidden = true;
    askQuestion(); // タップ内で よびかけを 鳴らす
  }, { signal: abort.signal });

  function goNext() {
    if (phase !== 'done') return;
    playTap();
    askQuestion();
  }
  nextButton.addEventListener('click', goNext, { signal: abort.signal });
  stage.addEventListener('click', () => {
    if (phase === 'done' && !nextButton.classList.contains('is-off')) goNext();
  }, { signal: abort.signal });

  choices.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-guess-choice');
    if (!button || button.disabled) return;
    handleChoice(Number(button.dataset.index));
  }, { signal: abort.signal });

  restart();
  if (needsZukanArt) {
    loadZukanSet(set).then((z) => {
      if (abort.signal.aborted) return; // 読みこむ まえに 画面を とじた
      zset = z;
      startZukan.textContent = zukanButtonLabel(); // ずかん画の しゅるいの かずで かぞえなおす
    });
  }

  return {
    destroy() {
      clearAllTimers(); // §9: 画面遷移時にタイマー・rAF・読み上げを必ず解除
      limitTimer = 0;
      stopLoop();
      cancelSpeech();
      abort.abort();
      root.replaceChildren();
    },
  };
}
