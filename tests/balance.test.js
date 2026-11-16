// balance.test.js — バランスゲームの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/balance.test.js

import assert from 'node:assert';
import {
  BLOCK_LIMIT,
  BLOCK_MAX,
  ACTIVE_LIMIT,
  activeLimitOf,
  continueRun,
  SHAPES,
  DIFFICULTY,
  createGame,
  nextShape,
  dropStarted,
  confirmPlaced,
  collapse,
  FIELD,
  fieldOf,
  BLOCK_SETS,
  shapesFor,
} from '../js/games/balance/game.js';
import { SEA_PIECES } from '../js/games/balance/sea.js';
import { ANIMAL_PIECES } from '../js/games/balance/animal.js';
import { BIRD_PIECES } from '../js/games/balance/bird.js';
import { FRESH_PIECES } from '../js/games/balance/fresh.js';
import { INSECT_PIECES } from '../js/games/balance/insect.js';
import { DEEP_PIECES } from '../js/games/balance/deep.js';
import { DINO_PIECES } from '../js/games/balance/dino.js';
import { PREF_PIECES } from '../js/games/balance/pref.js';
import { WORLD_PIECES } from '../js/games/balance/world.js';
import { isConvex, boundsOf, buildPieceBody, dampSpin, stepPhysics, PHYSICS_SUBSTEPS } from '../js/games/balance/kit.js';
import { readFileSync } from 'node:fs';
import { text } from '../js/i18n.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ---------- 難易度のかたちセット ----------

{
  assert.deepStrictEqual(DIFFICULTY.easy, ['square', 'rect'], 'かんたんは四角のみ');
  assert.ok(DIFFICULTY.normal.includes('circle'), 'ふつうは丸が入る');
  assert.ok(DIFFICULTY.hard.includes('triangle') && DIFFICULTY.hard.includes('lshape'), 'むずかしいは三角・L字入り');
  for (const keys of Object.values(DIFFICULTY)) {
    for (const key of keys) assert.ok(SHAPES[key], `かたち${key}の定義がある`);
  }
  assert.strictEqual(BLOCK_LIMIT, 30, '上限30個（性能規定）');
}

// ---------- おとな: 床2倍・かたち10しゅ（v0.17.10） ----------

{
  const adult = DIFFICULTY.adult;
  for (const key of DIFFICULTY.hard) assert.ok(adult.includes(key), `おとなは むずかしいの${key}も出る`);
  for (const key of ['star', 'diamond', 'hexagon', 'trapezoid', 'semicircle']) {
    assert.ok(adult.includes(key), `おとなは${key}が出る`);
  }
  assert.strictEqual(new Set(adult).size, adult.length, 'かたちの重複なし');
  assert.strictEqual(fieldOf('adult').platformRatio, 2, 'おとなは床の幅2倍');
  assert.strictEqual(fieldOf('hard').platformRatio, 1.1, 'むずかしいまでは1.1倍（v0.17.15）');
  assert.strictEqual(fieldOf('unknown'), FIELD.easy, '知らない難易度はかんたん扱い');
  assert.deepStrictEqual(createGame({ difficulty: 'unknown' }).shapes, DIFFICULTY.easy);
  // 縮めて描いたとき、床が画面のはば（盤の54%×倍率×縮尺）の9割以内に収まる
  for (const [key, field] of Object.entries(FIELD)) {
    const onScreen = 0.54 * field.platformRatio * field.viewScale;
    assert.ok(onScreen <= 0.9, `${key}: 床が画面に収まる (${onScreen.toFixed(2)})`);
  }
  // かたちの名前は全部 i18n にあり、ひらがな・カタカナだけ
  for (const key of Object.keys(SHAPES)) {
    const name = text.shapes[key];
    assert.ok(name && /^[ぁ-んァ-ヶー]+$/.test(name), `${key}の名前「${name}」はかなだけ`);
  }
  const state = createGame({ difficulty: 'adult', rng: makeRng([0.99]) });
  assert.strictEqual(nextShape(state), 'semicircle', 'おとなの末尾のかたちも出る');
}

// ---------- 次のかたちはrngで決まる ----------

{
  const state = createGame({ difficulty: 'hard', rng: makeRng([0.0, 0.99, 0.5]) });
  assert.strictEqual(nextShape(state), 'square', 'rng=0で先頭');
  assert.strictEqual(nextShape(state), 'lshape', 'rng=0.99で末尾');
}

// ---------- ひとり: スコアと30こクリア ----------

{
  const state = createGame({ difficulty: 'easy', mode: 'solo' });
  for (let i = 1; i < BLOCK_LIMIT; i++) {
    dropStarted(state);
    const result = confirmPlaced(state);
    assert.strictEqual(result.placed, i);
    assert.strictEqual(result.cleared, false);
  }
  dropStarted(state);
  const last = confirmPlaced(state);
  assert.strictEqual(last.placed, 30);
  assert.strictEqual(last.cleared, true, '30こでクリア');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(confirmPlaced(state).ok, false, '終了後は積めない');
}

// ---------- 30こクリアのあと「つづけて つむ」（v0.17.11） ----------

{
  assert.ok(ACTIVE_LIMIT <= 30, '動くブロックは30こまで（性能規定）');
  // おとなは 2ばい（v0.17.41）: 下の ほうが すぐ 固定されると くずれなく なり かんたん すぎた
  for (const d of ['easy', 'normal', 'hard']) assert.strictEqual(activeLimitOf(d), ACTIVE_LIMIT, `${d} は 30こ`);
  assert.strictEqual(activeLimitOf('adult'), ACTIVE_LIMIT * 2, 'おとなは 60こ');
  assert.strictEqual(activeLimitOf('toString'), ACTIVE_LIMIT, 'へんな なまえは 30こ');
  const place = (state) => { dropStarted(state); return confirmPlaced(state); };
  const state = createGame({ mode: 'solo' });
  assert.strictEqual(continueRun(state), false, 'クリア前は つづけられない（遊んでいる途中）');
  for (let i = 0; i < BLOCK_LIMIT; i++) place(state);
  assert.ok(state.finished && state.cleared, '30こでクリアの区切り');
  assert.strictEqual(continueRun(state), true, 'つづけて つむ');
  assert.strictEqual(state.finished, false);
  assert.strictEqual(state.endless, true);
  assert.strictEqual(continueRun(state), false, '2回目の つづける はない');
  const r31 = place(state);
  assert.strictEqual(r31.placed, 31, '31こめから数えつづける');
  assert.strictEqual(state.finished, false, '31こでは終わらない');
  const c = collapse(state);
  assert.strictEqual(c.placed, 31, '崩れたら積めた数が きろく');
  assert.strictEqual(state.cleared, true, 'クリアした事実は残る');

  // こうたい: 手番は続き、崩した人の負け
  const two = createGame({ mode: 'two' });
  for (let i = 0; i < BLOCK_LIMIT; i++) place(two);
  continueRun(two);
  assert.strictEqual(two.currentPlayer, 0, '30こ（偶数）のあとは あか の番');
  place(two);
  dropStarted(two); // あお が落として崩れた
  assert.strictEqual(collapse(two).loser, 1);

  // 上限 BLOCK_MAX で終わり
  const big = createGame({ mode: 'solo' });
  for (let i = 0; i < BLOCK_LIMIT; i++) place(big);
  continueRun(big);
  let last;
  while (!big.finished) last = place(big);
  assert.strictEqual(last.placed, BLOCK_MAX);
  assert.strictEqual(big.maxed, true, `${BLOCK_MAX}こで積みきり`);
  assert.strictEqual(confirmPlaced(big).ok, false);
}

// ---------- ひとり: 崩れたら終了（スコアは積めた数のまま） ----------

{
  const state = createGame({ mode: 'solo' });
  dropStarted(state);
  confirmPlaced(state);
  dropStarted(state);
  const result = collapse(state); // 2個目が落ちた
  assert.strictEqual(result.placed, 1, 'スコアは確定済みの1個');
  assert.strictEqual(result.loser, null, 'ひとりプレイに負けはない');
  assert.strictEqual(state.finished, true);
}

// ---------- こうたい: 手番交代と「崩した方が負け」 ----------

{
  const state = createGame({ mode: 'two' });
  assert.strictEqual(state.currentPlayer, 0, 'あかから');
  dropStarted(state);
  confirmPlaced(state);
  assert.strictEqual(state.currentPlayer, 1, '交代してあお');
  dropStarted(state);
  assert.strictEqual(state.lastPlacer, 1, '落とした責任者はあお');
  const result = collapse(state); // あおのブロックで崩れた
  assert.strictEqual(result.loser, 1, '崩したあおの負け');

  // あかが崩すパターン
  const state2 = createGame({ mode: 'two' });
  dropStarted(state2);
  confirmPlaced(state2); // あか→あお
  dropStarted(state2);
  confirmPlaced(state2); // あお→あか
  dropStarted(state2);
  assert.strictEqual(collapse(state2).loser, 0, '崩したあかの負け');
}

// ---------- うみの いきもの つみき（v0.17.12） ----------

{
  // 「かたち」はいままでどおり（つみき未指定・知らない値もかたち）
  assert.deepStrictEqual(createGame({ difficulty: 'hard' }).shapes, DIFFICULTY.hard);
  assert.deepStrictEqual(shapesFor('shape', 'adult'), DIFFICULTY.adult);
  assert.deepStrictEqual(shapesFor('???', 'easy'), DIFFICULTY.easy);
  assert.deepStrictEqual(shapesFor('sea', '???'), BLOCK_SETS.sea.easy, '知らない難易度は かんたん');

  const sea = BLOCK_SETS.sea;
  assert.deepStrictEqual(createGame({ difficulty: 'normal', blocks: 'sea' }).shapes, sea.normal);
  assert.strictEqual(sea.adult.length, 30, 'おとなは30しゅ ぜんぶ');
  assert.strictEqual(Object.keys(SEA_PIECES).length, 30);
  assert.strictEqual(new Set(sea.adult).size, 30, 'かさならない');
  // v0.17.13・v0.17.16 で各難易度に2しゅずつ増えた（かんたん8・ふつう16・むずかしい24・おとな30）
  assert.deepStrictEqual(['easy', 'normal', 'hard'].map((d) => sea[d].length), [8, 16, 24]);
  // かならず入れる しゅるい（v0.17.13・v0.17.16・v0.17.18 の注文。さかな は りゅうぐうのつかい に入れかえた）
  assert.ok(!sea.adult.includes('fish') && !sea.adult.includes('shrimp'), 'さかな・えび は もう出ない');
  for (const id of ['eel', 'seahare', 'seahorse', 'moray', 'seabream', 'horsemackerel', 'saury', 'salmon', 'lobster', 'tuna', 'oarfish']) {
    assert.ok(sea.adult.includes(id), `${id} がいる`);
  }
  // うみは どの難易度も床1.2倍（形が図形より複雑なため）。かたちは今までどおり
  // v0.17.15: うみは おとな以外1.404倍（1.56倍から10%短く）・おとな2.4倍。かたちは おとな以外1.1倍・おとな2倍
  for (const d of ['easy', 'normal', 'hard', 'adult']) {
    const want = d === 'adult' ? [2.4, 2] : [1.56 * 0.9, 1.1];
    assert.ok(Math.abs(fieldOf(d, 'sea').platformRatio - want[0]) < 1e-9, `${d}: うみの床は${want[0]}倍`);
    assert.ok(Math.abs(fieldOf(d, 'shape').platformRatio - want[1]) < 1e-9, `${d}: かたちの床は${want[1]}倍`);
    const f = fieldOf(d, 'sea');
    assert.ok(0.54 * f.platformRatio * f.viewScale <= 0.9, `${d}: うみの床が画面に収まる`);
  }
  assert.strictEqual(fieldOf('hard', 'shape').platformRatio, 1.1);
  // 難易度が上がるほど顔ぶれが増える（前の難易度の子はぜんぶ残る）
  const order = ['easy', 'normal', 'hard', 'adult'];
  for (let i = 1; i < order.length; i++) {
    const prev = sea[order[i - 1]];
    const cur = sea[order[i]];
    assert.ok(cur.length > prev.length, `${order[i]} は ${order[i - 1]} より多い`);
    for (const id of prev) assert.ok(cur.includes(id), `${order[i]} にも ${id}`);
  }

  // どうぶつ（v0.17.21）: うみ と同じ つくり（30しゅ・かんたん8／ふつう16／むずかしい24／おとな30・床も同じ）
  const animal = BLOCK_SETS.animal;
  assert.deepStrictEqual(createGame({ difficulty: 'hard', blocks: 'animal' }).shapes, animal.hard);
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => animal[d].length), [8, 16, 24, 30]);
  assert.strictEqual(Object.keys(ANIMAL_PIECES).length, 30);
  assert.strictEqual(new Set(animal.adult).size, 30, 'どうぶつが かさならない');
  for (const d of ['easy', 'normal', 'hard', 'adult']) {
    assert.deepStrictEqual(fieldOf(d, 'animal'), fieldOf(d, 'sea'), `${d}: どうぶつの床は うみと同じ`);
    for (const id of animal[d === 'easy' ? 'easy' : d]) assert.ok(animal.adult.includes(id));
  }
  for (let i = 1; i < 4; i++) {
    const order2 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of animal[order2[i - 1]]) assert.ok(animal[order2[i]].includes(id), `どうぶつ ${order2[i]} にも ${id}`);
  }

  // とり（v0.17.23）: うみ・どうぶつ と同じ つくり。ユーザー指定の30しゅが ぜんぶ いる（v0.17.25 で 18しゅ ふえて 48しゅ）
  const bird = BLOCK_SETS.bird;
  assert.deepStrictEqual(createGame({ difficulty: 'normal', blocks: 'bird' }).shapes, bird.normal);
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => bird[d].length), [13, 26, 38, 48]);
  assert.strictEqual(Object.keys(BIRD_PIECES).length, 48);
  assert.strictEqual(new Set(bird.adult).size, 48, 'とりが かさならない');
  const wantBirds = ['すずめ', 'からす', 'コサギ', 'チュウサギ', 'ダイサギ', 'アオサギ', 'アマサギ', 'ゴイサギ', 'シギ', 'カワウ',
    'チドリ', 'カルガモ', 'オオバン', 'ユリカモメ', 'カワセミ', 'メジロ', 'ムクドリ', 'シジュウカラ', 'コアジサシ', 'ツノメドリ',
    'エトピリカ', 'オオフウチョウ', 'クジャク', 'トキ', 'ハシビロコウ', 'フラミンゴ', 'ライチョウ', 'ハゲワシ', 'オオタカ', 'ツル',
    // v0.17.25（たのまれた19しゅの うち キジは 2かい あったので 18しゅ）
    'シマエナガ', 'ハクセキレイ', 'オシドリ', 'カイツブリ', 'ハクチョウ', 'キジ', 'キツツキ', 'フクロウ', 'ルリビタキ', 'ヤマセミ',
    'アカショウビン', 'ブッポウソウ', 'ヤンバルクイナ', 'ヤマドリ', 'ペリカン', 'ヒクイドリ', 'キーウィ', 'ニワトリ'];
  assert.deepStrictEqual(bird.adult.map((id) => text.birds[id]).sort(), [...wantBirds].sort(), 'たのまれた とり 48しゅ');
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'bird'), fieldOf(d, 'sea'), `${d}: とりの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order3 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of bird[order3[i - 1]]) assert.ok(bird[order3[i]].includes(id), `とり ${order3[i]} にも ${id}`);
  }

  // たんすいの いきもの（v0.17.28）: たのまれた26しゅ＋4しゅ＝30しゅ。うみ と同じ つくり
  const fresh = BLOCK_SETS.fresh;
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => fresh[d].length), [8, 16, 24, 30]);
  assert.strictEqual(Object.keys(FRESH_PIECES).length, 30);
  assert.strictEqual(new Set(fresh.adult).size, 30, 'たんすいの いきものが かさならない');
  const wantFresh = ['オオサンショウウオ', 'アカハライモリ', 'ヤマメ', 'アマゴ', 'イワナ', 'イトウ', 'オショロコマ', 'ニジマス', 'コイ', 'アユ',
    'オイカワ', 'フナ', 'イワトコナマズ', 'サワガニ', 'スッポン', 'イシガメ', 'ウナギ', 'ドジョウ', 'ウグイ', 'ヨシノボリ',
    'カジカ', 'タガメ', 'ゲンゴロウ', 'ヤツメウナギ', 'モリアオガエル', 'アロワナ'];
  for (const name of wantFresh) assert.ok(fresh.adult.some((id) => text.fresh[id] === name), `たのまれた ${name} がいる`);
  // v0.17.29: タニシを けして シジミに いれかえ（たのまれた いれかえ）
  assert.ok(fresh.adult.some((id) => text.fresh[id] === 'シジミ'), 'シジミが いる');
  assert.ok(!Object.values(text.fresh).includes('タニシ'), 'タニシは もう いない');
  assert.strictEqual(FRESH_PIECES.eel, SEA_PIECES.eel, 'ウナギは うみと 同じ絵');
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'fresh'), fieldOf(d, 'sea'), `${d}: たんすいの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order4 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of fresh[order4[i - 1]]) assert.ok(fresh[order4[i]].includes(id), `たんすい ${order4[i]} にも ${id}`);
  }

  // むし（v0.17.31）: たのまれた12しゅ＋18しゅ＝30しゅ。うみ と同じ つくり
  const insect = BLOCK_SETS.insect;
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => insect[d].length), [8, 16, 24, 30]);
  assert.strictEqual(Object.keys(INSECT_PIECES).length, 30);
  assert.strictEqual(new Set(insect.adult).size, 30, 'むしが かさならない');
  const wantInsects = ['カブトムシ', 'オオクワガタ', 'ヒラタクワガタ', 'ノコギリクワガタ', 'オニヤンマ', 'アキアカネ', 'ルリボシカミキリ',
    'タマムシ', 'トノサマバッタ', 'アブラゼミ', 'ツクツクボウシ', 'ナナフシ'];
  for (const name of wantInsects) assert.ok(insect.adult.some((id) => text.insects[id] === name), `たのまれた ${name} がいる`);
  for (const name of ['ゴキブリ', 'ハエ', 'カ', 'ガ', 'カメムシ', 'ダンゴムシ', 'ムカデ', 'クモ', 'アリ']) {
    assert.ok(!Object.values(text.insects).includes(name), `いやがられやすい ${name} は いない`);
  }
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'insect'), fieldOf(d, 'sea'), `${d}: むしの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order5 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of insect[order5[i - 1]]) assert.ok(insect[order5[i]].includes(id), `むし ${order5[i]} にも ${id}`);
  }

  // しんかいの いきもの（v0.17.34）: たのまれた6しゅ＋24しゅ＝30しゅ。うみ と同じ つくり（積みやすさは かんがえない）
  const deep = BLOCK_SETS.deep;
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => deep[d].length), [8, 16, 24, 30]);
  assert.strictEqual(Object.keys(DEEP_PIECES).length, 30);
  assert.strictEqual(new Set(deep.adult).size, 30, 'しんかいの いきものが かさならない');
  for (const name of ['シーラカンス', 'リュウグウノツカイ', 'ヨコヅナイワシ', 'チョウチンアンコウ', 'タカアシガニ', 'ダイオウイカ']) {
    assert.ok(deep.adult.some((id) => text.deep[id] === name), `たのまれた ${name} がいる`);
  }
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'deep'), fieldOf(d, 'sea'), `${d}: しんかいの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order6 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of deep[order6[i - 1]]) assert.ok(deep[order6[i]].includes(id), `しんかい ${order6[i]} にも ${id}`);
  }

  // きょうりゅう（v0.17.38）: ほんとうの きょうりゅう 30しゅ。うみ と同じ つくり（積みやすさより リアルさ）
  const dino = BLOCK_SETS.dino;
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => dino[d].length), [8, 16, 24, 30]);
  assert.strictEqual(Object.keys(DINO_PIECES).length, 30);
  assert.strictEqual(new Set(dino.adult).size, 30, 'きょうりゅうが かさならない');
  for (const name of ['ティラノサウルス', 'トリケラトプス', 'ステゴサウルス', 'ブラキオサウルス', 'ヴェロキラプトル']) {
    assert.ok(dino.adult.some((id) => text.dinos[id] === name), `ゆうめいな ${name} がいる`);
  }
  for (const name of ['プテラノドン', 'フタバスズキリュウ', 'モササウルス']) assert.ok(!Object.values(text.dinos).includes(name), `きょうりゅう では ない ${name} は いない`);
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'dino'), fieldOf(d, 'sea'), `${d}: きょうりゅうの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order7 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of dino[order7[i - 1]]) assert.ok(dino[order7[i]].includes(id), `きょうりゅう ${order7[i]} にも ${id}`);
  }
  // とどうふけん（v0.17.40）: 47都道府県。ほんものの 地図の かたち。うみ と同じ床
  const pref = BLOCK_SETS.pref;
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => pref[d].length), [12, 24, 36, 47]);
  assert.strictEqual(Object.keys(PREF_PIECES).length, 47);
  assert.strictEqual(new Set(pref.adult).size, 47, 'とどうふけんが かさならない');
  assert.strictEqual(Object.keys(text.prefs).length, 47);
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'pref'), fieldOf(d, 'sea'), `${d}: とどうふけんの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order8 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of pref[order8[i - 1]]) assert.ok(pref[order8[i]].includes(id), `とどうふけん ${order8[i]} にも ${id}`);
  }
  // 大きさの じゅんばんは ほんとうと 同じ（北海道が いちばん 大きく、香川・大阪・東京は 岩手より ずっと 小さい）
  const areaOf = (id) => PREF_PIECES[id].parts.reduce((sum, part) => {
    let a = 0;
    for (let i = 0; i < part.points.length; i++) {
      const p = part.points[i];
      const q = part.points[(i + 1) % part.points.length];
      a += p.x * q.y - q.x * p.y;
    }
    return sum + Math.abs(a) / 2;
  }, 0);
  for (const id of Object.keys(PREF_PIECES)) if (id !== 'hokkaido') assert.ok(areaOf('hokkaido') > areaOf(id) * 2, `北海道は ${id} より 大きい`);
  for (const id of ['kagawa', 'osaka', 'tokyo']) assert.ok(areaOf('iwate') > areaOf(id) * 1.5, `岩手は ${id} より 大きい`);
  // かんたんにも 北の はし（北海道）と 南の はし（沖縄）が いる
  assert.ok(pref.easy.includes('hokkaido') && pref.easy.includes('okinawa'));
  // せかいのくに（v0.17.42。v0.17.45 で 90）:かたちは メルカトル、大きさは ほんとうの 面積の じゅん。うみ と同じ床
  const world = BLOCK_SETS.world;
  assert.deepStrictEqual(['easy', 'normal', 'hard', 'adult'].map((d) => world[d].length), [15, 30, 60, 90]);
  assert.strictEqual(Object.keys(WORLD_PIECES).length, 90);
  assert.strictEqual(new Set(world.adult).size, 90, 'せかいのくにが かさならない');
  assert.strictEqual(Object.keys(text.countries).length, 90);
  for (const d of ['easy', 'normal', 'hard', 'adult']) assert.deepStrictEqual(fieldOf(d, 'world'), fieldOf(d, 'sea'), `${d}: せかいのくにの床は うみと同じ`);
  for (let i = 1; i < 4; i++) {
    const order9 = ['easy', 'normal', 'hard', 'adult'];
    for (const id of world[order9[i - 1]]) assert.ok(world[order9[i]].includes(id), `せかいのくに ${order9[i]} にも ${id}`);
  }
  assert.ok(world.easy.includes('japan'), 'かんたんに にほん');
  assert.ok(world.adult.includes('palau') && !world.adult.includes('paraguay'), 'パラグアイの かわりに パラオ（v0.17.46）');
  const worldArea = (id) => WORLD_PIECES[id].parts.reduce((sum, part) => {
    let a = 0;
    for (let i = 0; i < part.points.length; i++) {
      const p = part.points[i];
      const q = part.points[(i + 1) % part.points.length];
      a += p.x * q.y - q.x * p.y;
    }
    return sum + Math.abs(a) / 2;
  }, 0);
  // 大きさの じゅんは ほんとうの 面積と 同じ（ロシアが いちばん 大きい・小さい 国は 大きい 国より 小さい）
  for (const id of Object.keys(WORLD_PIECES)) if (id !== 'russia') assert.ok(worldArea('russia') > worldArea(id), `ロシアは ${id} より 大きい`);
  for (const id of Object.keys(WORLD_PIECES)) if (id !== 'palau') assert.ok(worldArea(id) > worldArea('palau'), `パラオが いちばん 小さい（${id} より）`);
  assert.ok(worldArea('russia') > worldArea('belgium') * 15, '大きさの ちがいが はっきり（ロシアは ベルギーの 15ばい いじょうの 広さに 見える）');
  // 小さい 国も 小さすぎない（v0.17.45: オランダ などが 小さすぎたので 面積の 0.28→0.24じょうに）
  for (const id of ['netherlands', 'belgium', 'switzerland', 'denmark', 'estonia', 'bhutan']) {
    const b = boundsOf(WORLD_PIECES[id]);
    assert.ok(Math.max(b.w, b.h) >= 20, `${id} が 小さすぎない（${b.w.toFixed(0)}x${b.h.toFixed(0)}）`);
  }
  for (const [big, small] of [['china', 'japan'], ['japan', 'southKorea'], ['brazil', 'argentina'], ['france', 'belgium'], ['india', 'sriLanka'], ['australia', 'newZealand'], ['usa', 'mexico'], ['romania', 'hungary'], ['bolivia', 'uruguay'], ['sudan', 'uganda']]) {
    assert.ok(worldArea(big) > worldArea(small), `${big} は ${small} より 大きい`);
  }
  assert.strictEqual(fieldOf('easy', 'toString'), fieldOf('easy', 'shape'), 'へんな なまえは かたちの床');

  // まだ積んでいない いきものも含めて、ぜんぶの形をしらべる（うみ・どうぶつ・とり・たんすい・むし・しんかい・きょうりゅう）
  const kana = /^[ぁ-んァ-ヶー]+$/;
  const creatureSets = [[SEA_PIECES, sea, text.sea], [ANIMAL_PIECES, animal, text.animals], [BIRD_PIECES, bird, text.birds], [FRESH_PIECES, fresh, text.fresh], [INSECT_PIECES, insect, text.insects], [DEEP_PIECES, deep, text.deep], [DINO_PIECES, dino, text.dinos], [PREF_PIECES, pref, text.prefs], [WORLD_PIECES, world, text.countries]];
  for (const [pieces, set, names] of creatureSets) for (const [id, piece] of Object.entries(pieces)) {
    assert.ok(set.adult.includes(id), `${id} がどこかの難易度で出る`);
    assert.ok(kana.test(names[id]), `${id} の名前はひらがな・カタカナのみ: ${names[id]}`);
    assert.ok(piece.color && piece.line && typeof piece.draw === 'function');
    for (const part of piece.parts) {
      if (part.circle) {
        assert.ok(part.circle[2] > 0);
        continue;
      }
      // 当たり判定は凸の部品だけ（へこんだ部品はMatterで正しくぶつからない）
      assert.ok(isConvex(part.points), `${id} の部品が凸: ${JSON.stringify(part.points)}`);
      for (let i = 0; i < part.points.length; i++) {
        const a = part.points[i];
        const b = part.points[(i + 1) % part.points.length];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.4, `${id} に長さ0の辺がない`);
      }
    }
    // 大きさ: いままでの かたち（46〜78px）と同じくらい。落とす前の表示（上から52px）に収まる
    const box = boundsOf(piece);
    if (pieces === WORLD_PIECES) { // せかいのくに（v0.17.43）: 大きさの ちがいを はっきり させる ため 大きい 国は ほかの つみきより 大きい（150×88まで）
      // パラオ（v0.17.46）は とても 小さい 島国なので ほそくて 小さい（かたちが わかる 長さ16は ある）
      const [minLong, minShort] = id === 'palau' ? [15, 6] : [18, 12];
      assert.ok(box.w <= 150 && box.h <= 88 && Math.max(box.w, box.h) >= minLong && Math.min(box.w, box.h) >= minShort, `${id} の大きさ ${box.w}x${box.h}`);
    } else if (pieces === PREF_PIECES) { // とどうふけんは ほんとうの 大きさの じゅんに するので 小さい 県は 小さい（見える 大きさは のこす）
      assert.ok(box.w <= 100 && box.h <= 80 && Math.max(box.w, box.h) >= 24 && Math.min(box.w, box.h) >= 14, `${id} の大きさ ${box.w}x${box.h}`);
    } else {
      assert.ok(box.w >= 36 && box.w <= 100, `${id} の横はば ${box.w}`);
      assert.ok(box.h >= 16 && box.h <= 80, `${id} の高さ ${box.h}`); // うなぎは ほそい板
    }
    assert.ok(-box.minY <= 45, `${id} が上にはみ出さない`);

    // 絵を描いても止まらない（ctxのにせもので全部の命令を受けとめる）
    const calls = [];
    const fakeCtx = new Proxy({}, {
      get: (_, key) => (...args) => calls.push([key, args]),
      set: () => true,
    });
    piece.draw(fakeCtx, piece);
    assert.ok(calls.length > 10, `${id} の絵が描かれる`);
    for (const [, args] of calls) {
      for (const v of args) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${id} の絵の数字がこわれていない`);
    }
  }
  // 「かたち」の名前と いきものの名前が i18n にある（メニュー文言も）
  for (const key of ['balanceBlocksLabel', 'balanceBlocksShape', 'balanceBlocksSea', 'balanceBlocksAnimal', 'balanceBlocksBird', 'balanceBlocksFresh', 'balanceBlocksInsect', 'balanceBlocksDeep', 'balanceBlocksDino', 'balanceBlocksPref', 'balanceBlocksWorld']) {
    assert.ok(kana.test(text[key].replace(/ /g, '')), `${key} はひらがな・カタカナのみ`);
  }
}

// ---------- 物理: どの いきものも、まんなかに落とせば 床の上で止まる（v0.17.12） ----------
// （ui.js と同じ重力・反復回数・床の大きさ。ころがり続けて勝手に落ちる子がいないこと）

{
  const code = readFileSync(new URL('../lib/matter.min.js', import.meta.url), 'utf8');
  const holder = { exports: {} };
  new Function('module', 'exports', code)(holder, holder.exports);
  const M = holder.exports;

  for (const [id, piece] of [...Object.entries(SEA_PIECES), ...Object.entries(ANIMAL_PIECES), ...Object.entries(BIRD_PIECES), ...Object.entries(FRESH_PIECES), ...Object.entries(INSECT_PIECES), ...Object.entries(DEEP_PIECES), ...Object.entries(DINO_PIECES), ...Object.entries(PREF_PIECES), ...Object.entries(WORLD_PIECES)]) {
    const engine = M.Engine.create({ enableSleeping: true });
    engine.gravity.y = 0.75;
    engine.positionIterations = 12;
    engine.velocityIterations = 8;
    const W = 343;
    const H = 430;
    const groundY = H - 26;
    const platform = M.Bodies.rectangle(W / 2, groundY, Math.round(W * 0.54 * fieldOf('easy', 'sea').platformRatio), 18, { isStatic: true, friction: 1 });
    const { body, offset } = buildPieceBody(M, piece, W / 2, 52);
    assert.ok(Number.isFinite(offset.x) && Number.isFinite(offset.y));
    M.Composite.add(engine.world, [platform, body]);
    for (let f = 0; f < 600; f++) {
      stepPhysics(M, engine); // ゲームと同じ（1フレームを 3つに わけて 計算）
      dampSpin(M, [body]);
    }
    const drift = Math.abs(body.position.x - W / 2);
    assert.ok(body.position.y < groundY, `${id} が床の上にいる（y=${body.position.y.toFixed(0)}）`);
    // 背の 高い 子は たおれて 横に なる だけで 重心が 背の 半分くらい 動くので、それは ころがりに かぞえない（v0.17.45: タイ 縦59）
    const box = boundsOf(piece);
    const limit = Math.max(30, Math.max(box.h, box.w) * 0.6);
    assert.ok(drift < limit, `${id} が ころがって行かない（ずれ ${drift.toFixed(0)}px / ${limit.toFixed(0)}px）`);
    assert.ok(body.isSleeping, `${id} が10びょう以内に止まる`);
  }
}

// ---------- ころがりにくさ（v0.17.14）: くじらが かにのハサミで かたむいても、床を ころがって落ちない ----------
// （実際にブラウザで起きた並び: くじら→かに（左に14.5px）→くじら（右に14.5px）。前は床を ころがって はしから落ちていた）

{
  const code = readFileSync(new URL('../lib/matter.min.js', import.meta.url), 'utf8');
  const holder = { exports: {} };
  new Function('module', 'exports', code)(holder, holder.exports);
  const M = holder.exports;
  const W = 343;
  const groundY = 430 - 26;
  const platformW = Math.round(W * 0.54 * fieldOf('easy', 'sea').platformRatio);
  const engine = M.Engine.create({ enableSleeping: true });
  engine.gravity.y = 0.75;
  engine.positionIterations = 12;
  engine.velocityIterations = 8;
  M.Composite.add(engine.world, M.Bodies.rectangle(W / 2, groundY, platformW, 18, { isStatic: true, friction: 1 }));
  let last = null;
  for (const [id, dx] of [['whale', 0], ['crab', -14.5], ['whale', 14.5]]) {
    let top = groundY;
    for (const b of M.Composite.allBodies(engine.world)) if (!b.isStatic) top = Math.min(top, b.position.y);
    last = buildPieceBody(M, SEA_PIECES[id], W / 2 + dx, Math.min(0, top - 170) + 52).body;
    M.Composite.add(engine.world, last);
    for (let f = 0; f < 300; f++) {
      stepPhysics(M, engine); // ゲームと同じ（1フレームを 3つに わけて 計算）
      dampSpin(M, M.Composite.allBodies(engine.world));
    }
  }
  assert.ok(last.position.y < groundY, `3こめの くじらが床の上に残る（y=${last.position.y.toFixed(0)}）`);
  assert.ok(Math.abs(last.position.x - W / 2) < platformW / 2, 'くじらが床の はしまで ころがらない');
}

// ---------- 物理が ほんものらしく きく（v0.17.44） ----------
// たおれる はずの ものは たおれ（はみ出した まま 止まらない）、つりあって いる ものは たつ。
// 前は まわる いきおいを 毎フレーム 5%弱めて いたため、はみ出した つみきが ゆっくりしか かたむかず、スリープして 止まっていた

{
  const code = readFileSync(new URL('../lib/matter.min.js', import.meta.url), 'utf8');
  const holder = { exports: {} };
  new Function('module', 'exports', code)(holder, holder.exports);
  const M = holder.exports;
  const W = 343;
  const groundY = 430 - 26;
  const top = groundY - 9;
  const platformW = Math.round(W * 0.54 * fieldOf('easy', 'sea').platformRatio);
  const o = { friction: 0.9, frictionStatic: 1.2, restitution: 0, density: 0.002 };
  const scene = (bodies, frames) => {
    const engine = M.Engine.create({ enableSleeping: true });
    engine.gravity.y = 0.75;
    engine.positionIterations = 12;
    engine.velocityIterations = 8;
    M.Composite.add(engine.world, [M.Bodies.rectangle(W / 2, groundY, platformW, 18, { isStatic: true, friction: 1 }), ...bodies]);
    for (let f = 0; f < frames; f++) {
      stepPhysics(M, engine);
      dampSpin(M, M.Composite.allBodies(engine.world));
    }
  };
  assert.ok(PHYSICS_SUBSTEPS >= 3, '1フレームを 3つ いじょうに わけて 計算する');
  // 台の はしから 重心が 4px はみ出した 板 → おちる
  const over = M.Bodies.rectangle(W / 2 + platformW / 2 + 4, top - 15, 72, 30, o);
  scene([over], 360);
  assert.ok(over.position.y > groundY + 30, '重心が はみ出した 板は 台から おちる');
  // 細い 板（20×70）: 17.5°（重心が 角の 外）は たおれ、12°は もどって 立つ
  const lean = M.Bodies.rectangle(W / 2, top - 40, 20, 70, o);
  M.Body.setAngle(lean, 17.5 / 57.3);
  scene([lean], 480);
  assert.ok(Math.abs(lean.angle) > 1.2, '17.5°で 立てた 細い 板は たおれる');
  const back = M.Bodies.rectangle(W / 2, top - 40, 20, 70, o);
  M.Body.setAngle(back, 12 / 57.3);
  scene([back], 480);
  assert.ok(Math.abs(back.angle) < 0.1, '12°なら もどって 立つ');
  // 四角の 上に 重心が 3px はみ出して のせた 四角 → おちる
  const base = M.Bodies.rectangle(W / 2, top - 23, 46, 46, o);
  const topBox = M.Bodies.rectangle(W / 2 + 26, top - 69.5, 46, 46, o);
  scene([base, topBox], 360);
  assert.ok(topBox.position.y > top - 40, '重心が はみ出した 上の 四角は おちる');
  // すこしずつ ずらした 10だん（つりあっている）→ たつ
  const tower = [];
  for (let i = 0; i < 10; i++) tower.push(M.Bodies.rectangle(W / 2 + (i % 2 ? 6 : -6), top - 23 - i * 46.5, 46, 46, o));
  scene(tower, 600);
  for (const [i, b] of tower.entries()) assert.ok(Math.abs(b.position.x - (W / 2 + (i % 2 ? 6 : -6))) < 4, `つりあった 10だんの ${i + 1}だんめが くずれない`);
  // 地図の つみきも 台から 重心が はみ出したら おちる（v0.17.40 は まわりにくさ 20ばいで 止まっていた）
  for (const piece of [WORLD_PIECES.vietnam, WORLD_PIECES.japan, PREF_PIECES.iwate, PREF_PIECES.tokyo]) {
    const b = buildPieceBody(M, piece, 0, 0).body;
    M.Body.setPosition(b, { x: W / 2 + platformW / 2 + 5, y: top - (b.bounds.max.y - b.position.y) - 0.5 });
    scene([b], 480);
    assert.ok(b.position.y > groundY + 30, '重心が はみ出した 地図は 台から おちる');
  }
}

console.log('balance.test.js: すべてのテストに合格');
