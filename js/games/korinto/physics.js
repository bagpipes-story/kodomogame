// physics.js — コリントゲームのMatter.js組み立て（DOM非依存）
// Matterオブジェクトを引数で受け取るので、ブラウザ（window.Matter）でも
// Nodeの自動テスト（lib/matter.min.jsを読み込む）でも同じ盤を作れる。
// 性能規定: 動的ボディは球1個。釘・壁・ギミックは静的で開始時に一括生成。風車だけ毎フレーム回す。

import { BALL_R } from './game.js';

const WARP_COOLDOWN_TICKS = 45; // 出口から出た直後に別のワープへ吸われないための猶予
const BUMPER_KICK = 9;          // 反発板が球を蹴り出す速さ(px/フレーム)。反発係数だけだと弱い。
                                // 強すぎると上のレールまで飛んでレーンに落ちる（戻り球になる）ため控えめ

export function buildWorld(M, layout, handlers = {}, rng = Math.random) {
  const engine = M.Engine.create({ enableSleeping: false });
  engine.gravity.y = layout.gravity;
  engine.positionIterations = 8; // トンネリング防止（別冊04§7）
  engine.velocityIterations = 6;

  const staticOpts = { isStatic: true, friction: 0.02, restitution: 0.4 };
  const bodies = [];

  for (const wall of layout.walls) {
    // レールは反発ゼロ・摩擦ゼロ: Matterは両者の反発係数の大きい方を使うため、
    // 球側も低くしておく（釘・反発板は自身の反発係数で跳ねる）
    const opts = wall.rail ? { isStatic: true, friction: 0, restitution: 0.02 } : staticOpts;
    const body = M.Bodies.rectangle(wall.cx, wall.cy, wall.w, wall.h, opts);
    M.Body.setAngle(body, wall.angle);
    bodies.push(body);
  }

  for (const peg of layout.pegs) {
    const body = M.Bodies.circle(peg.x, peg.y, layout.pegR, { ...staticOpts, restitution: 0.6 });
    body.plugin.kgb = { kind: 'peg' };
    bodies.push(body);
  }

  const pinwheels = layout.pinwheels.map((p) => {
    const armA = M.Bodies.rectangle(p.x, p.y, p.len, 6, staticOpts);
    const armB = M.Bodies.rectangle(p.x, p.y, 6, p.len, staticOpts);
    const body = M.Body.create({ parts: [armA, armB], isStatic: true, friction: 0.02, restitution: 0.5 });
    body.plugin.kgb = { kind: 'pinwheel' };
    bodies.push(body);
    return body;
  });

  // 反発板: 反発係数を1より大きくして「はじき返す」感触に
  for (const b of layout.bumpers) {
    const body = M.Bodies.rectangle(b.x, b.y, b.w, b.h, { ...staticOpts, restitution: 0.9, chamfer: { radius: 5 } });
    M.Body.setAngle(body, b.angle);
    body.plugin.kgb = { kind: 'bumper' };
    bodies.push(body);
  }

  for (const bell of layout.bells) {
    const body = M.Bodies.circle(bell.x, bell.y, bell.r, { ...staticOpts, restitution: 0.7 });
    body.plugin.kgb = { kind: 'bell', index: bell.index };
    bodies.push(body);
  }

  for (const s of layout.sensors) {
    const body = M.Bodies.rectangle(s.cx, s.cy, s.w, s.h, { isStatic: true, isSensor: true });
    body.plugin.kgb = { kind: 'pocket', index: s.index };
    bodies.push(body);
  }

  M.Composite.add(engine.world, bodies);

  let ball = null;
  let warpCooldown = 0;
  let pendingKick = null; // 反発板に当たった直後、衝突処理のあとで蹴り出す

  M.Events.on(engine, 'collisionStart', (event) => {
    if (!ball) return;
    for (const pair of event.pairs) {
      const other = pair.bodyA === ball ? pair.bodyB : pair.bodyB === ball ? pair.bodyA : null;
      if (!other || !other.plugin.kgb) continue;
      const info = other.plugin.kgb;
      if (info.kind === 'peg' && handlers.onPeg) handlers.onPeg(other);
      else if (info.kind === 'bumper') {
        // 板の法線（球のいる側）を求めて、衝突処理後にその向きへ蹴り出す
        const nx = Math.sin(other.angle);
        const ny = -Math.cos(other.angle);
        const side = (ball.position.x - other.position.x) * nx + (ball.position.y - other.position.y) * ny >= 0 ? 1 : -1;
        pendingKick = { x: nx * side, y: ny * side };
        if (handlers.onBumper) handlers.onBumper(other);
      }
      else if (info.kind === 'bell' && handlers.onBell) handlers.onBell(info.index);
      else if (info.kind === 'pocket' && handlers.onPocket) handlers.onPocket(info.index);
    }
  });

  // power: 0〜1。弱いとレーンを上りきれず戻ってくる
  function launch(power) {
    removeBall();
    ball = M.Bodies.circle(layout.spawn.x, layout.spawn.y, BALL_R, {
      friction: 0.01,
      frictionAir: 0.002,
      restitution: 0.1, // レールに沿って滑るため低め。釘(0.6)・反発板は相手側の値で跳ねる
      density: 0.004,
    });
    M.Composite.add(engine.world, ball);
    // パワー3割でもレール上端を越えられる速さから、最強でも盤の左端に届く程度まで
    const speed = layout.launch.min + power * layout.launch.range;
    M.Body.setVelocity(ball, { x: 0, y: -speed });
    warpCooldown = 0;
    return ball;
  }

  function removeBall() {
    if (ball) {
      M.Composite.remove(engine.world, ball);
      ball = null;
    }
  }

  // ワープ: あなに球の中心が入ったら、別のあな（ランダム）から真上±45°の範囲でランダムに飛び出す
  // （下向きに吐き出すとすぐ終わってしまうため上向き固定。速さは難易度ごとの設定）
  function checkWarps() {
    if (!ball || layout.warps.length < 2) return;
    if (warpCooldown > 0) {
      warpCooldown--;
      return;
    }
    for (const hole of layout.warps) {
      if (Math.hypot(ball.position.x - hole.x, ball.position.y - hole.y) < hole.r) {
        const others = layout.warps.filter((h) => h !== hole);
        const exit = others[Math.floor(rng() * others.length)];
        const angle = -Math.PI / 2 + (rng() - 0.5) * (Math.PI / 2); // 真上を中心に±45°
        M.Body.setPosition(ball, { x: exit.x, y: exit.y });
        M.Body.setVelocity(ball, {
          x: Math.cos(angle) * layout.warpExitSpeed,
          y: Math.sin(angle) * layout.warpExitSpeed,
        });
        warpCooldown = WARP_COOLDOWN_TICKS;
        if (handlers.onWarp) handlers.onWarp(exit.index);
        return;
      }
    }
  }

  // 反発板のキック: 反射した速度の法線成分がBUMPER_KICKに満たなければ足す（「ボヨン」）
  function applyKick() {
    if (!pendingKick || !ball) {
      pendingKick = null;
      return;
    }
    const { x: nx, y: ny } = pendingKick;
    pendingKick = null;
    const v = ball.velocity;
    const along = v.x * nx + v.y * ny;
    const boost = Math.max(0, BUMPER_KICK - along);
    M.Body.setVelocity(ball, { x: v.x + nx * boost, y: v.y + ny * boost });
  }

  // 1フレーム進める（風車の回転・反発板のキック・ワープ判定もここで）
  function step(dtMs = 1000 / 60) {
    for (const wheel of pinwheels) M.Body.setAngle(wheel, wheel.angle + layout.pinwheelSpeed);
    M.Engine.update(engine, dtMs);
    applyKick();
    checkWarps();
  }

  function destroy() {
    M.Events.off(engine);
    M.Composite.clear(engine.world, false);
    M.Engine.clear(engine);
  }

  return {
    engine,
    pinwheels,
    launch,
    removeBall,
    step,
    destroy,
    getBall: () => ball,
  };
}
