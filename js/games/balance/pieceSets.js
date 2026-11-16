// pieceSets.js — バランスゲームの いきもの・地図の つみき（図形いがい）の 一覧（v0.18 で ui.js から 切り出し）。
// しゅるい → 形と絵の定義・名前。バランスゲームと「なまえあて」（js/games/guess/）が 同じ 絵を つかう

import { SEA_PIECES } from './sea.js';
import { ANIMAL_PIECES } from './animal.js';
import { BIRD_PIECES } from './bird.js';
import { FRESH_PIECES } from './fresh.js';
import { INSECT_PIECES } from './insect.js';
import { DEEP_PIECES } from './deep.js';
import { DINO_PIECES } from './dino.js';
import { PREF_PIECES } from './pref.js';
import { WORLD_PIECES } from './world.js';
import { text } from '../../i18n.js';

export const PIECE_SETS = {
  sea: { pieces: SEA_PIECES, names: text.sea }, // v0.17.12
  animal: { pieces: ANIMAL_PIECES, names: text.animals }, // v0.17.21
  bird: { pieces: BIRD_PIECES, names: text.birds }, // v0.17.23
  fresh: { pieces: FRESH_PIECES, names: text.fresh }, // v0.17.28
  insect: { pieces: INSECT_PIECES, names: text.insects }, // v0.17.31
  deep: { pieces: DEEP_PIECES, names: text.deep }, // v0.17.34
  dino: { pieces: DINO_PIECES, names: text.dinos }, // v0.17.38
  pref: { pieces: PREF_PIECES, names: text.prefs }, // v0.17.40
  world: { pieces: WORLD_PIECES, names: text.countries }, // v0.17.42
};
