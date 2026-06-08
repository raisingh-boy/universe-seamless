// nodeSounds.ts — lightweight Web Audio API tones for node interactions
// Each domain maps to a distinct musical pitch so users can sonically identify domains.

const DOMAIN_FREQUENCIES: Record<string, number> = {
  body:        220.0,  // A3 — grounded, warm
  science:     293.66, // D4 — clear, analytical
  philosophy:  246.94, // B3 — reflective, deep
  movement:    329.63, // E4 — kinetic, bright
  cognition:   369.99, // F#4 — sharp, precise
  hybrid:      261.63, // C4 — balanced, neutral
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Play a brief tone associated with a node's domain.
 * @param domain - The node's domain string
 * @param volume - Gain level (0–1, default 0.18)
 */
export function playNodeTone(domain: string, volume = 0.18): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const freq = DOMAIN_FREQUENCIES[domain] ?? 261.63;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.36);
}
