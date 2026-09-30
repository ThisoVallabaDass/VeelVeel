import {
  extractFeatures,
  pcm16ToFloat,
  resampleMono,
  scoreFeatures,
  toPcm16,
  trimSilence,
} from '@veel-veel/dsp';
import type { AudioFeatures, ScoreBreakdown } from '@veel-veel/dsp';

export class MicCapture {
  private context?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private analyser?: AnalyserNode;
  private chunks: Float32Array[] = [];
  private capturing = false;

  async open(deviceId?: string) {
    const constraints: MediaTrackConstraints = {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    if (deviceId) constraints.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });
    this.context = new AudioContext();
    await this.context.audioWorklet.addModule('/audio-capture-worklet.js');
    this.node = new AudioWorkletNode(this.context, 'veel-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    const source = this.context.createMediaStreamSource(this.stream);
    const mute = this.context.createGain();
    mute.gain.value = 0;
    source.connect(this.node).connect(mute).connect(this.context.destination);
    source.connect(this.analyser);
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (this.capturing) this.chunks.push(new Float32Array(event.data));
    };
    await this.context.resume();
  }

  meter() {
    if (!this.analyser) return 0;
    const bytes = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(bytes);
    let energy = 0;
    for (const value of bytes) energy += ((value - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(energy / bytes.length) * 4.2);
  }

  start() {
    this.chunks = [];
    this.capturing = true;
  }
  stop(): Float32Array {
    this.capturing = false;
    const length = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Float32Array(length);
    let offset = 0;
    for (const chunk of this.chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    return buffer;
  }
  close() {
    this.capturing = false;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
  }
  get sampleRate() {
    return this.context?.sampleRate ?? 48_000;
  }
}

export type RoastFx = 'chipmunk' | 'deep' | 'megaphone' | 'echo' | 'reverse';
export interface ClipPlaybackOptions {
  playbackRate?: number;
  reverse?: boolean;
  effect?: 'megaphone' | 'echo';
}

export async function playClip(
  path: string,
  context?: AudioContext,
  options: ClipPlaybackOptions = {},
) {
  const ownsContext = !context;
  const audioContext = context ?? new AudioContext();
  await audioContext.resume();
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load sound clip (${response.status})`);
  const decoded = await audioContext.decodeAudioData(await response.arrayBuffer());
  if (options.reverse) {
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1)
      decoded.getChannelData(channel).reverse();
  }
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  source.playbackRate.value = options.playbackRate ?? 1;
  if (options.effect === 'megaphone') {
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1_150;
    bandpass.Q.value = 0.8;
    source.connect(bandpass).connect(audioContext.destination);
  } else if (options.effect === 'echo') {
    const delay = audioContext.createDelay(0.6);
    delay.delayTime.value = 0.24;
    const echoGain = audioContext.createGain();
    echoGain.gain.value = 0.32;
    source.connect(audioContext.destination);
    source.connect(delay).connect(echoGain).connect(audioContext.destination);
  } else source.connect(audioContext.destination);
  source.start();
  return new Promise<void>((resolve) => {
    source.onended = () => resolve();
    if (ownsContext)
      source.addEventListener(
        'ended',
        () =>
          window.setTimeout(() => void audioContext.close(), options.effect === 'echo' ? 500 : 0),
        { once: true },
      );
  });
}

/** Play one local take through a short, playful Web Audio effect chain. */
export async function playTake(samples: Float32Array, sampleRate: number, effect: RoastFx) {
  if (!samples.length) return;
  const context = new AudioContext();
  await context.resume();
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  const channel = buffer.getChannelData(0);
  channel.set(samples);
  if (effect === 'reverse') channel.reverse();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = effect === 'chipmunk' ? 1.55 : effect === 'deep' ? 0.68 : 1;
  if (effect === 'megaphone') {
    const bandpass = context.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1_150;
    bandpass.Q.value = 0.8;
    source.connect(bandpass).connect(context.destination);
  } else if (effect === 'echo') {
    const delay = context.createDelay(0.6);
    delay.delayTime.value = 0.24;
    const echoGain = context.createGain();
    echoGain.gain.value = 0.32;
    source.connect(context.destination);
    source.connect(delay).connect(echoGain).connect(context.destination);
  } else source.connect(context.destination);
  source.onended = () => {
    window.setTimeout(() => void context.close(), effect === 'echo' ? 500 : 0);
  };
  source.start();
}

export function scoreTake(
  samples: Float32Array,
  inputRate: number,
  reference: AudioFeatures,
): ScoreBreakdown {
  const resampled = resampleMono(samples, inputRate, 22_050);
  const trimmed = trimSilence(resampled, 22_050, -43, 50).samples;
  // Keep the game path byte-for-byte aligned with the documented 22.05 kHz PCM16 capture target.
  const pcm = toPcm16(trimmed, 8, 22_050);
  const take = extractFeatures(pcm16ToFloat(pcm), 22_050);
  return scoreFeatures(reference, take);
}
