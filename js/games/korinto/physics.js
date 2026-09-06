// physics.js — コリントゲームのMatter.js組み立て（DOM非依存）
// Matterオブジェクトを引数で受け取るので、ブラウザ（window.Matter）でも
// Nodeの自動テスト（lib/matter.min.jsを読み込む）でも同じ盤を作れる。
// 性能規定: 動的ボディは球1個。釘・壁・ギミックは静的で開始時に一括生成。風車だけ毎フレーム回す。

import { BALL_R } from './game.js';

const WARP_COOLDOWN_TICKS = 45; // 出口から出た直後に別のワープへ吸われないための猶予

export function buildWorld(M, layout, handlers = {}) {
  const engine = M.Engine.create({ enableSleeping: false });
  engine.gravity.y = layout.gravity;
  engine.positionIterations = 8; // トンネリング防止（別冊04§7）
  engine.velocityIterations = 6;

  const staticOpts = { isStatic: true, friction: 0.02, restitution: 0.4 };
  const bodies = [];

  for (const wall of layout.walls) {
    const body = M.Bodies.rectangle(wall.cx, wall.cy, wall.w, wall.h, staticOpts);
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
    // 1.0を少し超える程度: 大きすぎると壁との間で跳ね続けて止まらなくなる
    const body = M.Bodies.rectangle(b.x, b.y, b.w, b.h, { ...staticOpts, restitution: 1.08, chamfer: { radius: 5 } });
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

  M.Events.on(engine, 'collisionStart', (event) => {
    if (!ball) return;
    for (const pair of event.pairs) {
      const other = pair.bodyA === ball ? pair.bodyB : pair.bodyB === ball ? pair.bodyA : null;
      if (!other || !other.plugin.kgb) continue;
      const info = other.plugin.kgb;
      if (info.kind === 'peg' && handlers.onPeg) handlers.onPeg(other);
      else if (info.kind === 'bumper' && handlers.onBumper) handlers.onBumper(other);
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
      restitution: 0.45,
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

  // ワープ: 入口の円に球の中心が入ったら出口へ瞬間移動（速度はそのまま）
  function checkWarps() {
    if (!ball) return;
    if (warpCooldown > 0) {
      warpCooldown--;
      return;
    }
    for (const warp of layout.warps) {
      if (Math.hypot(ball.position.x - warp.a.x, ball.position.y - warp.a.y) < warp.r) {
        M.Body.setPosition(ball, { x: warp.b.x, y: warp.b.y });
        warpCooldown = WARP_COOLDOWN_TICKS;
        if (handlers.onWarp) handlers.onWarp(warp.index);
        return;
      }
    }
  }

  // 1フレーム進める（風車の回転・ワープ判定もここで）
  function step(dtMs = 1000 / 60) {
    for (const wheel of pinwheels) M.Body.setAngle(wheel, wheel.angle + layout.pinwheelSpeed);
    M.Engine.update(engine, dtMs);
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
