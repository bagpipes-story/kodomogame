// sw.js — Service Worker（v0.17。仕様§6）
// インストール時に全アセットをプリキャッシュし、以後はキャッシュファーストで返す（オフラインで全ゲーム動作）。
// キャッシュ名にバージョンを含め、新バージョンの起動時に旧キャッシュを削除する。
// ルール: VERSION は js/app.js の APP_VERSION と必ず同じにする（tests/sw.test.js が検査する）。
// 更新の流れ: 新しいsw.jsが見つかる → 新アセットを丸ごとプリキャッシュ → アプリが「こうしん」を案内 →
//   タップで skipWaiting → controllerchange で再読み込み（ゲーム途中に勝手に入れ替わらない）。
// 外部通信は一切しない（同一オリジンのGETだけ扱う）。

const VERSION = 'v0.17.2';
const CACHE_NAME = `kgb-${VERSION}`;

// プリキャッシュ一覧（相対パス。tests/sw.test.js が「存在する」「漏れがない」を検査する）
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './lib/matter.min.js',
  './css/common.css',
  './css/games/abc.css',
  './css/games/balance.css',
  './css/games/enword.css',
  './css/games/flash.css',
  './css/games/korinto.css',
  './css/games/listen.css',
  './css/games/maze.css',
  './css/games/memory.css',
  './css/games/mole.css',
  './css/games/oldmaid.css',
  './css/games/othello.css',
  './css/games/rollcatch.css',
  './css/games/sevens.css',
  './css/games/tictactoe.css',
  './js/app.js',
  './js/art.js',
  './js/assist.js',
  './js/i18n.js',
  './js/motion.js',
  './js/parent.js',
  './js/players.js',
  './js/praise.js',
  './js/quiz.js',
  './js/race.js',
  './js/resultView.js',
  './js/sound.js',
  './js/speech.js',
  './js/stamps.js',
  './js/storage.js',
  './js/wordart.js',
  './js/words.js',
  './js/games/abc/game.js',
  './js/games/abc/ui.js',
  './js/games/balance/game.js',
  './js/games/balance/ui.js',
  './js/games/enword/game.js',
  './js/games/enword/ui.js',
  './js/games/flash/game.js',
  './js/games/flash/ui.js',
  './js/games/korinto/game.js',
  './js/games/korinto/physics.js',
  './js/games/korinto/ui.js',
  './js/games/listen/game.js',
  './js/games/listen/ui.js',
  './js/games/maze/game.js',
  './js/games/maze/mazes.js',
  './js/games/maze/ui.js',
  './js/games/memory/cpu.js',
  './js/games/memory/game.js',
  './js/games/memory/ui.js',
  './js/games/mole/game.js',
  './js/games/mole/ui.js',
  './js/games/oldmaid/game.js',
  './js/games/oldmaid/ui.js',
  './js/games/othello/cpu.js',
  './js/games/othello/game.js',
  './js/games/othello/ui.js',
  './js/games/rollcatch/game.js',
  './js/games/rollcatch/ui.js',
  './js/games/sevens/cpu.js',
  './js/games/sevens/game.js',
  './js/games/sevens/ui.js',
  './js/games/tictactoe/cpu.js',
  './js/games/tictactoe/game.js',
  './js/games/tictactoe/ui.js',
];

self.addEventListener('install', (event) => {
  // HTTPキャッシュを経由せず必ずサーバーから取る（バージョン違いの混在を防ぐ）
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
  // skipWaiting は自動では呼ばない（ゲーム途中に入れ替わらないよう、アプリ側の「こうしん」タップで呼ぶ）
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('kgb-') && key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 外部は扱わない（そもそも外部通信は無い）
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        // オフラインでキャッシュに無いもの: 画面遷移なら index.html を返す
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    }),
  );
});
