// Every sound is synthesised live with WebAudio: no audio files, no network.
// The context starts on the first user gesture, so the title screen is silent
// until the player begins; every call is guarded, so a browser without audio
// simply plays quiet.

import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let context = null;
  let master = null;
  let muted = readMuted();

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** One short tone: a frequency that slides to `to`, over `seconds`. */
  function tone(from, to, seconds, type, volume, delay = 0) {
    if (!ensure() || muted) return;
    try {
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.05);
    } catch {
      // A failed note never stops the game.
    }
  }

  /** A soft burst of noise, for the hurt thud and the ember sparkle. */
  function noise(seconds, volume, delay = 0) {
    if (!ensure() || muted) return;
    try {
      const start = context.currentTime + delay;
      const length = Math.max(1, Math.floor(context.sampleRate * seconds));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // A failed burst never stops the game.
    }
  }

  return {
    /** Call on the first gesture so the context is allowed to sound. */
    unlock() {
      if (ensure() && context.state === 'suspended') {
        context.resume().catch(() => {});
      }
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // The setting simply does not persist.
      }
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** An ember picked up; the pitch climbs with the combo. */
    ember(combo) {
      const base = 660 + Math.min(combo, 8) * 40;
      tone(base, base * 1.5, 0.12, 'sine', 0.25);
      tone(base * 2, base * 2.5, 0.1, 'triangle', 0.1, 0.04);
    },
    /** A lantern catches: a warm major chord, one note at a time. */
    lantern() {
      tone(392, 392, 0.35, 'triangle', 0.22);
      tone(494, 494, 0.35, 'triangle', 0.2, 0.09);
      tone(587, 587, 0.5, 'triangle', 0.22, 0.18);
      tone(784, 784, 0.6, 'sine', 0.14, 0.27);
    },
    /** A shadow's touch: a low thud and a burst of static. */
    hurt() {
      tone(160, 55, 0.25, 'sawtooth', 0.3);
      noise(0.18, 0.2);
    },
    /** A level cleared: a rising arpeggio. */
    clear() {
      [523, 659, 784, 1047].forEach((note, index) => {
        tone(note, note, 0.3, 'triangle', 0.2, index * 0.1);
      });
    },
    /** The last lantern of the last level: a longer, brighter arpeggio. */
    win() {
      [523, 659, 784, 1047, 1319, 1568].forEach((note, index) => {
        tone(note, note, 0.45, 'triangle', 0.2, index * 0.12);
      });
    },
    /** The light goes out. */
    over() {
      tone(330, 82, 0.9, 'sine', 0.25);
      tone(220, 55, 1.1, 'triangle', 0.15, 0.1);
    },
    /** A button pressed. */
    click() {
      tone(880, 660, 0.06, 'sine', 0.15);
    },
    /** The exit gate swings open. */
    gate() {
      tone(262, 523, 0.4, 'sine', 0.18);
      tone(392, 784, 0.4, 'sine', 0.12, 0.08);
    },
  };
}
