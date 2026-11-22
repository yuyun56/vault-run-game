// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, paused, level clear, game over and victory.
//
// ?seed=N fixes the random pattern. ?shot=vault|ambush|gallery|escape
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BUST,
  EVENT_CLEAR,
  EVENT_COIN,
  EVENT_LOOT,
  EVENT_STEP,
  EVENT_VAULT,
  EVENT_WARN,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import {
  SOUND_BUST,
  SOUND_CLEAR,
  SOUND_COIN,
  SOUND_LOOT,
  SOUND_STEP,
  SOUND_VAULT,
  SOUND_WARN,
  SOUND_WIN,
  createAudio,
} from './audio.js';
import { createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'vault-run-best';
/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const input = createInput(window);
const audio = createAudio();

let screen = SCREEN_TITLE;
let best = readBest();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function announce(text) {
  if (status) status.textContent = text;
}

function playEvents(events) {
  for (const e of events) {
    if (e === EVENT_STEP) audio.play(SOUND_STEP);
    else if (e === EVENT_COIN) audio.play(SOUND_COIN);
    else if (e === EVENT_LOOT) audio.play(SOUND_LOOT);
    else if (e === EVENT_VAULT) audio.play(SOUND_VAULT);
    else if (e === EVENT_WARN) audio.play(SOUND_WARN);
    else if (e === EVENT_BUST) audio.play(SOUND_BUST);
    else if (e === EVENT_CLEAR) audio.play(world.state.status === 'win' ? SOUND_WIN : SOUND_CLEAR);
  }
}

function syncScreenFromWorld() {
  const s = world.state.status;
  if (s === 'busted') screen = SCREEN_OVER;
  else if (s === 'clear') screen = SCREEN_LEVEL;
  else if (s === 'win') screen = SCREEN_WIN;
  if (world.state.score > best) {
    best = world.state.score;
    saveBest(best);
  }
}

function confirm() {
  audio.unlock();
  if (screen === SCREEN_TITLE) {
    world.reset();
    screen = SCREEN_PLAY;
    announce('The heist begins. Crack the vault and reach the exit.');
  } else if (screen === SCREEN_LEVEL) {
    world.loadLevel(world.state.levelIndex + 1);
    screen = SCREEN_PLAY;
    announce(`Floor ${world.state.levelIndex + 1}: ${world.state.levelName}.`);
  } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
    world.reset();
    screen = SCREEN_PLAY;
    announce('A fresh run. The floor is watching.');
  } else if (screen === SCREEN_PAUSED) {
    screen = SCREEN_PLAY;
  }
}

canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (screen !== SCREEN_PLAY) {
    confirm();
    return;
  }
  const point = renderer.toField(event.clientX, event.clientY);
  if (point.x >= 0 && point.y >= 0 && point.x <= 1280 && point.y <= 720) {
    input.pushClick(point);
  }
});

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

world.reset();

if (shot) {
  runShot(shot);
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    if (dt < 0) dt = 0;

    if (input.take(ACTION_CONFIRM)) confirm();
    if (input.take(ACTION_RESTART) && screen !== SCREEN_TITLE) {
      world.reset();
      screen = SCREEN_PLAY;
    }
    if (input.take(ACTION_PAUSE)) {
      if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }

    if (screen === SCREEN_PLAY) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        world.step(STEP, input.read());
        playEvents(world.state.events);
        if (world.state.status !== 'playing') {
          syncScreenFromWorld();
          break;
        }
      }
    }
    renderer.draw(world.state, screen, best);
  }
  requestAnimationFrame(frame);
}
