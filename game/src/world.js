// The Vault Run simulation: three hand-built floors, patrolling guards with
// vision cones, sweeping security cameras, loot, a vault and one alarm meter.
// Everything advances in fixed steps from a seeded random source, so a run —
// and every screenshot scene — is reproducible byte for byte.
//
// Sight is honest geometry: a watcher sees the thief when he is inside the
// watcher's range and cone and the straight line between them crosses no
// wall and no cover. Detection feeds two things: each guard's personal
// alert (patrol -> suspicious -> chase) and the building's alarm meter,
// which drains again while the thief is unseen. Fill the meter, or get
// grabbed by a chasing guard, and the run is busted.

import { ALARM, CAMERA, FIELD, GUARD, LOOT_VALUES, PLAYER } from './config.js';

export const EVENT_STEP = 'step';
export const EVENT_COIN = 'coin';
export const EVENT_LOOT = 'loot';
export const EVENT_VAULT = 'vault';
export const EVENT_WARN = 'warn';
export const EVENT_BUST = 'bust';
export const EVENT_CLEAR = 'clear';

const BORDER = 24;

function borderWalls() {
  return [
    { x: 0, y: 0, w: FIELD.width, h: BORDER },
    { x: 0, y: FIELD.height - BORDER, w: FIELD.width, h: BORDER },
    { x: 0, y: 0, w: BORDER, h: FIELD.height },
    { x: FIELD.width - BORDER, y: 0, w: BORDER, h: FIELD.height },
  ];
}

// Level data. Walls and covers are both solid and both block sight; covers
// are the low furniture (pillars, display cases, pedestals) drawn in wood
// and brass, walls are the building's own partitions.
const LEVELS = [
  {
    name: 'First National Lobby',
    par: 150,
    start: { x: 84, y: 636 },
    exit: { x: 1204, y: 586, w: 52, h: 84 },
    vault: { x: 1080, y: 140 },
    walls: [
      { x: 884, y: 24, w: 20, h: 276 },
      { x: 884, y: 420, w: 20, h: 54 },
      { x: 884, y: 474, w: 372, h: 20 },
    ],
    covers: [
      { x: 316, y: 164, w: 52, h: 52 },
      { x: 548, y: 164, w: 52, h: 52 },
      { x: 316, y: 452, w: 52, h: 52 },
      { x: 548, y: 452, w: 52, h: 52 },
      { x: 180, y: 330, w: 96, h: 36 },
      { x: 660, y: 330, w: 96, h: 36 },
    ],
    loots: [
      { x: 342, y: 118, kind: 'gem' },
      { x: 708, y: 348, kind: 'gold' },
      { x: 140, y: 140, kind: 'painting' },
      { x: 574, y: 580, kind: 'gem' },
      { x: 1150, y: 392, kind: 'crown' },
    ],
    guards: [
      { waypoints: [[210, 150], [770, 150], [770, 580], [210, 580]] },
      { waypoints: [[430, 640], [840, 640], [840, 548], [430, 548]] },
      { waypoints: [[962, 400], [1200, 400], [1200, 110], [962, 110]] },
    ],
    cameras: [
      { x: 640, y: 26, base: Math.PI / 2, sweep: 0.85, speed: 0.5 },
      { x: 1254, y: 690, base: -Math.PI / 2, sweep: 0.7, speed: 0.38 },
    ],
  },
  {
    name: 'Gallery of Kings',
    par: 180,
    start: { x: 84, y: 360 },
    exit: { x: 1204, y: 596, w: 52, h: 84 },
    vault: { x: 1128, y: 104 },
    walls: [
      { x: 628, y: 24, w: 20, h: 240 },
      { x: 628, y: 404, w: 20, h: 140 },
      { x: 628, y: 640, w: 20, h: 56 },
      { x: 980, y: 24, w: 20, h: 180 },
      { x: 980, y: 184, w: 276, h: 20 },
    ],
    covers: [
      { x: 200, y: 200, w: 44, h: 44 },
      { x: 420, y: 200, w: 44, h: 44 },
      { x: 200, y: 470, w: 44, h: 44 },
      { x: 420, y: 470, w: 44, h: 44 },
      { x: 760, y: 330, w: 110, h: 36 },
      { x: 1080, y: 420, w: 52, h: 52 },
      { x: 1080, y: 560, w: 52, h: 52 },
    ],
    loots: [
      { x: 222, y: 118, kind: 'painting' },
      { x: 442, y: 118, kind: 'painting' },
      { x: 222, y: 606, kind: 'painting' },
      { x: 442, y: 606, kind: 'gold' },
      { x: 815, y: 348, kind: 'gem' },
      { x: 300, y: 348, kind: 'gold' },
      { x: 760, y: 118, kind: 'crown' },
    ],
    guards: [
      { waypoints: [[140, 140], [520, 140], [520, 620], [140, 620]] },
      { waypoints: [[700, 620], [1180, 620], [1180, 300], [700, 300]] },
      { waypoints: [[700, 140], [920, 140], [920, 560], [700, 560]] },
    ],
    cameras: [
      { x: 320, y: 26, base: Math.PI / 2, sweep: 0.8, speed: 0.44 },
      { x: 960, y: 694, base: -Math.PI / 2, sweep: 0.75, speed: 0.52 },
      { x: 1254, y: 360, base: Math.PI, sweep: 0.65, speed: 0.36 },
    ],
  },
  {
    name: 'The Crown Vault',
    par: 210,
    start: { x: 70, y: 360 },
    exit: { x: 1204, y: 596, w: 52, h: 84 },
    vault: { x: 1100, y: 118 },
    walls: [
      { x: 300, y: 24, w: 20, h: 300 },
      { x: 300, y: 470, w: 20, h: 226 },
      { x: 620, y: 120, w: 20, h: 420 },
      { x: 940, y: 24, w: 20, h: 260 },
      { x: 940, y: 420, w: 20, h: 276 },
    ],
    covers: [
      { x: 140, y: 180, w: 48, h: 48 },
      { x: 140, y: 500, w: 48, h: 48 },
      { x: 450, y: 140, w: 48, h: 48 },
      { x: 450, y: 560, w: 48, h: 48 },
      { x: 760, y: 300, w: 100, h: 36 },
      { x: 760, y: 560, w: 48, h: 48 },
      { x: 1080, y: 470, w: 52, h: 52 },
    ],
    loots: [
      { x: 164, y: 116, kind: 'gem' },
      { x: 474, y: 648, kind: 'gem' },
      { x: 810, y: 318, kind: 'gold' },
      { x: 164, y: 624, kind: 'painting' },
      { x: 1100, y: 636, kind: 'painting' },
      { x: 460, y: 352, kind: 'crown' },
    ],
    guards: [
      { waypoints: [[120, 120], [240, 120], [240, 620], [120, 620]] },
      { waypoints: [[380, 640], [560, 640], [560, 90], [380, 90]] },
      { waypoints: [[700, 120], [880, 120], [880, 640], [700, 640]] },
      { waypoints: [[1010, 640], [1200, 640], [1200, 340], [1010, 340]] },
    ],
    cameras: [
      { x: 460, y: 26, base: Math.PI / 2, sweep: 0.8, speed: 0.47 },
      { x: 26, y: 360, base: 0, sweep: 0.7, speed: 0.4 },
      { x: 790, y: 694, base: -Math.PI / 2, sweep: 0.8, speed: 0.55 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does segment (x1,y1)-(x2,y2) cross the rect (touching an edge counts)? */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const axes = [
    [-dx, x1 - r.x],
    [dx, r.x + r.w - x1],
    [-dy, y1 - r.y],
    [dy, r.y + r.h - y1],
  ];
  for (const [p, q] of axes) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

export function createWorld(rng) {
  const state = {
    levelIndex: 0,
    levelName: '',
    time: 0,
    status: 'playing', // playing | busted | clear | win
    bustReason: '',
    player: { x: 0, y: 0, face: 0, sneak: false, coinCd: 0, stepAcc: 0 },
    guards: [],
    cameras: [],
    loots: [],
    vault: { x: 0, y: 0, taken: false },
    exit: { x: 0, y: 0, w: 0, h: 0 },
    walls: [],
    covers: [],
    alarm: 0,
    maxAlarm: 0,
    seenNow: false,
    seenByCamera: false,
    score: 0,
    lootTaken: 0,
    lootTotal: 0,
    hint: '',
    hintT: 0,
    pings: [], // coin noise: {x, y, t, ttl}
    events: [],
    warnLatch: false,
  };

  function obstacles() {
    return state.walls.concat(state.covers);
  }

  function losClear(x1, y1, x2, y2) {
    for (const r of obstacles()) {
      if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
    }
    return true;
  }

  function circleHitsRect(cx, cy, rad, r) {
    const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
    const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < rad * rad;
  }

  /** Move a circle by (dx, dy), sliding along anything solid. */
  function moveCircle(e, dx, dy, rad) {
    const solids = obstacles();
    if (dx !== 0) {
      e.x += dx;
      for (const r of solids) {
        if (circleHitsRect(e.x, e.y, rad, r)) e.x = dx > 0 ? r.x - rad : r.x + r.w + rad;
      }
    }
    if (dy !== 0) {
      e.y += dy;
      for (const r of solids) {
        if (circleHitsRect(e.x, e.y, rad, r)) e.y = dy > 0 ? r.y - rad : r.y + r.h + rad;
      }
    }
    e.x = Math.max(BORDER + rad, Math.min(FIELD.width - BORDER - rad, e.x));
    e.y = Math.max(BORDER + rad, Math.min(FIELD.height - BORDER - rad, e.y));
  }

  function watcherSees(wx, wy, facing, range, halfAngle, tx, ty, sightFactor) {
    const dx = tx - wx;
    const dy = ty - wy;
    const dist = Math.hypot(dx, dy);
    if (dist > range * sightFactor || dist < 1) return { seen: false, dist };
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, facing)) > halfAngle) return { seen: false, dist };
    if (!losClear(wx, wy, tx, ty)) return { seen: false, dist };
    return { seen: true, dist };
  }

  function guardSees(guard, tx, ty, sneak) {
    const factor = sneak ? PLAYER.sneakSightFactor : 1;
    return watcherSees(guard.x, guard.y, guard.face, GUARD.visionRange, GUARD.visionHalfAngle, tx, ty, factor);
  }

  function cameraAngle(cam) {
    return cam.base + Math.sin(state.time * cam.speed + cam.phase) * cam.sweep;
  }

  function cameraSees(cam, tx, ty, sneak) {
    const factor = sneak ? PLAYER.sneakSightFactor : 1;
    return watcherSees(cam.x, cam.y, cameraAngle(cam), CAMERA.visionRange, CAMERA.visionHalfAngle, tx, ty, factor);
  }

  function loadLevel(index, keepScore) {
    const def = LEVELS[index];
    state.levelIndex = index;
    state.levelName = def.name;
    state.time = 0;
    state.status = 'playing';
    state.bustReason = '';
    state.walls = borderWalls().concat(def.walls);
    state.covers = def.covers.slice();
    state.player.x = def.start.x;
    state.player.y = def.start.y;
    state.player.face = 0;
    state.player.coinCd = 0;
    state.vault = { x: def.vault.x, y: def.vault.y, taken: false };
    state.exit = { ...def.exit };
    state.loots = def.loots.map((l) => ({ ...l, taken: false, value: LOOT_VALUES[l.kind] }));
    state.lootTotal = def.loots.length + 1;
    state.lootTaken = 0;
    state.alarm = 0;
    state.maxAlarm = 0;
    state.seenNow = false;
    state.seenByCamera = false;
    state.hint = '';
    state.hintT = 0;
    state.pings = [];
    state.events = [];
    state.warnLatch = false;
    if (!keepScore) state.score = 0;
    state.guards = def.guards.map((g, gi) => {
      const startAt = rng.int(g.waypoints.length);
      const [sx, sy] = g.waypoints[startAt];
      const [nx, ny] = g.waypoints[(startAt + 1) % g.waypoints.length];
      return {
        x: sx,
        y: sy,
        face: Math.atan2(ny - sy, nx - sx),
        waypoints: g.waypoints,
        wp: (startAt + 1) % g.waypoints.length,
        pauseT: 0,
        alert: 0,
        mode: 'patrol', // patrol | investigate | chase | look
        target: null,
        lastSeen: null,
        lostT: 0,
        lookT: 0,
        scanPhase: rng.range(0, Math.PI * 2),
        id: gi,
      };
    });
    state.cameras = def.cameras.map((c) => ({ ...c, phase: rng.range(0, Math.PI * 2), sees: false }));
  }

  function moveGuardToward(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const stepLen = Math.min(dist, speed * dt);
    guard.face = Math.atan2(dy, dx);
    moveCircle(guard, (dx / dist) * stepLen, (dy / dist) * stepLen, GUARD.radius);
    return dist - stepLen < 6;
  }

  function stepGuard(guard, dt) {
    const p = state.player;
    const sight = guardSees(guard, p.x, p.y, p.sneak);
    if (sight.seen) {
      guard.alert = Math.min(1, guard.alert + GUARD.alertRise * dt);
      guard.lastSeen = { x: p.x, y: p.y };
      guard.lostT = 0;
      if (guard.alert >= GUARD.chaseAt) guard.mode = 'chase';
      else if (guard.alert >= GUARD.suspectAt && guard.mode === 'patrol') guard.mode = 'investigate';
    } else {
      guard.alert = Math.max(0, guard.alert - GUARD.alertFall * dt);
      guard.lostT += dt;
    }
    guard.sees = sight.seen;

    if (guard.mode === 'chase') {
      const target = sight.seen ? p : guard.lastSeen;
      if (!target || (guard.lostT > 2.5 && !sight.seen)) {
        guard.mode = 'investigate';
        guard.target = guard.lastSeen;
      } else if (moveGuardToward(guard, target.x, target.y, GUARD.chaseSpeed, dt) && !sight.seen) {
        guard.mode = 'look';
        guard.lookT = 1.6;
      }
      if (Math.hypot(p.x - guard.x, p.y - guard.y) < GUARD.catchDistance && guard.alert > 0.4) {
        bust('Caught by a guard');
      }
      return;
    }

    if (guard.mode === 'investigate') {
      const target = guard.target || guard.lastSeen;
      if (!target) {
        guard.mode = 'patrol';
        return;
      }
      if (moveGuardToward(guard, target.x, target.y, GUARD.suspectSpeed, dt)) {
        guard.mode = 'look';
        guard.lookT = 1.8;
      }
      return;
    }

    if (guard.mode === 'look') {
      guard.lookT -= dt;
      guard.face += Math.sin(state.time * 2.1 + guard.scanPhase) * 1.7 * dt;
      if (guard.lookT <= 0) {
        guard.mode = 'patrol';
        guard.target = null;
        // Resume at the nearest waypoint.
        let best = 0;
        let bestD = Infinity;
        guard.waypoints.forEach(([wx, wy], i) => {
          const d = Math.hypot(wx - guard.x, wy - guard.y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        guard.wp = best;
      }
      return;
    }

    // Patrol: walk the waypoint loop, pausing to scan at each corner.
    if (guard.pauseT > 0) {
      guard.pauseT -= dt;
      guard.face += Math.sin(state.time * 1.6 + guard.scanPhase) * 1.1 * dt;
      return;
    }
    const [tx, ty] = guard.waypoints[guard.wp];
    if (moveGuardToward(guard, tx, ty, GUARD.patrolSpeed, dt)) {
      guard.wp = (guard.wp + 1) % guard.waypoints.length;
      guard.pauseT = GUARD.pauseSeconds;
    }
  }

  function bust(reason) {
    if (state.status !== 'playing') return;
    state.status = 'busted';
    state.bustReason = reason;
    state.events.push(EVENT_BUST);
  }

  function step(dt, input) {
    state.events = [];
    if (state.status !== 'playing') return;
    state.time += dt;
    const p = state.player;

    // --- the thief ---
    p.sneak = !!input.sneak;
    p.coinCd = Math.max(0, p.coinCd - dt);
    const speed = p.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const mx = input.dir.x * speed * dt;
    const my = input.dir.y * speed * dt;
    if (mx !== 0 || my !== 0) {
      p.face = Math.atan2(input.dir.y, input.dir.x);
      moveCircle(p, mx, my, PLAYER.radius);
      p.stepAcc += speed * dt;
      if (p.stepAcc > 52) {
        p.stepAcc = 0;
        state.events.push(EVENT_STEP);
      }
    }
    for (const click of input.clicks || []) {
      if (p.coinCd > 0) continue;
      p.coinCd = PLAYER.coinCooldown;
      state.pings.push({ x: click.x, y: click.y, t: 0, ttl: 3.2 });
      state.events.push(EVENT_COIN);
      for (const g of state.guards) {
        if (Math.hypot(g.x - click.x, g.y - click.y) < 290 && g.mode !== 'chase') {
          g.mode = 'investigate';
          g.target = { x: click.x, y: click.y };
          g.alert = Math.max(g.alert, 0.34);
        }
      }
    }
    for (const ping of state.pings) ping.t += dt;
    state.pings = state.pings.filter((ping) => ping.t < ping.ttl);

    // --- loot and the vault ---
    for (const loot of state.loots) {
      if (!loot.taken && Math.hypot(p.x - loot.x, p.y - loot.y) < 24) {
        loot.taken = true;
        state.lootTaken += 1;
        state.score += loot.value;
        state.events.push(EVENT_LOOT);
      }
    }
    if (!state.vault.taken && Math.hypot(p.x - state.vault.x, p.y - state.vault.y) < 30) {
      state.vault.taken = true;
      state.lootTaken += 1;
      state.score += LOOT_VALUES.vault;
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.vaultJolt);
      state.hint = 'VAULT CRACKED — GET TO THE EXIT!';
      state.hintT = 3.2;
      state.events.push(EVENT_VAULT);
    }

    // --- watchers ---
    for (const g of state.guards) stepGuard(g, dt);
    if (state.status !== 'playing') return;

    let guardRate = 0;
    let anySeen = false;
    for (const g of state.guards) {
      if (g.sees) {
        anySeen = true;
        const d = Math.hypot(p.x - g.x, p.y - g.y);
        const rate = ALARM.guardRateFar + (ALARM.guardRateNear - ALARM.guardRateFar) * (1 - d / GUARD.visionRange);
        guardRate = Math.max(guardRate, rate);
      }
    }
    let camSeen = false;
    for (const cam of state.cameras) {
      cam.sees = cameraSees(cam, p.x, p.y, p.sneak).seen;
      if (cam.sees) camSeen = true;
    }
    state.seenNow = anySeen || camSeen;
    state.seenByCamera = camSeen;
    const before = state.alarm;
    if (state.seenNow) {
      state.alarm += (guardRate + (camSeen ? CAMERA.alarmRate : 0)) * dt;
    } else {
      state.alarm -= ALARM.drain * dt;
    }
    state.alarm = Math.max(0, Math.min(ALARM.max, state.alarm));
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    if (state.alarm > 45 && before <= 45) state.events.push(EVENT_WARN);
    if (state.alarm >= ALARM.max) {
      bust('The alarm tripped — security swarmed the floor');
      return;
    }

    if (state.hintT > 0) state.hintT -= dt;

    // --- the exit ---
    const e = state.exit;
    if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
      if (state.vault.taken) {
        const def = LEVELS[state.levelIndex];
        const timeBonus = Math.max(0, Math.round(def.par - state.time)) * 15;
        const ghostBonus = state.maxAlarm < 50 ? 1500 : 0;
        state.score += timeBonus + ghostBonus;
        state.status = state.levelIndex === LEVELS.length - 1 ? 'win' : 'clear';
        state.events.push(EVENT_CLEAR);
      } else if (state.hintT <= 0) {
        state.hint = 'THE EXIT IS LOCKED — CRACK THE VAULT FIRST';
        state.hintT = 1.6;
      }
    }
  }

  return {
    state,
    reset() {
      loadLevel(0, false);
    },
    loadLevel(index) {
      loadLevel(index, true);
    },
    step,
    cameraAngle,
    /** Is this point watched by any guard right now? (For staging and hints.) */
    pointSeenByGuards(x, y) {
      return state.guards.some((g) => guardSees(g, x, y, false).seen);
    },
    pointWatched(x, y) {
      return (
        state.guards.some((g) => guardSees(g, x, y, false).seen) ||
        state.cameras.some((c) => cameraSees(c, x, y, false).seen)
      );
    },
    guardSeesPlayer() {
      const p = state.player;
      return state.guards.some((g) => guardSees(g, p.x, p.y, p.sneak).seen);
    },
    nearestGuardDistance() {
      const p = state.player;
      let best = Infinity;
      for (const g of state.guards) best = Math.min(best, Math.hypot(g.x - p.x, g.y - p.y));
      return best;
    },
  };
}
