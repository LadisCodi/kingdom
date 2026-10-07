// Background music: one looping track at a time through an <audio> element
// (it streams — no decoding the whole file into memory like the SFX buffers).
// Browsers block autoplay until a user gesture, so startMusic() is invoked
// from every pointer interaction until playback sticks; calls are idempotent.
// The mute preference is a DEVICE setting, so it lives in its own
// localStorage key, not in the game save.
//
// FOUR TRACKS, ONE ON TOP. The town's harp is the floor; three moments take
// it over while they last, and the highest of them that is on plays — the
// rest fade out under it:
//
//   feast  › a chest being opened (ui/gachaScreen.ts) — Tavern (loop), from
//            the sound collection. It outranks a fight: a won fight's spoils
//            are dealt to it.
//   battle › a fight playing back (ui/battleScreen.ts) — Battlefront Ode
//            (Owl Theory, Ultimate RPG Music Collection), its first 75 s.
//   muster › a party being mustered on the deploy sheet (a lair's, an
//            army's; main.ts) — Preparing for the Assault (same
//            collection): war drums while the player picks who goes.
//   town   › the harp.
//
// All four are levelled to the harp's loudness. The three moments start from
// their top each time they take over; the harp picks up where it left off.

import townUrl from './music/music-harp-peaceful-loop.ogg?url';
import feastUrl from './music/music-tavern-loop.ogg?url';
import battleUrl from './music/music-battle.ogg?url';
import musterUrl from './music/music-muster.ogg?url';
import { resumeAudio, streamedLoop, type Loop } from './context';

const MUTE_KEY = 'kingdom.musicMuted';

type Scene = 'town' | 'muster' | 'battle' | 'feast';

interface Track {
  url: string;
  id: string;
  volume: number;
  /** How long it takes to come in when it takes over (ms). */
  fadeIn: number;
  /** Restarted from its top each time it takes over. */
  fromTop: boolean;
  loop: Loop | null;
}

const TRACKS: Record<Scene, Track> = {
  town: { url: townUrl, id: 'bgm', volume: 0.35, fadeIn: 1500, fromTop: false, loop: null },
  muster: { url: musterUrl, id: 'bgm-muster', volume: 0.34, fadeIn: 900, fromTop: true, loop: null },
  battle: { url: battleUrl, id: 'bgm-battle', volume: 0.36, fadeIn: 300, fromTop: true, loop: null },
  feast: { url: feastUrl, id: 'bgm-feast', volume: 0.38, fadeIn: 600, fromTop: true, loop: null },
};
/** How long the track that loses the floor takes to go (ms). */
const FADE_OUT = 600;

const on: Record<Exclude<Scene, 'town'>, boolean> = { muster: false, battle: false, feast: false };
const scene = (): Scene => (on.feast ? 'feast' : on.battle ? 'battle' : on.muster ? 'muster' : 'town');
/** The track that holds the floor now, or null before anything played. */
let playing: Scene | null = null;
let duckTimer: ReturnType<typeof setTimeout> | null = null;

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
    for (const t of Object.values(TRACKS)) {
      t.loop?.fadeTo(0, 0);
      t.loop?.audio.pause();
    }
    playing = null;
  } else startMusic(); // called from the toggle tap — a gesture, so play() is allowed
}

/** Put the track that should be on top on top: it comes in (from its top,
 *  if it is a moment taking over), every other fades out. `now` skips the
 *  fade-in — a gesture retrying a play the browser blocked. */
function settle(now = false): void {
  if (musicMuted()) return;
  const want = scene();
  for (const [name, t] of Object.entries(TRACKS) as [Scene, Track][]) {
    if (name !== want) {
      t.loop?.fadeTo(0, FADE_OUT);
      continue;
    }
    t.loop ??= streamedLoop(t.url, t.id);
    if (playing !== want && t.fromTop) t.loop.audio.currentTime = 0;
    t.loop.play();
    // A ducked feast stays ducked until its timer lets it back up.
    if (!(name === 'feast' && duckTimer !== null)) t.loop.fadeTo(t.volume, now ? 0 : t.fadeIn);
  }
  playing = want;
}

/** Start (or resume) the music. Safe to call repeatedly — and called from
 *  every pointerdown, which is also what wakes the audio context. */
export function startMusic(): void {
  resumeAudio();
  if (musicMuted()) return;
  // Only a track that has not got going yet is pushed to its level at once;
  // one already fading in keeps its fade.
  settle(playing === null);
}

/** The deploy sheet opens (`true`) or closes (`false`): war drums under the
 *  mustering, the harp back after it. */
export function setMusterMusic(value: boolean): void {
  if (on.muster === value) return;
  on.muster = value;
  settle();
}

/** A fight's playback opens (`true`) or closes (`false`): its tune from the
 *  top, and back to whatever it took the floor from. */
export function setBattleMusic(value: boolean): void {
  if (on.battle === value) return;
  on.battle = value;
  settle();
}

/** The chest reveal opens (`true`) or closes (`false`). */
export function setFeast(value: boolean): void {
  if (on.feast === value) return;
  on.feast = value;
  if (duckTimer !== null) { clearTimeout(duckTimer); duckTimer = null; }
  settle();
}

/** Hold the feast's tune low for `ms`, so a fanfare plays over it. */
export function duckFeast(ms: number): void {
  const feast = TRACKS.feast;
  if (scene() !== 'feast' || feast.loop === null || musicMuted()) return;
  feast.loop.fadeTo(feast.volume * 0.3, 200);
  if (duckTimer !== null) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckTimer = null;
    if (scene() === 'feast' && !musicMuted()) feast.loop?.fadeTo(feast.volume, 1200);
  }, ms);
}
