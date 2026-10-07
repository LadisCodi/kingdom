// Background music: one looping track through an <audio> element (it
// streams — no decoding the whole file into memory like the SFX buffers).
// Browsers block autoplay until a user gesture, so startMusic() is invoked
// from every pointer interaction until playback sticks; calls are idempotent.
// The mute preference is a DEVICE setting, so it lives in its own
// localStorage key, not in the game save.

import trackUrl from './music/music-harp-peaceful-loop.ogg?url';
import feastUrl from './music/music-tavern-loop.ogg?url';
import battleUrl from './music/music-battle.ogg?url';
import { resumeAudio, streamedLoop, type Loop } from './context';

const MUTE_KEY = 'kingdom.musicMuted';
const VOLUME = 0.35;
let loop: Loop | null = null;

// THE FEAST: while a chest is being opened (ui/gachaScreen.ts) the harp
// steps aside for a livelier tune — Tavern (loop), from the sound
// collection, matched to the harp's loudness. It is still "the music": the
// same mute silences it, and every pointerdown's `startMusic()` keeps
// whichever of the two is meant to be playing.
const FEAST_VOLUME = 0.38;
let feast: Loop | null = null;
let feasting = false;
let duckTimer: ReturnType<typeof setTimeout> | null = null;

// THE BATTLE: while a fight plays back (ui/battleScreen.ts) the harp steps
// aside for The Hour of Battle (Owl Theory, Ultimate RPG Music Collection),
// its first 75 s from the top every fight, levelled to the harp. The feast
// outranks it: a won fight's spoils are dealt to the feast's tune.
const BATTLE_VOLUME = 0.36;
let battle: Loop | null = null;
let battling = false;

/** The harp, at its level — unless the feast or a battle holds the floor. */
function resumeTown(ms: number): void {
  if (battling) {
    battle ??= streamedLoop(battleUrl, 'bgm-battle');
    battle.play();
    battle.fadeTo(BATTLE_VOLUME, ms);
    return;
  }
  loop ??= streamedLoop(trackUrl, 'bgm');
  loop.play();
  loop.fadeTo(VOLUME, ms);
}

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
    feast?.fadeTo(0, 0);
    feast?.audio.pause();
    battle?.fadeTo(0, 0);
    battle?.audio.pause();
  } else startMusic(); // called from the toggle tap — a gesture, so play() is allowed
}

/** Start (or resume) the loop. Safe to call repeatedly — and called from
 *  every pointerdown, which is also what wakes the audio context. */
export function startMusic(): void {
  resumeAudio();
  if (musicMuted()) return;
  if (feasting) {
    feast ??= streamedLoop(feastUrl, 'bgm-feast');
    feast.play();
    if (duckTimer === null) feast.fadeTo(FEAST_VOLUME, 0);
    return;
  }
  resumeTown(0);
}

/** A fight's playback opens (`true`) or closes (`false`): the harp fades
 *  out under the battle's tune — from its top — and back in after it. */
export function setBattleMusic(on: boolean): void {
  if (on === battling) return;
  battling = on;
  if (musicMuted()) return;
  if (on) {
    loop?.fadeTo(0, 400);
    if (feasting) return;
    battle ??= streamedLoop(battleUrl, 'bgm-battle');
    battle.audio.currentTime = 0;
    battle.play();
    battle.fadeTo(BATTLE_VOLUME, 300);
  } else {
    battle?.fadeTo(0, 900);
    if (!feasting) resumeTown(1500);
  }
}

/** The chest reveal opens (`true`) or closes (`false`): the harp fades out
 *  under the feast's tune, and back in after it, from where it was. */
export function setFeast(on: boolean): void {
  if (on === feasting) return;
  feasting = on;
  if (duckTimer !== null) { clearTimeout(duckTimer); duckTimer = null; }
  if (musicMuted()) return;
  if (on) {
    loop?.fadeTo(0, 500);
    battle?.fadeTo(0, 500);
    feast ??= streamedLoop(feastUrl, 'bgm-feast');
    feast.audio.currentTime = 0;
    feast.play();
    feast.fadeTo(FEAST_VOLUME, 600);
  } else {
    feast?.fadeTo(0, 800);
    resumeTown(1500);
  }
}

/** Hold the feast's tune low for `ms`, so a fanfare plays over it. */
export function duckFeast(ms: number): void {
  if (!feasting || feast === null || musicMuted()) return;
  feast.fadeTo(FEAST_VOLUME * 0.3, 200);
  if (duckTimer !== null) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckTimer = null;
    if (feasting && !musicMuted()) feast?.fadeTo(FEAST_VOLUME, 1200);
  }, ms);
}
