import { describe, it, expect, vi } from 'vitest';
import { loadMutedPreference, saveMutedPreference, shouldPlayTrickle, AudioEngine } from '../src/audio.js';

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
}

describe('loadMutedPreference / saveMutedPreference', () => {
  it('defaults to unmuted when nothing has been saved', () => {
    expect(loadMutedPreference(fakeStorage())).toBe(false);
  });

  it('round-trips a saved muted preference', () => {
    const storage = fakeStorage();
    saveMutedPreference(true, storage);
    expect(loadMutedPreference(storage)).toBe(true);
  });

  it('round-trips a saved unmuted preference after being muted', () => {
    const storage = fakeStorage();
    saveMutedPreference(true, storage);
    saveMutedPreference(false, storage);
    expect(loadMutedPreference(storage)).toBe(false);
  });

  it('treats a missing storage backend as unmuted without throwing', () => {
    expect(() => loadMutedPreference(null)).not.toThrow();
    expect(loadMutedPreference(null)).toBe(false);
  });

  it('is a no-op when saving with a missing storage backend', () => {
    expect(() => saveMutedPreference(true, null)).not.toThrow();
  });
});

describe('shouldPlayTrickle', () => {
  it('allows the very first play', () => {
    expect(shouldPlayTrickle(-Infinity, 1000)).toBe(true);
  });

  it('blocks a repeat call inside the throttle window', () => {
    expect(shouldPlayTrickle(1000, 1100, 220)).toBe(false);
  });

  it('allows a repeat call once the throttle window has elapsed', () => {
    expect(shouldPlayTrickle(1000, 1221, 220)).toBe(true);
  });

  it('treats the throttle boundary as inclusive', () => {
    expect(shouldPlayTrickle(1000, 1220, 220)).toBe(true);
  });
});

describe('AudioEngine', () => {
  it('starts unmuted by default in an environment with no storage/window', () => {
    const engine = new AudioEngine();
    expect(engine.muted).toBe(false);
  });

  it('does not throw calling playTrickle in an environment without WebAudio', () => {
    const engine = new AudioEngine();
    expect(() => engine.playTrickle(0)).not.toThrow();
  });

  it('ensureContext returns null when no AudioContext constructor exists', () => {
    const engine = new AudioEngine();
    expect(engine.ensureContext()).toBeNull();
  });

  it('toggleMuted flips state and persists it', () => {
    const engine = new AudioEngine();
    const storeSpy = vi.spyOn(engine, 'setMuted');
    const result = engine.toggleMuted();
    expect(result).toBe(true);
    expect(engine.muted).toBe(true);
    expect(storeSpy).toHaveBeenCalledWith(true);
  });

  it('playTrickle is throttled across repeated calls at the same instant', () => {
    const engine = new AudioEngine();
    engine.playTrickle(5000);
    const ctxAfterFirst = engine.ctx;
    engine.lastTrickleAt = 5000;
    engine.playTrickle(5050);
    expect(engine.ctx).toBe(ctxAfterFirst);
  });

  it('does nothing while muted', () => {
    const engine = new AudioEngine();
    engine.setMuted(true);
    engine.playTrickle(0);
    expect(engine.ctx).toBeNull();
  });

  it('playReset does not throw in an environment without WebAudio', () => {
    const engine = new AudioEngine();
    expect(() => engine.playReset()).not.toThrow();
  });

  it('playReset is a no-op while muted', () => {
    const engine = new AudioEngine();
    engine.setMuted(true);
    engine.playReset();
    expect(engine.ctx).toBeNull();
  });

  it('playConverged does not throw in an environment without WebAudio', () => {
    const engine = new AudioEngine();
    expect(() => engine.playConverged()).not.toThrow();
  });

  it('playConverged is a no-op while muted', () => {
    const engine = new AudioEngine();
    engine.setMuted(true);
    engine.playConverged();
    expect(engine.ctx).toBeNull();
  });
});
