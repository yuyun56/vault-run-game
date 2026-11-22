// Keyboard and mouse, read as state rather than events: the loop asks each
// frame which way the thief should move, whether he is sneaking, and where
// the player clicked (a coin toss). Confirm / pause / restart are edge
// actions, consumed once by whoever asks first.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';

const KEY_DIRS = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

export function createInput(target) {
  const held = new Set();
  const actions = new Set();
  const clicks = [];

  function onKeyDown(event) {
    if (KEY_DIRS[event.code] || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add(event.code);
      event.preventDefault();
    }
    if (event.code === 'Enter' || event.code === 'Space') actions.add(ACTION_CONFIRM);
    if (event.code === 'KeyP' || event.code === 'Escape') actions.add(ACTION_PAUSE);
    if (event.code === 'KeyR') actions.add(ACTION_RESTART);
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    /** Register a click in logical field coordinates (the caller converts). */
    pushClick(point) {
      clicks.push(point);
    },
    /** Read the current move intent: a unit direction (or zero), sneak flag, and pending clicks. */
    read() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const dir = KEY_DIRS[code];
        if (dir) {
          x += dir.x;
          y += dir.y;
        }
      }
      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
      }
      const sneak = held.has('ShiftLeft') || held.has('ShiftRight');
      const out = clicks.splice(0, clicks.length);
      return { dir: { x, y }, sneak, clicks: out };
    },
    /** True once per press of the named action. */
    take(action) {
      if (!actions.has(action)) return false;
      actions.delete(action);
      return true;
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
