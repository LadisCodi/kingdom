// Tiny SFX registry (Web Audio). The AudioContext is created lazily on the
// first play() call — always a user gesture, satisfying the autoplay policy.
// Downloads start eagerly; decoding waits for the context. Each sound has a
// volume and an optional pitch jitter so rapid repeats don't sound
// machine-gun identical.

import clickUrl from './sounds/button_click.mp3?url';
import discoveryUrl from './sounds/discovery.wav?url';
import popUrl from './sounds/pop-06.wav?url';
import questUrl from './sounds/quest_claimed.wav?url';
import researchUrl from './sounds/research_started.mp3?url';

export type SfxName = 'pop' | 'click' | 'discovery' | 'quest' | 'research';

const SOUNDS: Record<SfxName, { url: string; volume: number; jitter: number }> = {
  pop: { url: popUrl, volume: 0.5, jitter: 0.08 },
  click: { url: clickUrl, volume: 0.35, jitter: 0.03 },
  discovery: { url: discoveryUrl, volume: 0.55, jitter: 0 },
  quest: { url: questUrl, volume: 0.55, jitter: 0 },
  research: { url: researchUrl, volume: 0.5, jitter: 0 },
};

let ctx: AudioContext | null = null;
const buffers = new Map<SfxName, AudioBuffer>();
const decoding = new Set<SfxName>();

// Start every download immediately; decoding waits for the AudioContext.
const downloads = new Map<SfxName, Promise<ArrayBuffer>>(
  (Object.entries(SOUNDS) as Array<[SfxName, { url: string }]>).map(([name, s]) => [
    name,
    fetch(s.url).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)),
  ]),
);

export function playSfx(name: SfxName): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const buffer = buffers.get(name);
    if (!buffer) {
      if (!decoding.has(name)) {
        decoding.add(name);
        void downloads.get(name)!
          .then((data) => (data.byteLength > 0 ? ctx!.decodeAudioData(data) : null))
          .then((decoded) => {
            if (decoded) buffers.set(name, decoded);
          })
          .catch(() => { /* undecodable — stay silent */ });
      }
      return; // first play may be silent while the buffer decodes
    }
    const spec = SOUNDS[name];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 - spec.jitter + Math.random() * spec.jitter * 2;
    const gain = ctx.createGain();
    gain.gain.value = spec.volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    // No audio available (old browser, blocked) — feedback stays visual.
  }
}

export const playPop = (): void => playSfx('pop');
