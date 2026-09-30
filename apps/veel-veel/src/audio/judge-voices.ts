type JudgeId = 'anna' | 'akka' | 'paati';
const personas: Record<JudgeId, { pitch: number; rate: number; voiceIndex: number }> = {
  anna: { pitch: 0.75, rate: 1.16, voiceIndex: 0 },
  akka: { pitch: 1.32, rate: 1.04, voiceIndex: 1 },
  paati: { pitch: 0.91, rate: 0.87, voiceIndex: 2 },
};

export function judgeVoicesEnabled() {
  try { return localStorage.getItem('veel-judge-voices') !== 'off'; }
  catch { return true; }
}

export function setJudgeVoicesEnabled(enabled: boolean) {
  try { localStorage.setItem('veel-judge-voices', enabled ? 'on' : 'off'); }
  catch { /* A private browser may disable storage. */ }
  if (!enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Browser voices are optional; varied pitch/rate keeps three judge personas distinct. */
export function speakJudge(judge: JudgeId, line: string) {
  if (!judgeVoicesEnabled() || !('speechSynthesis' in window)) return;
  try {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(line);
    const persona = personas[judge];
    const englishVoices = synthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (englishVoices.length)
      utterance.voice = englishVoices[persona.voiceIndex % englishVoices.length]!;
    utterance.lang = 'en-US';
    utterance.pitch = persona.pitch;
    utterance.rate = persona.rate;
    utterance.volume = 0.8;
    synthesis.speak(utterance);
  } catch {
    // The game continues when the device has no speech synthesizer.
  }
}
