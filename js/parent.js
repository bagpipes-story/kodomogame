// parent.js — ペアレンタルゲート＋保護者画面「せいちょうきろく」（v0.16。仕様§3.4-3）
// 入口はホームの小さな「おうちのかたへ」。かんたんな たし算を数字キーで入力（不正解は静かに閉じる）。
// 内容: ①6つの力の回数 ②声かけヒント ③ほんもので遊ぶコツ ④設定（きゅうけい・えいごカテゴリ・名前スロット）⑤記録リセット
// すべてアプリ内テキストで完結（外部リンクなし）。文言は大人向けなので漢字あり（i18n.jsのparentText）。

import { parentText, games } from './i18n.js';
import { loadSettings, saveSettings, loadStats, resetStats } from './storage.js';
import { CATEGORIES } from './words.js';
import { SLOT_COUNT, NAME_MAX_LENGTH, getPlayers, saveSlots } from './players.js';
import { playTap, playBuzzer, playMatch } from './sound.js';

const SKILL_KEYS = ['memoryPower', 'thinkPower', 'numberLetter', 'shapeBalance', 'heartPower', 'english'];
const STAR_PER = 5;
const MAX_STARS = 10;

// ---------- ペアレンタルゲート ----------

// root にゲートを描く。正解なら onPass()、不正解なら onFail()（静かに閉じる）
export function renderGate(root, { onPass, onFail, signal }) {
  const a = 3 + Math.floor(Math.random() * 7); // 3〜9
  const b = 2 + Math.floor(Math.random() * 8); // 2〜9
  const answer = a + b;
  let input = '';

  const wrap = document.createElement('div');
  wrap.className = 'kgb-gate';
  const title = document.createElement('p');
  title.className = 'kgb-gate-title';
  title.textContent = parentText.gateTitle;
  const question = document.createElement('p');
  question.className = 'kgb-gate-question';
  question.textContent = `${a} + ${b} = ?`;
  const prompt = document.createElement('p');
  prompt.className = 'kgb-gate-prompt';
  prompt.textContent = parentText.gatePrompt;
  const display = document.createElement('p');
  display.className = 'kgb-gate-display';
  display.textContent = '_';

  const pad = document.createElement('div');
  pad.className = 'kgb-gate-pad';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', parentText.gateClear, '0', parentText.gateOk];
  for (const key of keys) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kgb-gate-key';
    button.textContent = key;
    button.dataset.key = key;
    pad.append(button);
  }
  wrap.append(title, question, prompt, display, pad);
  root.replaceChildren(wrap);

  pad.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-gate-key');
    if (!button) return;
    const key = button.dataset.key;
    playTap();
    if (key === parentText.gateClear) {
      input = '';
    } else if (key === parentText.gateOk) {
      if (Number(input) === answer) {
        playMatch();
        onPass();
      } else {
        playBuzzer();
        onFail();
      }
      return;
    } else if (input.length < 2) {
      input += key;
    }
    display.textContent = input || '_';
  }, { signal });
}

// ---------- 保護者画面 ----------

function section(titleText) {
  const sec = document.createElement('section');
  sec.className = 'kgb-parent-section';
  const h = document.createElement('h3');
  h.className = 'kgb-parent-heading';
  h.textContent = titleText;
  sec.append(h);
  return sec;
}

function note(textContent) {
  const p = document.createElement('p');
  p.className = 'kgb-parent-note';
  p.textContent = textContent;
  return p;
}

function buildRecord() {
  const stats = loadStats();
  const sec = section(parentText.recordTitle);
  sec.append(note(parentText.recordNote));
  const list = document.createElement('div');
  list.className = 'kgb-skill-list';
  for (const key of SKILL_KEYS) {
    const count = stats.skills?.[key] ?? 0;
    const row = document.createElement('div');
    row.className = 'kgb-skill-row';
    const name = document.createElement('span');
    name.className = 'kgb-skill-name';
    name.textContent = parentText.skills[key].name;
    const desc = document.createElement('span');
    desc.className = 'kgb-skill-desc';
    desc.textContent = parentText.skills[key].desc;
    const stars = document.createElement('span');
    stars.className = 'kgb-skill-stars';
    stars.textContent = '★'.repeat(Math.min(MAX_STARS, Math.floor(count / STAR_PER)));
    const num = document.createElement('span');
    num.className = 'kgb-skill-count';
    num.textContent = `${count}${parentText.playsSuffix}`;
    row.append(name, desc, stars, num);
    list.append(row);
  }
  const stamps = document.createElement('p');
  stamps.className = 'kgb-parent-note';
  stamps.textContent = `${parentText.stampsLabel}: ${stats.stamps ?? 0}`;
  sec.append(list, stamps);
  return sec;
}

function buildHints() {
  const sec = section(parentText.hintsTitle);
  sec.append(note(parentText.hintsNote));
  const dl = document.createElement('dl');
  dl.className = 'kgb-hint-list';
  for (const game of games) {
    const hint = parentText.hints[game.id];
    if (!hint) continue;
    const dt = document.createElement('dt');
    dt.textContent = `${game.icon} ${game.name}`;
    const dd = document.createElement('dd');
    dd.textContent = hint;
    dl.append(dt, dd);
  }
  sec.append(dl);
  return sec;
}

function buildRealTips() {
  const sec = section(parentText.realTitle);
  const ul = document.createElement('ul');
  ul.className = 'kgb-parent-list';
  for (const tip of parentText.realTips) {
    const li = document.createElement('li');
    li.textContent = tip;
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

function buildSettings(signal) {
  const sec = section(parentText.settingsTitle);
  const settings = loadSettings();

  // きゅうけいリマインダー
  const breakLabel = document.createElement('p');
  breakLabel.className = 'kgb-parent-label';
  breakLabel.textContent = parentText.breakLabel;
  const breakRow = document.createElement('div');
  breakRow.className = 'kgb-option-row';
  for (const [value, label] of parentText.breakOptions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kgb-option-button';
    button.dataset.value = value;
    button.textContent = label;
    button.classList.toggle('is-selected', String(settings.breakMinutes ?? 30) === value);
    breakRow.append(button);
  }
  breakRow.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-option-button');
    if (!button) return;
    playTap();
    const current = loadSettings();
    current.breakMinutes = Number(button.dataset.value);
    saveSettings(current);
    for (const el of breakRow.children) el.classList.toggle('is-selected', el === button);
  }, { signal });
  sec.append(breakLabel, breakRow, note(parentText.breakNote));

  // えいごの出題カテゴリ（1つ以上残す）
  const wordsLabel = document.createElement('p');
  wordsLabel.className = 'kgb-parent-label';
  wordsLabel.textContent = parentText.wordsLabel;
  const catRow = document.createElement('div');
  catRow.className = 'kgb-option-row is-grid-3';
  for (const cat of CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kgb-option-button';
    button.dataset.cat = cat;
    button.textContent = parentText.wordCategories[cat];
    button.classList.toggle('is-selected', (settings.wordCategories ?? CATEGORIES).includes(cat));
    catRow.append(button);
  }
  catRow.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-option-button');
    if (!button) return;
    const current = loadSettings();
    const set = new Set(current.wordCategories ?? CATEGORIES);
    if (set.has(button.dataset.cat)) {
      if (set.size <= 1) {
        playBuzzer(); // 全部オフにはできない
        return;
      }
      set.delete(button.dataset.cat);
    } else {
      set.add(button.dataset.cat);
    }
    playTap();
    current.wordCategories = CATEGORIES.filter((c) => set.has(c));
    saveSettings(current);
    button.classList.toggle('is-selected', set.has(button.dataset.cat));
  }, { signal });
  sec.append(wordsLabel, catRow, note(parentText.voiceNote));
  return sec;
}

function buildNames(signal) {
  const sec = section(parentText.namesTitle);
  sec.append(note(parentText.namesNote));
  const { slots } = getPlayers();
  const form = document.createElement('div');
  form.className = 'kgb-name-list';
  const inputs = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const row = document.createElement('label');
    row.className = 'kgb-name-row';
    const num = document.createElement('span');
    num.className = 'kgb-name-num';
    num.textContent = String(i + 1);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'kgb-name-input';
    input.maxLength = NAME_MAX_LENGTH;
    input.placeholder = parentText.namePlaceholder;
    input.autocomplete = 'off';
    input.value = slots[i];
    row.append(num, input);
    form.append(row);
    inputs.push(input);
  }
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'kgb-parent-button';
  save.textContent = parentText.namesSave;
  const saved = document.createElement('p');
  saved.className = 'kgb-parent-note';
  save.addEventListener('click', () => {
    playTap();
    saveSlots(inputs.map((el) => el.value.trim()));
    saved.textContent = parentText.namesSaved;
  }, { signal });
  sec.append(form, save, saved);
  return sec;
}

function buildReset(signal, refresh) {
  const sec = section(parentText.resetTitle);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kgb-parent-button is-danger';
  button.textContent = parentText.resetButton;
  const done = document.createElement('p');
  done.className = 'kgb-parent-note';
  button.addEventListener('click', () => {
    playTap();
    // eslint-disable-next-line no-alert
    if (!globalThis.confirm(parentText.resetConfirm)) return;
    resetStats();
    done.textContent = parentText.resetDone;
    refresh();
  }, { signal });
  sec.append(button, done);
  return sec;
}

// root に保護者画面を描く。戻るはヘッダー側（app.js）
export function renderParent(root, { signal }) {
  function draw() {
    const wrap = document.createElement('div');
    wrap.className = 'kgb-parent';
    wrap.append(
      buildRecord(),
      buildHints(),
      buildRealTips(),
      buildSettings(signal),
      buildNames(signal),
      buildReset(signal, draw),
    );
    root.replaceChildren(wrap);
  }
  draw();
}

