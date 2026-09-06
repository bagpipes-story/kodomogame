// speech.js — 英語音声（別冊04§2.2）
// 方針: 同梱音声（assets/audio/en/<id>.mp3）があればそれを再生、なければ
// iPhone内蔵の読み上げ（Web Speech API）。ゲーム側は say('apple') だけ呼ぶ。
// iOSの制約: speak()はタップ等のユーザー操作の中でしか鳴らない → 出題音声はタップ起点で呼ぶこと。
// 外部への通信は一切しない（読み上げは端末内蔵・オフライン動作）。

const AUDIO_IDS = new Set(); // フェーズ2で同梱音声を追加したらここにidを登録する
const RATE = 0.8;            // 子ども向けにゆっくり
const LANG = 'en-US';

let voice = null;
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

export function cancelSpeech() {
  try {
    synth()?.cancel();
  } catch {
    // 止められなくてもゲームは続ける
  }
}
