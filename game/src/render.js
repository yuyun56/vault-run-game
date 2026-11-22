// Canvas renderer for Vault Run. The world is a fixed 1280x720 stage; the
// canvas fills the window and the stage is scaled to fit and centred, so a
// screenshot always shows the same framing. Vision cones are drawn by
// casting real rays that stop at walls and cover — what the player sees is
// exactly what the guards and cameras can see.

import { ALARM, CAMERA, COLORS, FIELD, GUARD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TILE = 40;

/** Distance from (ox, oy) along `ang` to the nearest rect edge, capped at max. */
function rayDistance(ox, oy, ang, max, rects) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let best = max;
  for (const r of rects) {
    let tmin = 0;
    let tmax = best;
    if (Math.abs(dx) < 1e-9) {
      if (ox < r.x || ox > r.x + r.w) continue;
    } else {
      let t1 = (r.x - ox) / dx;
      let t2 = (r.x + r.w - ox) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmax < tmin) continue;
    }
    if (Math.abs(dy) < 1e-9) {
      if (oy < r.y || oy > r.y + r.h) continue;
    } else {
      let t1 = (r.y - oy) / dy;
      let t2 = (r.y + r.h - oy) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmax < tmin) continue;
    }
    if (tmin > 0 && tmin < best) best = tmin;
  }
  return best;
}

function conePath(ctx, x, y, facing, halfAngle, range, rects) {
  const rays = 26;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= rays; i += 1) {
    const ang = facing - halfAngle + (2 * halfAngle * i) / rays;
    const d = rayDistance(x, y, ang, range, rects);
    ctx.lineTo(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    view.scale = Math.min(view.w / FIELD.width, view.h / FIELD.height);
    view.ox = (view.w - FIELD.width * view.scale) / 2;
    view.oy = (view.h - FIELD.height * view.scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCone(x, y, facing, halfAngle, range, rects, fill) {
    conePath(ctx, x, y, facing, halfAngle, range, rects);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawFloor(state) {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = COLORS.floorAlt;
    for (let y = 0; y < FIELD.height / TILE; y += 1) {
      for (let x = 0; x < FIELD.width / TILE; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // A deep-red carpet down the middle of every floor: the thief's stage.
    ctx.fillStyle = COLORS.carpet;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(24, 330, FIELD.width - 48, 60);
    ctx.globalAlpha = 1;
  }

  function drawExit(state) {
    const e = state.exit;
    const open = state.vault.taken;
    ctx.save();
    ctx.shadowColor = open ? COLORS.safe : COLORS.danger;
    ctx.shadowBlur = open ? 22 : 10;
    ctx.fillStyle = open ? '#14532d' : '#3d2b12';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.restore();
    ctx.strokeStyle = open ? COLORS.safe : '#a97b2f';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
    ctx.fillStyle = open ? '#b7f4c9' : '#e8c87a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2 - 2);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(open ? 'OPEN' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 + 14);
  }

  function drawVault(state) {
    const v = state.vault;
    const s = 62;
    const x = v.x - s / 2;
    const y = v.y - s / 2;
    ctx.save();
    if (!v.taken) {
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 24;
    }
    ctx.fillStyle = v.taken ? '#2c2416' : '#8a6d1f';
    ctx.fillRect(x, y, s, s);
    ctx.restore();
    ctx.strokeStyle = v.taken ? '#5c4c22' : COLORS.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
    // The wheel.
    ctx.beginPath();
    ctx.arc(v.x, v.y, 15, 0, Math.PI * 2);
    ctx.strokeStyle = v.taken ? '#6b5a28' : '#ffe89a';
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      const a = (i * Math.PI * 2) / 3 + 0.5;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(v.x + Math.cos(a) * 15, v.y + Math.sin(a) * 15);
      ctx.stroke();
    }
    ctx.fillStyle = v.taken ? '#9d8c55' : '#fff3c4';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.taken ? 'CRACKED' : 'VAULT', v.x, y - 8);
  }

  function drawLoot(state) {
    for (const loot of state.loots) {
      if (loot.taken) continue;
      const { x, y } = loot;
      const bob = Math.sin(state.time * 3 + x) * 2;
      ctx.save();
      ctx.translate(x, y + bob);
      if (loot.kind === 'gem') {
        ctx.shadowColor = COLORS.gem;
        ctx.shadowBlur = 14;
        ctx.fillStyle = COLORS.gem;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(5, -2);
        ctx.lineTo(-5, -2);
        ctx.closePath();
        ctx.fill();
      } else if (loot.kind === 'gold') {
        ctx.shadowColor = COLORS.gold;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#d9a72e';
        ctx.beginPath();
        ctx.arc(0, 3, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-4, -12, 8, 7);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#5c430a';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 8);
      } else if (loot.kind === 'crown') {
        ctx.shadowColor = COLORS.gold;
        ctx.shadowBlur = 16;
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.moveTo(-13, 8);
        ctx.lineTo(-13, -6);
        ctx.lineTo(-6, 1);
        ctx.lineTo(0, -10);
        ctx.lineTo(6, 1);
        ctx.lineTo(13, -6);
        ctx.lineTo(13, 8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#c22f4e';
        ctx.beginPath();
        ctx.arc(0, 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // A framed painting.
        ctx.fillStyle = '#7a5a22';
        ctx.fillRect(-16, -13, 32, 26);
        ctx.fillStyle = '#274b63';
        ctx.fillRect(-12, -9, 24, 18);
        ctx.fillStyle = '#9fd8a8';
        ctx.beginPath();
        ctx.moveTo(-12, 9);
        ctx.lineTo(-2, -3);
        ctx.lineTo(5, 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f2e39a';
        ctx.beginPath();
        ctx.arc(6, -4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawSolids(state) {
    for (const c of state.covers) {
      ctx.fillStyle = COLORS.cover;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = COLORS.coverEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.fillStyle = 'rgba(242,193,78,0.5)';
      const n = Math.max(1, Math.floor(c.w / 26));
      for (let i = 0; i < n; i += 1) {
        ctx.beginPath();
        ctx.arc(c.x + 13 + i * 26, c.y + c.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const w of state.walls) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = COLORS.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    }
  }

  function drawGuard(state, g) {
    // Body: a navy uniform with a peaked cap turned to face his view.
    ctx.fillStyle = '#24457c';
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9db9e2';
    ctx.lineWidth = 2;
    ctx.stroke();
    const fx = Math.cos(g.face);
    const fy = Math.sin(g.face);
    ctx.fillStyle = '#16294a';
    ctx.beginPath();
    ctx.arc(g.x + fx * 5, g.y + fy * 5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(g.x + fx * 11 - 2, g.y + fy * 11 - 2, 4, 4);
    if (g.mode === 'chase') {
      ctx.fillStyle = COLORS.danger;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 24);
    } else if (g.alert > 0.25) {
      ctx.fillStyle = '#ffb02e';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 23);
    }
    if (g.alert > 0.03) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(g.x - 14, g.y - 36, 28, 4);
      ctx.fillStyle = g.mode === 'chase' ? COLORS.danger : '#ffb02e';
      ctx.fillRect(g.x - 14, g.y - 36, 28 * Math.min(1, g.alert), 4);
    }
  }

  function drawCamera(state, cam, angle) {
    ctx.fillStyle = '#10141d';
    ctx.fillRect(cam.x - 9, cam.y - 9, 18, 18);
    ctx.strokeStyle = '#5b6b80';
    ctx.lineWidth = 2;
    ctx.strokeRect(cam.x - 9, cam.y - 9, 18, 18);
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    ctx.fillStyle = cam.sees ? COLORS.danger : '#cfd8e3';
    ctx.beginPath();
    ctx.arc(cam.x + fx * 5, cam.y + fy * 5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    const blink = Math.sin(state.time * 4 + cam.phase) > 0;
    ctx.fillStyle = cam.sees ? COLORS.danger : blink ? '#ff8a7a' : '#571f1a';
    ctx.beginPath();
    ctx.arc(cam.x - 5, cam.y - 5, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.save();
    if (p.sneak) ctx.globalAlpha = 0.88;
    // The loot sack grows on his back as the take grows.
    if (state.lootTaken > 0) {
      ctx.fillStyle = '#8a6d3b';
      ctx.beginPath();
      ctx.arc(p.x - Math.cos(p.face) * 13, p.y - Math.sin(p.face) * 13, 7 + Math.min(5, state.lootTaken), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#141a26';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8ecf3';
    ctx.lineWidth = 2;
    ctx.stroke();
    // The mask band, across his facing.
    const fx = Math.cos(p.face);
    const fy = Math.sin(p.face);
    ctx.strokeStyle = '#e8ecf3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x + fx * 8 - fy * 6, p.y + fy * 8 + fx * 6);
    ctx.lineTo(p.x + fx * 8 + fy * 6, p.y + fy * 8 - fx * 6);
    ctx.stroke();
    ctx.restore();
    if (state.seenNow) {
      ctx.fillStyle = COLORS.danger;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 22);
    }
  }

  function drawHud(state, best) {
    ctx.fillStyle = 'rgba(6,9,14,0.82)';
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.strokeStyle = 'rgba(120,150,190,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(FIELD.width, 46);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`LOOT $${state.score.toLocaleString('en-US')}`, 18, 31);
    ctx.fillStyle = '#9fb4cc';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`${state.lootTaken}/${state.lootTotal} pieces`, 20, 44 - 2);

    // The alarm meter, centre stage: the one number the run hangs on.
    const mw = 380;
    const mx = FIELD.width / 2 - mw / 2;
    ctx.fillStyle = '#e8ecf3';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.seenNow ? '— SPOTTED —' : 'ALARM', FIELD.width / 2, 15);
    ctx.fillStyle = '#2a1416';
    ctx.fillRect(mx, 20, mw, 14);
    const frac = state.alarm / ALARM.max;
    const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    grad.addColorStop(0, '#ffb02e');
    grad.addColorStop(0.7, '#ff7a3c');
    grad.addColorStop(1, COLORS.danger);
    ctx.fillStyle = grad;
    if (frac > 0) ctx.fillRect(mx, 20, mw * frac, 14);
    ctx.strokeStyle = state.alarm > 70 && Math.sin(state.time * 10) > 0 ? COLORS.danger : '#7d8ea6';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, 20, mw, 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8ecf3';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(state.levelName, FIELD.width - 18, 24);
    ctx.fillStyle = '#9fb4cc';
    ctx.font = '13px system-ui, sans-serif';
    const secs = Math.floor(state.time);
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    ctx.fillText(`time ${clock} · best $${best.toLocaleString('en-US')}`, FIELD.width - 18, 42);

    if (state.hintT > 0 && state.hint) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 19px system-ui, sans-serif';
      const w = ctx.measureText(state.hint).width + 36;
      ctx.fillStyle = 'rgba(6,9,14,0.75)';
      ctx.fillRect(FIELD.width / 2 - w / 2, FIELD.height - 58, w, 34);
      ctx.fillStyle = '#ffe89a';
      ctx.fillText(state.hint, FIELD.width / 2, FIELD.height - 35);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,214,232,0.66)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD/arrows move · Shift sneak · Click toss a coin · P pause · R restart', 18, FIELD.height - 10);
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(4,6,10,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = 'rgba(10,15,24,0.95)';
    ctx.fillRect(FIELD.width / 2 - 330, 168, 660, 384);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(FIELD.width / 2 - 330, 168, 660, 384);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(title, FIELD.width / 2, 248);
    ctx.fillStyle = '#dbe5f2';
    ctx.font = '19px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, 308 + i * 32);
    });
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);

    drawFloor(state);
    const rects = state.walls.concat(state.covers);

    // Watchers' cones first, so bodies and furniture sit on top of them.
    for (const cam of state.cameras) {
      const ang = camAngleOf(state, cam);
      drawCone(cam.x, cam.y, ang, CAMERA.visionHalfAngle, CAMERA.visionRange, rects, cam.sees ? 'rgba(255,60,45,0.30)' : 'rgba(255,90,60,0.16)');
    }
    for (const g of state.guards) {
      const fill = g.mode === 'chase' ? 'rgba(255,60,45,0.34)' : g.alert > 0.25 ? 'rgba(255,150,50,0.26)' : 'rgba(255,205,80,0.17)';
      drawCone(g.x, g.y, g.face, GUARD.visionHalfAngle, GUARD.visionRange, rects, fill);
    }

    drawExit(state);
    drawVault(state);
    drawLoot(state);

    // Coin pings: a bright ring where the toss landed.
    for (const ping of state.pings) {
      const f = ping.t / ping.ttl;
      ctx.strokeStyle = `rgba(242,193,78,${0.85 * (1 - f)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 6 + f * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawSolids(state);
    for (const cam of state.cameras) drawCamera(state, cam, camAngleOf(state, cam));
    for (const g of state.guards) drawGuard(state, g);
    drawPlayer(state);
    drawHud(state, best);

    if (screen === SCREEN_TITLE) {
      panel('VAULT RUN', [
        'Cross the floor. Crack the vault. Vanish with the loot.',
        '',
        'Stay out of the guards’ cones and the cameras’ sweep —',
        'being watched fills the ALARM meter. Full meter, or a',
        'guard’s hands on you, and the run is busted.',
        '',
        'WASD / arrows move · Shift sneak · Click toss a coin',
      ], COLORS.gold);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe89a';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText('Click or press Enter to start', FIELD.width / 2, 600);
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['The floor holds its breath.', '', 'Press P or click to resume.'], '#9db9e2');
    } else if (screen === SCREEN_LEVEL) {
      panel('CLEAN GETAWAY', [
        `${state.levelName} emptied.`,
        `Loot so far: $${state.score.toLocaleString('en-US')}`,
        '',
        'The next floor is already watching.',
      ], COLORS.safe);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b7f4c9';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText('Click or press Enter for the next floor', FIELD.width / 2, 600);
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_OVER) {
      panel('BUSTED', [
        state.bustReason || 'Caught.',
        `You lifted $${state.score.toLocaleString('en-US')} before it ended.`,
        '',
        'Every patrol walks the same route — learn it, use the cover,',
        'and let the meter drain before you cross an open floor.',
      ], COLORS.danger);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb3ab';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText('Press R or click to try again', FIELD.width / 2, 600);
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_WIN) {
      panel('THE PERFECT SCORE', [
        'All three floors emptied, vault cracked, no cell door slammed.',
        `Final take: $${state.score.toLocaleString('en-US')}`,
        '',
        'Somewhere a bank manager is having a very bad morning.',
      ], COLORS.gold);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe89a';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText('Press R or click to run it again', FIELD.width / 2, 600);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  function camAngleOf(state, cam) {
    return cam.base + Math.sin(state.time * cam.speed + cam.phase) * cam.sweep;
  }

  return {
    draw,
    /** Convert a client (CSS pixel) point to logical field coordinates. */
    toField(clientX, clientY) {
      return {
        x: (clientX - view.ox) / view.scale,
        y: (clientY - view.oy) / view.scale,
      };
    },
  };
}
