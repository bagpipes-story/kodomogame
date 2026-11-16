// ui.js — なまえあての描画・入力（v0.18）
// まんなかに 黒い かげ。時間が たつと マスごとに かげが うすく なり、下から モザイクの 絵が 見えて くる
// （モザイクは だんだん こまかく なり、さいごは もとの 絵）。下の 4つから 名前を えらぶ。
// 早く あてると のこりの かげが 上から サーっと とけて、くっきりした 絵に なる。
// 性能規定（§9）:
// - 絵は 1問ごとに 1回だけ オフスクリーンに 描いて とっておく（毎フレームは コピーと マスの 消しこみだけ）
// - 毎フレーム 書きかえるのは まんなかの キャンバスだけ。見えて くる あいだ／とける あいだ だけ rAF を 回し、おわったら 止める
// - えらぶ ボタンは 4つを 最初に 作って 使いまわす（テキストと class の 差分更新のみ）
// - 記録の 保存は さいごの 1回だけ（recordPlay）
// iOSの制約: 読み上げは タップを きっかけに 鳴らす（スタート／つぎ！／こたえの タップの 中で sayJa）。

import {
  QUESTIONS_PER_ROUND,
  OPTIONS,
  GUESS_SETS,
  createGame,
  nextQuestion,
  answerAt,
  revealProgress,
  tileRevealTimes,
  mosaicSize,
} from './game.js';
import { PIECE_SETS } from '../balance/pieceSets.js';
import { boundsOf } from '../balance/kit.js';
import { text } from '../../i18n.js';
import { playTap, playMatch, playFlutter } from '../../sound.js';
import { sayJa, cancelSpeech } from '../../speech.js';
import { resetPraise, emitPraise, recordPlay } from '../../praise.js';
import { showResult, hideResult } from '../../resultView.js';

const CALL_MS = 1400;      // 「おなまえ な〜んだ？」を 見せてから かげが うすく なりはじめる まで
const DISSOLVE_MS = 900;   // 正解で のこりの かげが サーっと とける 時間
const TILE_FADE = 0.07;    // マス1つが うすく なる 長さ（見えて くる 時間の わりあい）
const GRID = 9;            // かげを 9×9 の マスに わける
const NEXT_WAIT_MS = 900;  // 正解の あと「つぎ！」を 出すまで
const ROUND_END_MS = 1500; // さいごの 問題の あと 結果を 出すまで
const SHADOW = '#2f2a26';  // かげの 色（まっくろより すこし やわらかく）
const FIT = 0.84;          // 絵を キャンバスの 何わりの 大きさに 描くか

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const set = GUESS_SETS.includes(config.set) ? config.set : 'sea';
  const difficulty = config.difficulty ?? 'easy';
  const pieceSet = PIECE_SETS[set];

  let state = null;
  let phase = 'idle'; // idle | call | ask | done | result
  let rafId = 0;
  let revealStart = 0;   // かげが うすく なりはじめた 時刻（0 = まだ）
  let dissolveStart = 0; // サーっと とけはじめた 時刻（0 = まだ）
  let dissolveFrom = 0;  // とけはじめた ときの 見えぐあい
  let tiles = [];        // { x, y, w, h, t, delay }

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
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
  stage.append(canvas, callEl, nameEl, nextHint);

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
  nextButton.hidden = true;

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  startTitle.textContent = text.readyTitle;
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
  startSub.textContent = text.handoverTap;
  startOverlay.append(startTitle, startSub);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, stage, statusEl, choices, nextButton);
  root.append(container, startOverlay, resultOverlay);

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
    const piece = pieceSet.pieces[id];
    dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    const cw = canvas.clientWidth || 300;
    const ch = canvas.clientHeight || 230;
    const W = Math.round(cw * dpr);
    const H = Math.round(ch * dpr);
    for (const c of [canvas, colorCanvas, shadowCanvas, overlayCanvas]) {
      c.width = W;
      c.height = H;
    }
    const box = boundsOf(piece);
    const pad = piece.pad ?? 8;
    const fullW = box.w + pad * 2;
    const fullH = box.h + pad * 2;
    // 小さい 国も 大きい 子も キャンバスに あわせて 同じくらいの 大きさに 描く
    const scale = Math.min((cw * FIT) / fullW, (ch * FIT) / fullH) * dpr;
    const cx = box.minX + box.w / 2;
    const cy = box.minY + box.h / 2;
    colorCtx.setTransform(1, 0, 0, 1, 0, 0);
    colorCtx.clearRect(0, 0, W, H);
    colorCtx.setTransform(scale, 0, 0, scale, W / 2 - cx * scale, H / 2 - cy * scale);
    piece.draw(colorCtx, piece);
    colorCtx.setTransform(1, 0, 0, 1, 0, 0);

    shadowCtx.globalCompositeOperation = 'source-over';
    shadowCtx.clearRect(0, 0, W, H);
    shadowCtx.drawImage(colorCanvas, 0, 0);
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = SHADOW;
    shadowCtx.fillRect(0, 0, W, H);
    shadowCtx.globalCompositeOperation = 'source-over';

    // かげを おおう はんい（絵の はこ）を GRID×GRID の マスに わける
    const x0 = W / 2 - (fullW / 2) * scale;
    const y0 = H / 2 - (fullH / 2) * scale;
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
    banner.textContent = `${state.questionIndex} / ${QUESTIONS_PER_ROUND}${text.ewQuestionSuffix}`;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function renderChoices(q) {
    for (let i = 0; i < OPTIONS; i++) {
      const button = choiceEls[i];
      const name = pieceSet.names[q.options[i]];
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
    nextButton.hidden = true;
    setStatus('');
    preparePicture(q.answer);
    drawFrame(0, null); // まっくろな かげ
    callEl.classList.add('is-on');
    sayJa(text.guessCallSpeak);
    later(() => {
      if (phase !== 'call' && phase !== 'ask') return;
      callEl.classList.remove('is-on');
      if (phase === 'call') phase = 'ask';
      revealStart = performance.now();
      startLoop();
    }, CALL_MS);
  }

  function handleChoice(index) {
    if (phase !== 'ask' && phase !== 'call') return;
    const q = state.current;
    const now = performance.now();
    const elapsed = revealStart ? now - revealStart : 0;
    const result = answerAt(state, index, elapsed);
    if (!result.ok) return;
    const button = choiceEls[index];
    if (!result.correct) {
      // まちがい: その ボタンを 灰色に（えらびなおせる。かげは そのまま 見えつづける）
      button.classList.add('is-wrong');
      button.disabled = true;
      playFlutter();
      setStatus(text.guessWrong);
      return;
    }
    phase = 'done';
    callEl.classList.remove('is-on');
    button.classList.add('is-correct');
    for (const b of choiceEls) b.disabled = true;
    playMatch();
    // のこりの かげを サーっと とかす（見えはじめる 前に あてても 同じ）
    dissolveFrom = revealStart ? revealProgress(elapsed, state.revealMs) : 0;
    if (!revealStart) revealStart = now;
    dissolveStart = now;
    startLoop();
    const name = pieceSet.names[q.answer];
    nameEl.textContent = `${name}！`;
    nameEl.classList.add('is-on');
    stage.classList.add('is-pop');
    sayJa(name);
    if (result.early) emitPraise('early_guess');
    setStatus(result.early ? text.guessEarly : text.guessCorrect);
    updateBanner();
    if (result.roundOver) {
      later(finishGame, ROUND_END_MS);
      return;
    }
    later(() => {
      stage.classList.add('is-done');
      nextButton.hidden = false;
    }, NEXT_WAIT_MS);
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame() {
    phase = 'result';
    stopLoop();
    emitPraise('finished_game');
    if (state.firstTryCorrect === QUESTIONS_PER_ROUND) emitPraise('all_first_try');
    recordPlay('guess');
    const detail = state.early > 0
      ? `${text.guessEarlyLabel} ${state.early}${text.guessTimesSuffix}`
      : text.playAgainTone;
    showResult(resultOverlay, {
      title: `${QUESTIONS_PER_ROUND}${text.guessResultSuffix}`,
      detail,
      celebrate: true, // 10問 さいごまで できたら いつでも おいわい
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
    nextButton.hidden = true;
    setStatus('');
    updateBanner();
    startOverlay.hidden = false;
  }

  // ---------- 入力 ----------

  startOverlay.addEventListener('click', () => {
    if (phase !== 'idle') return;
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
    if (phase === 'done' && !nextButton.hidden) goNext();
  }, { signal: abort.signal });

  choices.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-guess-choice');
    if (!button || button.disabled) return;
    handleChoice(Number(button.dataset.index));
  }, { signal: abort.signal });

  restart();

  return {
    destroy() {
      clearAllTimers(); // §9: 画面遷移時にタイマー・rAF・読み上げを必ず解除
      stopLoop();
      cancelSpeech();
      abort.abort();
      root.replaceChildren();
    },
  };
}
