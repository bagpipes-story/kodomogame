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

// ボタンタップ音
export function playTap() {
  playTone(880, 0.08, 'triangle');
}

// 無効操作音（「ぶぶー」）
export function playBuzzer() {
  playTone(160, 0.25, 'square', 0.1);
}
