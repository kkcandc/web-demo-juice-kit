/**
 * Layered hit voice built on Web Audio.
 * Each hit stacks a tick, a body thump, a sparkle, and (on heavy hits) a sub.
 * Those layers are procedural until you swap one for a sample.
 *
 * Drop in your own recordings (original or clearly licensed — never ripped arcade audio):
 *
 *   await sfx.unlock();
 *   const response = await fetch('/sfx/body.wav');
 *   const buffer = await decodeSample(sfx.context!, await response.arrayBuffer());
 *   sfx.setSample('body', buffer);
 *
 * Put files in the app's `public/sfx/` folder. A set sample replaces only that layer.
 */
import type { HitTier } from './types';

export type SfxLayer = 'swing' | 'tick' | 'body' | 'spark' | 'sub';

export interface LayeredHitSfx {
  /** Null until the first unlock or play attempt. */
  readonly context: AudioContext | null;
  /** Call from a click or key so the browser lets sound start. */
  unlock(): Promise<void>;
  playSwing(): void;
  playHit(tier: HitTier): void;
  /** Replace one procedural layer. Pass null to go back to synthesis. */
  setSample(layer: SfxLayer, buffer: AudioBuffer | null): void;
  dispose(): void;
}

const TIER_RATE: Record<HitTier, number> = {
  light: 1.18,
  medium: 1,
  heavy: 0.9,
  crush: 0.76,
};

/** Which layers fire for a tier. Useful in tests and custom mixers. */
export function layersForTier(tier: HitTier): SfxLayer[] {
  const layers: SfxLayer[] = ['tick', 'body', 'spark'];
  if (tier === 'heavy' || tier === 'crush') layers.push('sub');
  return layers;
}

export async function decodeSample(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return ctx.decodeAudioData(bytes.slice(0));
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createLayeredHitSfx(): LayeredHitSfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const samples = new Map<SfxLayer, AudioBuffer>();
  let pending: { kind: 'swing' } | { kind: 'hit'; tier: HitTier } | null = null;

  function ensureGraph(): AudioContext | null {
    const AudioCtor =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AudioCtor) return null;
    if (!ctx) {
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = 0.85;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 10;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.14;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      noise = noiseBuffer(ctx, 0.4);
    }
    return ctx;
  }

  function env(start: number, peak: number, seconds: number): GainNode | null {
    if (!ctx || !master) return null;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(start + 0.02, seconds));
    gain.connect(master);
    return gain;
  }

  function playBuffer(buffer: AudioBuffer, seconds: number, peak: number, rate: number) {
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = env(0.005, peak, seconds);
    if (!gain) return;
    source.connect(gain);
    source.start();
    source.stop(ctx.currentTime + seconds + 0.02);
  }

  function playTone(freq: number, endFreq: number, seconds: number, peak: number, type: OscillatorType) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + seconds);
    const gain = env(0.008, peak, seconds);
    if (!gain) return;
    osc.connect(gain);
    osc.start();
    osc.stop(now + seconds + 0.02);
  }

  function playSwingNow() {
    const sample = samples.get('swing');
    if (sample) {
      playBuffer(sample, 0.18, 0.35, 1);
      return;
    }
    if (noise) playBuffer(noise, 0.12, 0.12, 1.4);
    playTone(520, 180, 0.1, 0.06, 'triangle');
  }

  function playHitNow(tier: HitTier) {
    const rate = TIER_RATE[tier];
    const bodyLen = { light: 0.1, medium: 0.15, heavy: 0.22, crush: 0.3 }[tier];
    const bodyPeak = { light: 0.28, medium: 0.4, heavy: 0.5, crush: 0.58 }[tier];

    if (samples.get('tick')) playBuffer(samples.get('tick')!, 0.08, 0.4, rate);
    else if (noise) playBuffer(noise, 0.025, 0.22, 1.8 * rate);

    if (samples.get('body')) playBuffer(samples.get('body')!, bodyLen, bodyPeak, rate);
    else playTone(180 * rate, 55, bodyLen, bodyPeak, 'sine');

    if (samples.get('spark')) playBuffer(samples.get('spark')!, 0.16, 0.16, rate);
    else playTone(1400 * rate, 700, 0.09, tier === 'light' ? 0.04 : 0.07, 'square');

    if (tier === 'heavy' || tier === 'crush') {
      if (samples.get('sub')) playBuffer(samples.get('sub')!, 0.28, 0.45, rate);
      else playTone(70, 34, tier === 'crush' ? 0.32 : 0.22, 0.4, 'sine');
    }
  }

  function playOrQueue(job: { kind: 'swing' } | { kind: 'hit'; tier: HitTier }) {
    ensureGraph();
    if (!ctx || ctx.state !== 'running') {
      pending = job;
      return;
    }
    if (job.kind === 'swing') playSwingNow();
    else playHitNow(job.tier);
  }

  return {
    get context() {
      return ctx;
    },
    async unlock() {
      const audio = ensureGraph();
      if (!audio) return;
      if (audio.state === 'suspended') {
        try {
          await audio.resume();
        } catch {
          return;
        }
      }
      if (audio.state === 'running' && pending) {
        const job = pending;
        pending = null;
        if (job.kind === 'swing') playSwingNow();
        else playHitNow(job.tier);
      }
    },
    playSwing() {
      playOrQueue({ kind: 'swing' });
    },
    playHit(tier) {
      playOrQueue({ kind: 'hit', tier });
    },
    setSample(layer, buffer) {
      if (buffer) samples.set(layer, buffer);
      else samples.delete(layer);
    },
    dispose() {
      samples.clear();
      void ctx?.close();
      ctx = null;
      master = null;
      noise = null;
    },
  };
}
