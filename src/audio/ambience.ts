// Camera-located ambience: one looping bed under the music, chosen from the
// terrain at the camera's center — waves near water, cold wind over the
// frozen isle, birdsong elsewhere. Beds crossfade (~500ms) when the player
// pans between biomes. The caller passes null while music is muted.

import coastUrl from './sounds/ambiance_coast.ogg?url';
import meadowUrl from './sounds/ambiance_meadow.ogg?url';
import snowUrl from './sounds/ambiance_snow.ogg?url';

export type AmbienceName = 'meadow' | 'coast' | 'snow';

const TRACKS: Record<AmbienceName, string> = {
  meadow: meadowUrl,
  coast: coastUrl,
  snow: snowUrl,
};

const VOLUME = 0.22;

const players = new Map<AmbienceName, HTMLAudioElement>();
const fades = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();

function playerFor(name: AmbienceName): HTMLAudioElement {
  let audio = players.get(name);
  if (!audio) {
    audio = new Audio(TRACKS[name]);
    audio.loop = true;
    audio.volume = 0;
    audio.id = `ambience-${name}`;
    document.body.append(audio); // invisible; in the DOM only for tooling
    players.set(name, audio);
  }
  return audio;
}

function fadeTo(audio: HTMLAudioElement, target: number): void {
  const running = fades.get(audio);
  if (running) clearInterval(running);
  const timer = setInterval(() => {
    const delta = target - audio.volume;
    if (Math.abs(delta) < 0.03) {
      audio.volume = target;
      if (target === 0) audio.pause();
      clearInterval(timer);
      fades.delete(audio);
      return;
    }
    audio.volume += Math.sign(delta) * 0.03;
  }, 50);
  fades.set(audio, timer);
}

/** Called once per second from the tick (and safe to call more often):
 *  fades the named bed in and every other bed out; null silences all
 *  (music muted). Playback attempts are retried until a user gesture has
 *  unlocked audio, then become no-ops. */
// A DEVICE preference of its own. Ambience used to be silenced by the MUSIC
// toggle (main.ts passed null when musicMuted()), which meant there was no
// way to keep the harp and drop the wind, or the reverse.
const MUTE_KEY = 'kingdom.ambienceMuted';

export const ambienceMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export function setAmbienceMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* storage blocked — the toggle just won't persist */ }
  if (muted) syncAmbience(null);
}

export function syncAmbience(name: AmbienceName | null): void {
  if (ambienceMuted()) name = null;
  try {
    for (const [key, audio] of players) {
      if (key !== name && !audio.paused) fadeTo(audio, 0);
    }
    if (name === null) return;
    const target = playerFor(name);
    if (target.paused) {
      void target.play().catch(() => { /* pre-gesture autoplay block — next tick retries */ });
    }
    fadeTo(target, VOLUME);
  } catch {
    // No audio — the game stays silent, never broken.
  }
}
