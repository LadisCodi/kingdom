// Background music: one looping track through an <audio> element (it
// streams — no decoding the whole file into memory like the SFX buffers).
// Browsers block autoplay until a user gesture, so startMusic() is invoked
// from every pointer interaction until playback sticks; calls are idempotent.
// The mute preference is a DEVICE setting, so it lives in its own
// localStorage key, not in the game save.

import trackUrl from './music/music-harp-peaceful-loop.ogg?url';
import { resumeAudio, streamedLoop, type Loop } from './context';

const MUTE_KEY = 'kingdom.musicMuted';
const VOLUME = 0.35;
let loop: Loop | null = null;

export const musicMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export function setMusicMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* storage blocked — the toggle just won't persist */ }
  if (muted) {
    loop?.fadeTo(0, 0);
    loop?.audio.pause();
  } else startMusic(); // called from the toggle tap — a gesture, so play() is allowed
}

/** Start (or resume) the loop. Safe to call repeatedly — and called from
 *  every pointerdown, which is also what wakes the audio context. */
export function startMusic(): void {
  resumeAudio();
  if (musicMuted()) return;
  loop ??= streamedLoop(trackUrl, 'bgm');
  loop.play();
  loop.fadeTo(VOLUME, 0);
}
