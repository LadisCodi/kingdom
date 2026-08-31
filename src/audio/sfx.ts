// Tiny SFX player (Web Audio). The AudioContext is created lazily on the
// first play() call — always a user gesture (a tap), which satisfies the
// browser autoplay policy. The buffer is fetched eagerly but decoded on
// first use; every playback gets a small pitch jitter so rapid taps don't
// sound machine-gun identical.

import popUrl from './sounds/pop-06.wav?url';

let ctx: AudioContext | null = null;
let popBuffer: AudioBuffer | null = null;
let decoding = false;

// Start the download immediately; decoding waits for the AudioContext.
const popData: Promise<ArrayBuffer> = fetch(popUrl)
  .then((r) => r.arrayBuffer())
  .catch(() => new ArrayBuffer(0));

export function playPop(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (popBuffer === null) {
      if (!decoding) {
        decoding = true;
        void popData
          .then((data) => (data.byteLength > 0 ? ctx!.decodeAudioData(data) : null))
          .then((buffer) => {
            popBuffer = buffer;
          })
          .catch(() => { /* undecodable — stay silent */ });
      }
      return; // the very first tap may be silent while the buffer decodes
    }
    const source = ctx.createBufferSource();
    source.buffer = popBuffer;
    source.playbackRate.value = 0.92 + Math.random() * 0.16; // ±8% pitch jitter
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    // No audio available (old browser, blocked) — feedback stays visual.
  }
}
