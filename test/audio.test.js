import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadMutedPreference, saveMutedPreference, shouldPlayTrickle, AudioEngine } from '../src/audio.js';

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
}

// A minimal stand-in for the WebAudio nodes the synth functions drive, so the
// oscillator/gain scheduling code (otherwise unreachable under Node) runs and
// can be asserted on instead of only exercising the "no WebAudio" guards.
function fakeAudioContextClass() {
  const created = { oscillators: [], gains: [] };
  class FakeParam {
    constructor() {
      this.calls = [];
    }
    setValueAtTime(value, at) {
      this.calls.push(['set', value, at]);
    }
    exponentialRampToValueAtTime(value, at) {
      this.calls.push(['ramp', value, at]);
    }
  }
  class FakeOscillator {
    constructor() {
      this.type = null;
      this.frequency = new FakeParam();
      this.started = null;
      this.stopped = null;
      this.connectedTo = null;
      created.oscillators.push(this);
    }
    connect(node) {
      this.connectedTo = node;
      return node;
    }
    start(at) {
      this.started = at;
    }
    stop(at) {
      this.stopped = at;
    }
  }
  class FakeGain {
    constructor() {
      this.gain = new FakeParam();
      created.gains.push(this);
    }
    connect(node) {
      return node;
    }
  }
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = { id: 'destination' };
    }
    createOscillator() {
      return new FakeOscillator();
    }
    createGain() {
      return new FakeGain();
    }
  }
  return { FakeAudioContext, created };
}

describe('loadMutedPreference / saveMutedPreference', () => {
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('defaults to unmuted when nothing has been saved', () => {
    expect(loadMutedPreference(fakeStorage())).toBe(false);
  });

  it('treats a throwing localStorage getter as unmuted without throwing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('access denied');
      },
      configurable: true,
    });
    expect(() => loadMutedPreference()).not.toThrow();
    expect(loadMutedPreference()).toBe(false);
  });

  it('reads through to a real global localStorage by default', () => {
    const backing = fakeStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: backing,
      configurable: true,
    });
    backing.setItem('erosion:muted', '1');
    expect(loadMutedPreference()).toBe(true);
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

describe('AudioEngine with a WebAudio-capable window', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays a descending sine blip through the oscillator/gain graph on playTrickle', () => {
    const { FakeAudioContext, created } = fakeAudioContextClass();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const engine = new AudioEngine();
    engine.playTrickle(0);

    expect(engine.ctx).toBeInstanceOf(FakeAudioContext);
    expect(created.oscillators).toHaveLength(1);
    const osc = created.oscillators[0];
    expect(osc.type).toBe('sine');
    expect(osc.connectedTo).not.toBeNull();
    expect(osc.started).toBe(0);
    expect(osc.stopped).toBeGreaterThan(0);
    expect(osc.frequency.calls[0][0]).toBe('set');
    expect(created.gains[0].gain.calls.some(([kind]) => kind === 'ramp')).toBe(true);
  });

  it('reuses the same AudioContext across repeated calls', () => {
    const { FakeAudioContext } = fakeAudioContextClass();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const engine = new AudioEngine();
    engine.playTrickle(0);
    const ctxAfterFirst = engine.ctx;
    engine.playTrickle(1000);
    expect(engine.ctx).toBe(ctxAfterFirst);
  });

  it('falls back to webkitAudioContext when AudioContext is unavailable', () => {
    const { FakeAudioContext } = fakeAudioContextClass();
    vi.stubGlobal('window', { webkitAudioContext: FakeAudioContext });

    const engine = new AudioEngine();
    engine.playReset();
    expect(engine.ctx).toBeInstanceOf(FakeAudioContext);
  });

  it('plays a low thud with a single oscillator on playReset', () => {
    const { FakeAudioContext, created } = fakeAudioContextClass();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const engine = new AudioEngine();
    engine.playReset();

    expect(created.oscillators).toHaveLength(1);
    expect(created.oscillators[0].frequency.calls[0][1]).toBe(140);
  });

  it('plays a rising two-note chime with two oscillators on playConverged', () => {
    const { FakeAudioContext, created } = fakeAudioContextClass();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const engine = new AudioEngine();
    engine.playConverged();

    expect(created.oscillators).toHaveLength(2);
    expect(created.oscillators[0].frequency.calls[0][1]).toBe(392);
    expect(created.oscillators[1].frequency.calls[0][1]).toBe(494);
    expect(created.oscillators[1].started).toBeGreaterThan(created.oscillators[0].started);
  });

  it('ensureContext swallows a constructor that throws and returns null', () => {
    class ThrowingAudioContext {
      constructor() {
        throw new Error('denied by browser policy');
      }
    }
    vi.stubGlobal('window', { AudioContext: ThrowingAudioContext });

    const engine = new AudioEngine();
    expect(engine.ensureContext()).toBeNull();
    expect(engine.ctx).toBeNull();
  });

  it('ensureContext only constructs the AudioContext once', () => {
    const { FakeAudioContext } = fakeAudioContextClass();
    const ctor = vi.fn(() => new FakeAudioContext());
    vi.stubGlobal('window', { AudioContext: ctor });

    const engine = new AudioEngine();
    engine.ensureContext();
    engine.ensureContext();
    expect(ctor).toHaveBeenCalledTimes(1);
  });
});
