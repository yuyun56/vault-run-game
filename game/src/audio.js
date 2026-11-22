// Subtle synthesized sound, WebAudio only — no audio files. A soft tick for
// footsteps, a bright clink for a tossed coin, a chime arpeggio for loot, a
// rising blip while the alarm climbs and short stings for the bust, the
// clear and the win. Everything is created lazily on the first user gesture
// so the browser's autoplay rules are honoured, and every call is safe when
// audio is unavailable (headless runs, muted tabs).

export const SOUND_STEP = 'step';
export const SOUND_COIN = 'coin';
export const SOUND_LOOT = 'loot';
export const SOUND_VAULT = 'vault';
export const SOUND_WARN = 'warn';
export const SOUND_BUST = 'bust';
export const SOUND_CLEAR = 'clear';
export const SOUND_WIN = 'win';

export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, at, dur, type = 'sine', vol = 1, slideTo = null) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function noise(at, dur, vol) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(master);
    src.start(at);
  }

  return {
    unlock() {
      ensure();
    },
    play(name) {
      if (!ensure()) return;
      const t = ctx.currentTime + 0.01;
      switch (name) {
        case SOUND_STEP:
          noise(t, 0.05, 0.25);
          break;
        case SOUND_COIN:
          tone(2093, t, 0.09, 'triangle', 0.5);
          tone(2637, t + 0.05, 0.12, 'triangle', 0.35);
          break;
        case SOUND_LOOT:
          tone(1319, t, 0.1, 'sine', 0.5);
          tone(1760, t + 0.07, 0.14, 'sine', 0.45);
          break;
        case SOUND_VAULT:
          tone(523, t, 0.16, 'triangle', 0.55);
          tone(784, t + 0.1, 0.16, 'triangle', 0.5);
          tone(1047, t + 0.2, 0.26, 'triangle', 0.55);
          break;
        case SOUND_WARN:
          tone(880, t, 0.09, 'square', 0.22, 1175);
          break;
        case SOUND_BUST:
          tone(392, t, 0.2, 'sawtooth', 0.4, 196);
          tone(311, t + 0.16, 0.34, 'sawtooth', 0.4, 147);
          break;
        case SOUND_CLEAR:
          tone(784, t, 0.12, 'triangle', 0.5);
          tone(988, t + 0.09, 0.12, 'triangle', 0.5);
          tone(1319, t + 0.18, 0.22, 'triangle', 0.5);
          break;
        case SOUND_WIN:
          tone(659, t, 0.14, 'triangle', 0.5);
          tone(784, t + 0.12, 0.14, 'triangle', 0.5);
          tone(988, t + 0.24, 0.14, 'triangle', 0.5);
          tone(1319, t + 0.36, 0.34, 'triangle', 0.6);
          break;
        default:
          break;
      }
    },
  };
}
