// Background music: one looping track through an <audio> element (it
// streams — no decoding the whole file into memory like the SFX buffers).
// Browsers block autoplay until a user gesture, so startMusic() is invoked
// from every pointer interaction until playback sticks; calls are idempotent.
// The mute preference is a DEVICE setting, so it lives in its own
// localStorage key, not in the game save.

import trackUrl from './music/music-harp-peaceful-loop.ogg?url';

const MUTE_KEY = 'kingdom.musicMuted';
let audio: HTMLAudioElement | null = null;

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
  if (muted) audio?.pause();
  else startMusic(); // called from the toggle tap — a gesture, so play() is allowed
}

/** Start (or resume) the loop. Safe to call repeatedly. */
export function startMusic(): void {
  if (musicMuted()) return;
  if (!audio) {
    audio = new Audio(trackUrl);
    audio.loop = true;
    audio.volume = 0.35;
    // In the DOM only so tooling can find it — an <audio> tag without
    // `controls` renders nothing.
    audio.id = 'bgm';
    document.body.append(audio);
  }
  if (audio.paused) {
    void audio.play().catch(() => { /* pre-gesture autoplay block — retried on the next tap */ });
  }
}
