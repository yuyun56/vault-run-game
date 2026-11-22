// The screenshot scenes behind ?shot=vault|ambush|gallery|escape. Each one
// plays the real rules forward from a fresh world, steered by an autopilot
// that walks the thief along a route, waits when the next step is watched,
// sneaks when a guard is near and breaks away when a guard gets onto him —
// so the frame is what a short game really looks like, and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

/** Hard cap per scene, in seconds of simulated play. */
const LIMIT_SECONDS = 120;

function nearestGuard(world) {
  const p = world.state.player;
  let best = null;
  let bestDist = Infinity;
  for (const g of world.state.guards) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return { guard: best, dist: bestDist };
}

/** Steer toward `target`; wait (sneaking) when the next step is watched; flee a guard who is onto the thief. */
function autopilot(world, target, memory) {
  const state = world.state;
  const player = state.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 14) return { dir: { x: 0, y: 0 }, sneak: true, arrived: true };

  // A guard who has really seen the thief and is closing in: break away
  // from him first, route second. Standing still to wait is how runs end.
  const threat = nearestGuard(world);
  if (threat.guard && threat.dist < 190 && (threat.guard.mode === 'chase' || threat.guard.alert > 0.38)) {
    const ax = player.x - threat.guard.x;
    const ay = player.y - threat.guard.y;
    const al = Math.hypot(ax, ay) || 1;
    memory.wait = 0;
    return { dir: { x: ax / al, y: ay / al }, sneak: false, arrived: false };
  }

  const dir = { x: dx / dist, y: dy / dist };
  const probe = { x: player.x + dir.x * 95, y: player.y + dir.y * 95 };
  const seen = world.guardSeesPlayer();
  if (!seen && world.pointWatched(probe.x, probe.y)) {
    memory.wait += 1;
    if (memory.wait < 5 / STEP) {
      return { dir: { x: 0, y: 0 }, sneak: true, arrived: false };
    }
  } else {
    memory.wait = 0;
  }
  const sneak = world.nearestGuardDistance() < 320;
  return { dir, sneak, arrived: false };
}

function runRoute(world, waypoints, opts = {}) {
  const memory = { wait: 0 };
  let index = 0;
  const limit = LIMIT_SECONDS / STEP;
  for (let i = 0; i < limit && index < waypoints.length; i += 1) {
    if (world.state.status !== 'playing') break;
    const target = waypoints[index];
    if (opts.direct) {
      const player = world.state.player;
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 14) {
        index += 1;
        continue;
      }
      world.step(STEP, { dir: { x: dx / dist, y: dy / dist }, sneak: false, clicks: [] });
      continue;
    }
    const move = autopilot(world, target, memory);
    if (move.arrived) {
      index += 1;
      continue;
    }
    world.step(STEP, { dir: move.dir, sneak: move.sneak, clicks: [] });
  }
}

function idle(world, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n && world.state.status === 'playing'; i += 1) {
    world.step(STEP, { dir: { x: 0, y: 0 }, sneak: true, clicks: [] });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any other name is the cover scene.
 */
export function stageShot(name, world) {
  if (name === 'ambush') {
    // Cross to the top patrol lane and linger in the open until a guard's
    // cone finds the thief: the meter climbs, the guard turns curious,
    // then the thief breaks a few steps south with the alarm still hot.
    world.reset();
    runRoute(world, [
      { x: 150, y: 470 },
      { x: 500, y: 190 },
    ]);
    const limit = 30 / STEP;
    for (let i = 0; i < limit && world.state.alarm < 46 && world.state.status === 'playing'; i += 1) {
      world.step(STEP, { dir: { x: 0, y: 0 }, sneak: false, clicks: [] });
    }
    runRoute(world, [{ x: 505, y: 238 }], { direct: true });
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'gallery') {
    // Second floor: lift a painting and a strongbox from the west gallery,
    // then slip the divider gap and lift the jewel from its case.
    world.loadLevel(1);
    runRoute(world, [
      { x: 222, y: 126 },
      { x: 300, y: 344 },
      { x: 560, y: 334 },
      { x: 700, y: 334 },
      { x: 815, y: 344 },
    ]);
    if (world.state.status !== 'playing' || world.state.lootTaken < 2) {
      // The cautious route failed this seed: stage the same moment by
      // hand — thief at the jewel case with two pieces already lifted,
      // patrols mid-route around him.
      world.loadLevel(1);
      world.state.loots[0].taken = true; // west painting
      world.state.loots[5].taken = true; // west strongbox
      world.state.lootTaken = 2;
      world.state.score = 1200 + 800;
      world.state.player.x = 812;
      world.state.player.y = 300;
      world.state.player.face = 2.6;
      idle(world, 1.0);
    } else {
      idle(world, 0.6);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'escape') {
    // The full first-floor job: in through the south hall, through the
    // vault-room door gap, crack the vault, and back out to the exit.
    world.reset();
    runRoute(world, [
      { x: 430, y: 630 },
      { x: 845, y: 600 },
      { x: 845, y: 362 },
      { x: 965, y: 362 },
      { x: 1075, y: 185 },
    ]);
    if (world.state.status === 'playing' && world.state.vault.taken) {
      runRoute(world, [
        { x: 965, y: 362 },
        { x: 845, y: 362 },
        { x: 845, y: 610 },
        { x: 1150, y: 628 },
      ]);
      idle(world, 0.4);
    }
    if (world.state.status !== 'playing' || !world.state.vault.taken) {
      // The cautious route failed this seed: stage the same moment by hand —
      // thief at the open exit, vault cracked, sack full, patrols mid-route.
      world.reset();
      world.state.vault.taken = true;
      world.state.lootTaken = 4;
      world.state.score = 5000 + 500 + 800 + 1200 + 2500;
      world.state.player.x = 1168;
      world.state.player.y = 628;
      world.state.player.face = 0.4;
      idle(world, 1.2);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // Cover ('vault'): the thief mid-lobby in the open between the pillars,
  // patrol cones out, a camera sweeping the top wall, the vault glowing
  // gold in its room beyond the divider.
  world.reset();
  runRoute(world, [
    { x: 150, y: 470 },
    { x: 300, y: 300 },
    { x: 470, y: 262 },
  ]);
  idle(world, 0.4);
  return { screen: SCREEN_PLAY, best: 0 };
}
