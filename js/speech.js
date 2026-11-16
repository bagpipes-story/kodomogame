// speech.js — 英語音声（別冊04§2.2）と 日本語の よびかけ（v0.18 なまえあて: 「おなまえ な〜んだ？」・こたえの 名前）
// 方針: 同梱音声（assets/audio/en/<id>.mp3）があればそれを再生、なければ
// iPhone内蔵の読み上げ（Web Speech API）。ゲーム側は say('apple') だけ呼ぶ。
// iOSの制約: speak()はタップ等のユーザー操作の中でしか鳴らない → 出題音声はタップ起点で呼ぶこと。
// 外部への通信は一切しない（読み上げは端末内蔵・オフライン動作）。
// ミュート（sound.js）中は同梱音声も読み上げも鳴らさない。

import { isMuted } from './sound.js';

const AUDIO_IDS = new Set(); // フェーズ2で同梱音声を追加したらここにidを登録する
const RATE = 0.8;            // 子ども向けにゆっくり
const LANG = 'en-US';

let voice = null;
let jaVoice = null; // 日本語（v0.18）
let voicesLoaded = false;

function synth() {
  return globalThis.speechSynthesis ?? null;
}

// en-USの端末内蔵（localService）音声を優先して選ぶ
function pickVoice() {
  const s = synth();
  if (!s) return;
  const voices = s.getVoices();
  if (!voices.length) return;
  voicesLoaded = true;
  const japanese = voices.filter((v) => /^ja[-_]/i.test(v.lang));
  jaVoice = japanese.find((v) => v.localService) ?? japanese[0] ?? null;
  const english = voices.filter((v) => /^en[-_]/i.test(v.lang));
  voice =
    english.find((v) => v.lang.replace('_', '-') === LANG && v.localService) ??
    english.find((v) => v.localService) ??
    english.find((v) => v.lang.replace('_', '-') === LANG) ??
    english[0] ??
    null;
}

if (synth()) {
  pickVoice();
  synth().addEventListener?.('voiceschanged', pickVoice);
  // バックグラウンドに回ると再生が止まる。復帰時にキャンセルして詰まりを解消（別冊04§2.2）
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') cancelSpeech();
  });
}

// 英語音声が使えるか。声リストがまだ読めていない段階では「使える」扱い（実際に鳴らして確かめる）
export function hasEnglishVoice() {
  if (!synth()) return false;
  if (!voicesLoaded) return true;
  return voice !== null;
}

// 単語id（words.js）または任意の英文を読み上げる。終了時にresolve（鳴らせない環境でも即resolve）
export function say(textOrId) {
  return new Promise((resolve) => {
    if (isMuted()) {
      resolve();
      return;
    }
    if (AUDIO_IDS.has(textOrId)) {
      try {
        const audio = new Audio(`assets/audio/en/${textOrId}.mp3`);
        audio.addEventListener('ended', () => resolve(), { once: true });
        audio.addEventListener('error', () => resolve(), { once: true });
        audio.play().catch(() => resolve());
        return;
      } catch {
        resolve();
        return;
      }
    }
    const s = synth();
    if (!s || !hasEnglishVoice()) {
      resolve();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(textOrId);
      utter.lang = LANG;
      utter.rate = RATE;
      if (voice) utter.voice = voice;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      utter.addEventListener('end', done);
      utter.addEventListener('error', done);
      s.speak(utter);
      // 端末によってendが来ないことがあるので保険（単語1つは2秒あれば読み終わる）
      setTimeout(done, Math.max(1500, textOrId.length * 120 + 800));
    } catch {
      resolve();
    }
  });
}

// 日本語の よびかけ（v0.18）。こたえの 名前（ひらがな・カタカナ）や「おなまえ なーんだ？」を 読む。
// 日本語の 声が ない 端末では 鳴らさずに すぐ resolve（文字の 表示だけで あそべる）
export function sayJa(phrase) {
  return new Promise((resolve) => {
    const s = synth();
    if (isMuted() || !s || (voicesLoaded && !jaVoice)) {
      resolve();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'ja-JP';
      utter.rate = 0.95;
      utter.pitch = 1.15; // こどもに よびかける ように すこし たかく
      if (jaVoice) utter.voice = jaVoice;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      utter.addEventListener('end', done);
      utter.addEventListener('error', done);
      s.speak(utter);
      setTimeout(done, Math.max(1500, phrase.length * 200 + 800));
    } catch {
      resolve();
    }
  });
}

export function cancelSpeech() {
  try {
    synth()?.cancel();
  } catch {
    // 止められなくてもゲームは続ける
  }
}
