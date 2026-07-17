// Synthesized WebAudio SFX — oscillators only, no audio files. The
// AudioContext is created lazily on first call (browser autoplay policy
// requires it to originate from a user gesture) and every entry point
// tolerates environments without WebAudio, such as the Vitest/Node runner.

const STORAGE_KEY = 'erosion:muted';
const TRICKLE_THROTTLE_MS = 220;

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadMutedPreference(storage = safeStorage()) {
  if (!storage) return false;
  return storage.getItem(STORAGE_KEY) === '1';
}

export function saveMutedPreference(muted, storage = safeStorage()) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, muted ? '1' : '0');
}

// Rate-throttle so a "trickle" tick fires periodically during active erosion
// rather than once per individual droplet (hundreds per second).
export function shouldPlayTrickle(lastPlayedAt, now, throttleMs = TRICKLE_THROTTLE_MS) {
  return now - lastPlayedAt >= throttleMs;
}

function getAudioContextClass() {
  return typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : undefined;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = loadMutedPreference();
    this.lastTrickleAt = -Infinity;
  }

  // Safe to call repeatedly; only constructs the AudioContext once. Must be
  // reached from within a user-gesture handler at least once for the
  // browser to allow audio output.
  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return null;
    try {
      this.ctx = new AudioContextClass();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = muted;
    saveMutedPreference(muted);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playTrickle(now = Date.now()) {
    if (this.muted) return;
    if (!shouldPlayTrickle(this.lastTrickleAt, now)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.lastTrickleAt = now;
    synthTrickle(ctx);
  }

  // A soft low thud for the reset/regenerate action — unthrottled, since
  // it's tied directly to a single deliberate click.
  playReset() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    synthReset(ctx);
  }

  // A gentle rising tone fired once when the simulation settles.
  playConverged() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    synthConverged(ctx);
  }
}

// A short descending sine blip with a fast attack/decay envelope, evoking a
// single water droplet tick rather than a sustained tone.
function synthTrickle(ctx) {
  const startAt = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520 + Math.random() * 180, startAt);
  osc.frequency.exponentialRampToValueAtTime(280, startAt + 0.09);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.05, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + 0.12);
}

// A low sine thud with a quick decay — a single physical "clunk," not a tone.
function synthReset(ctx) {
  const startAt = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, startAt);
  osc.frequency.exponentialRampToValueAtTime(70, startAt + 0.16);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.09, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + 0.22);
}

// A gentle two-note rise (a soft major third) signaling the terrain has
// settled into a stable shape.
function synthConverged(ctx) {
  const startAt = ctx.currentTime;
  [392, 494].forEach((frequency, index) => {
    const noteAt = startAt + index * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, noteAt);
    gain.gain.setValueAtTime(0.0001, noteAt);
    gain.gain.exponentialRampToValueAtTime(0.045, noteAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteAt + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(noteAt);
    osc.stop(noteAt + 0.37);
  });
}
