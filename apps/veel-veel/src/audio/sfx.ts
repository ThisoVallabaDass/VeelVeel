type Cue = 'start' | 'record' | 'gavel' | 'cheer' | 'boo' | 'next';
let audio: AudioContext | null = null;

/** Short original Web Audio cues; no downloaded sound files or microphone input. */
export function playCue(cue: Cue) {
  try {
    audio ??= new AudioContext();
    const context = audio;
    void context.resume();
    const now = context.currentTime;
    const tone = (frequency: number, at: number, length: number, volume: number, type: OscillatorType = 'sine') => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + length + 0.01);
    };
    const noise = (at: number, length: number, volume: number, highpass: number) => {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(at);
      source.stop(at + length);
    };
    if (cue === 'start') {
      [440, 554, 659].forEach((frequency, index) => tone(frequency, now + index * 0.1, 0.17, 0.09, 'triangle'));
    } else if (cue === 'record') {
      tone(880, now, 0.11, 0.10, 'square');
      tone(440, now + 0.11, 0.1, 0.06, 'square');
    } else if (cue === 'gavel') {
      tone(166, now, 0.18, 0.18, 'triangle');
      noise(now, 0.075, 0.08, 650);
    } else if (cue === 'cheer') {
      [392, 494, 587, 784].forEach((frequency, index) => tone(frequency, now + index * 0.065, 0.36, 0.06, 'sawtooth'));
      noise(now, 0.48, 0.045, 1200);
    } else if (cue === 'boo') {
      tone(206, now, 0.35, 0.07, 'sawtooth');
      tone(181, now + 0.15, 0.34, 0.06, 'sawtooth');
    } else if (cue === 'next') {
      noise(now, 0.22, 0.04, 2400);
      tone(660, now + 0.1, 0.15, 0.08, 'triangle');
    }
  } catch {
    // Muted or unsupported audio must never stop a round.
  }
}
