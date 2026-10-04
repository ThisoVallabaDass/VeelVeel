import { pcm16ToFloat, resampleMono, toPcm16 } from '@veel-veel/dsp';

export function encodePcm(pcm: Int16Array) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodePcm(encoded: string) {
  const binary = atob(encoded);
  if (binary.length % 2 || binary.length > 352800) throw new Error('Invalid take length');
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) view.setUint8(i, binary.charCodeAt(i));
  const pcm = new Int16Array(binary.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(i * 2, true);
  return pcm16ToFloat(pcm);
}

/** One gesture-unlocked context for scheduled references, replays and room voice. */
export class PartyAudio {
  readonly context = new AudioContext();
  private analyser = this.context.createAnalyser();
  constructor() { this.analyser.fftSize = 256; this.analyser.connect(this.context.destination); }
  meter() {
    const values = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(values);
    return Math.min(1, Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length) * 4);
  }
  private sources = new Set<AudioBufferSourceNode>();
  private voiceEnds = new Map<string, number>();
  private reference?: AudioBuffer;
  private pending: Float32Array[] = [];
  private frames = 0;
  async unlock() { await this.context.resume(); }
  async load(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Sound could not load. Check your connection.');
    this.reference = await this.context.decodeAudioData(await response.arrayBuffer());
  }
  playReference(delayMs: number) {
    if (!this.reference) throw new Error('Reference is not ready.');
    this.play(this.reference, this.context.currentTime + delayMs / 1000);
  }
  playPcm(encoded: string, sampleRate = 22050, speaker?: string) {
    const samples = decodePcm(encoded);
    if (!samples.length) return;
    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const start = speaker ? Math.max(this.context.currentTime + 0.03, this.voiceEnds.get(speaker) ?? 0) : this.context.currentTime;
    if (speaker) this.voiceEnds.set(speaker, start + buffer.duration);
    this.play(buffer, start);
  }
  private play(buffer: AudioBuffer, when: number) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start(when);
  }
  voiceFrame(samples: Float32Array, sampleRate: number, enabled: boolean, send: (pcm: string) => void) {
    if (!enabled) { this.pending = []; this.frames = 0; return; }
    this.pending.push(new Float32Array(samples));
    this.frames += samples.length;
    if (this.frames < sampleRate * 0.16) return;
    const audio = new Float32Array(this.frames);
    let offset = 0;
    for (const chunk of this.pending) { audio.set(chunk, offset); offset += chunk.length; }
    this.pending = []; this.frames = 0;
    send(encodePcm(toPcm16(resampleMono(audio, sampleRate, 16000), 0.25, 16000)));
  }
  stop() {
    for (const source of this.sources) source.stop();
    this.sources.clear(); this.voiceEnds.clear();
  }
  close() { this.stop(); void this.context.close(); }
}
