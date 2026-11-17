let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

/**
 * Plays a lightweight synthesized POS scanner feedback tone without external audio assets.
 */
export function playScanFeedbackTone(type: 'success' | 'error'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type === 'success' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(type === 'success' ? 1850 : 420, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(type === 'success' ? 0.14 : 0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'success' ? 0.085 : 0.16));

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + (type === 'success' ? 0.09 : 0.17));
  } catch {
    // Ignore audio context errors when autoplay policy restricts sound
  }
}
