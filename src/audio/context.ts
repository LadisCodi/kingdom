// The one AudioContext, and the looping streams that play through it.
//
// A loop (the music, an ambience bed) is an <audio> element — it streams,
// where an SFX buffer is decoded whole — but its loudness is a GainNode, not
// `audio.volume`: on iOS `volume` cannot be set from script and always reads
// 1, so a fade that stepped it never arrived, its timer never stopped, and a
// bed faded "out" was never paused.

let ctx: AudioContext | null = null;

/** The context, made on first ask. Ask from a user gesture: one made before
 *  is suspended until `resumeAudio()` runs inside one. */
export function audioContext(): AudioContext | null {
  if (ctx !== null) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null; // no Web Audio — the game stays silent, never broken
  }
  return ctx;
}

/** The context if a gesture has made it, without making one. */
export const existingAudioContext = (): AudioContext | null => ctx;

/** Call from every user gesture until it sticks. */
export function resumeAudio(): void {
  const c = audioContext();
  if (c !== null && c.state === 'suspended') void c.resume();
}

/** A looping stream with a fade. */
export interface Loop {
  audio: HTMLAudioElement;
  /** Where its loudness is headed. */
  target: number;
  /** Fade to `level` over `ms`; at 0 the stream is paused once it gets there.
   *  A no-op while already headed there. */
  fadeTo(level: number, ms: number): void;
  /** Start it, if it is not playing; a pre-gesture refusal is swallowed. */
  play(): void;
}

export function streamedLoop(url: string, id: string): Loop {
  const audio = new Audio(url);
  audio.loop = true;
  audio.id = id;
  document.body.append(audio); // invisible; in the DOM only for tooling
  let gain: GainNode | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  const route = (): GainNode | null => {
    if (gain !== null) return gain;
    const c = audioContext();
    if (c === null) return null;
    try {
      gain = c.createGain();
      gain.gain.value = 0;
      c.createMediaElementSource(audio).connect(gain).connect(c.destination);
    } catch {
      gain = null;
    }
    return gain;
  };
  const loop: Loop = {
    audio,
    target: 0,
    fadeTo(level, ms) {
      if (level === loop.target) return;
      loop.target = level;
      if (pauseTimer !== null) { clearTimeout(pauseTimer); pauseTimer = null; }
      const g = route();
      if (g === null) {
        audio.volume = level; // no Web Audio: no fade, but the level holds
      } else {
        const t = g.context.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(level, t + ms / 1000);
      }
      if (level === 0) pauseTimer = setTimeout(() => { pauseTimer = null; audio.pause(); }, ms);
    },
    play() {
      route();
      if (audio.paused) void audio.play().catch(() => { /* pre-gesture autoplay block — retried */ });
    },
  };
  return loop;
}
