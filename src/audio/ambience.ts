// Camera-located ambience: one looping bed under the music, chosen from the
// terrain at the camera's center — waves near water, cold wind over the
// frozen isle, birdsong elsewhere. Beds crossfade (~500ms) when the player
// pans between biomes. The caller passes null while music is muted.

import coastUrl from './sounds/ambiance_coast.ogg?url';
import meadowUrl from './sounds/ambiance_meadow.ogg?url';
import snowUrl from './sounds/ambiance_snow.ogg?url';
import { existingAudioContext, streamedLoop, type Loop } from './context';

export type AmbienceName = 'meadow' | 'coast' | 'snow';

const TRACKS: Record<AmbienceName, string> = {
  meadow: meadowUrl,
  coast: coastUrl,
  snow: snowUrl,
};

const VOLUME = 0.22;
/** How long a crossfade between two beds takes. */
const FADE_MS = 500;

const players = new Map<AmbienceName, Loop>();

function playerFor(name: AmbienceName): Loop {
  let loop = players.get(name);
  if (!loop) {
    loop = streamedLoop(TRACKS[name], `ambience-${name}`);
    players.set(name, loop);
  }
  return loop;
}

/** Called once per second from the tick (and safe to call more often):
 *  fades the named bed in and every other bed out; null silences all
 *  (music muted). Playback attempts are retried until a user gesture has
 *  unlocked audio, then become no-ops. */
// A DEVICE preference of its own. Ambience used to be silenced by the MUSIC
// toggle (main.ts passed null when musicMuted()), which meant there was no
// way to keep the harp and drop the wind, or the reverse.
const MUTE_KEY = 'kingdom.ambienceMuted';

/** Read once, then kept: the tick asks every second. */
let muted: boolean | null = null;

export const ambienceMuted = (): boolean => {
  if (muted !== null) return muted;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
  return muted;
};

export function setAmbienceMuted(on: boolean): void {
  muted = on;
  try {
    if (on) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* storage blocked — the toggle just won't persist */ }
  if (on) syncAmbience(null);
}

export function syncAmbience(name: AmbienceName | null): void {
  if (ambienceMuted()) name = null;
  // Nothing plays before a gesture has made the audio context (context.ts).
  if (existingAudioContext() === null) return;
  try {
    for (const [key, loop] of players) {
      if (key !== name) loop.fadeTo(0, FADE_MS);
    }
    if (name === null) return;
    const target = playerFor(name);
    target.play();
    target.fadeTo(VOLUME, FADE_MS);
  } catch {
    // No audio — the game stays silent, never broken.
  }
}
