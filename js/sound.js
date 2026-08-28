// sound.js — 効果音・ミュート管理（v0.1: 基盤のみ）
// v0.1はWeb Audioのオシレーターで簡易音を鳴らす。音声ファイル同梱は後のバージョンで検討。
// ミュート状態はstorage.js経由で保存する。

import { loadSettings, saveSettings } from './storage.js';

let audioContext = null;
let muted = loadSettings().muted;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  const settings = loadSettings();
  settings.muted = muted;
  saveSettings(settings); // 書き込みはイベント区切り（切替時）のみ
  return muted;
}

// AudioContextはユーザー操作後でないとiOSで動かないため、初回再生時に遅延生成する
function getContext() {
  if (!audioContext) {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    audioContext = new Ctx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// 単音を短く鳴らす共通処理。失敗しても無視（音はゲーム進行に必須ではない）
function playTone(frequency, durationSec, type = 'sine', volume = 0.15) {
  if (muted) return;
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    // プツッというノイズを防ぐため音量を指数減衰させる
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  } catch {
    // 音が鳴らなくてもゲームは止めない
  }
}

// 複数の音を時間差で鳴らす（メロディ用）。notes: [{freq, at, dur}]
// setTimeoutではなくWeb Audioのスケジューラを使う（タイマー管理を不要にするため）
function playNotes(notes, type = 'triangle', volume = 0.15) {
  if (muted) return;
  try {
    const ctx = getContext();
    const start = ctx.currentTime;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(volume, start + note.at);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.at + note.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + note.at);
      osc.stop(start + note.at + note.dur);
    }
  } catch {
    // 音が鳴らなくてもゲームは止めない
  }
}

// ボタンタップ音
export function playTap() {
  playTone(880, 0.08, 'triangle');
}

// 無効操作音（「ぶぶー」）
export function playBuzzer() {
  playTone(160, 0.25, 'square', 0.1);
}

// 石・カードを置く音
export function playPlace() {
  playTone(330, 0.07, 'triangle', 0.14);
}

// カードをめくる音
export function playFlip() {
  playTone(660, 0.06, 'triangle', 0.12);
}

// ペア一致音（上がる2音）
export function playMatch() {
  playNotes([
    { freq: 523, at: 0, dur: 0.1 },
    { freq: 784, at: 0.1, dur: 0.18 },
  ]);
}

// 手番交代音
export function playTurn() {
  playTone(440, 0.09, 'sine', 0.1);
}

// 勝利ファンファーレ（ドミソド）
export function playWin() {
  playNotes([
    { freq: 523, at: 0, dur: 0.14 },
    { freq: 659, at: 0.14, dur: 0.14 },
    { freq: 784, at: 0.28, dur: 0.14 },
    { freq: 1047, at: 0.42, dur: 0.4 },
  ]);
}
