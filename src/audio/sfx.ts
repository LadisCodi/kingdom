// Tiny SFX registry (Web Audio). The AudioContext is created lazily on the
// first play() call — always a user gesture, satisfying the autoplay policy.
// Downloads start eagerly; decoding waits for the context. Each sound has a
// volume and an optional pitch jitter so rapid repeats don't sound
// machine-gun identical.

import boatSplashUrl from './sounds/boat_splash.ogg?url';
import buildPlacedUrl from './sounds/build_placed.mp3?url';
import chainFinishedUrl from './sounds/chain_finished.wav?url';
import clickUrl from './sounds/button_click.mp3?url';
import coinSaleUrl from './sounds/coin_sale.ogg?url';
import constructionUrl from './sounds/construction_complete.mp3?url';
import discoveryUrl from './sounds/discovery.wav?url';
import errorUrl from './sounds/error_denied.ogg?url';
import gemUrl from './sounds/gem_spend.wav?url';
import popUrl from './sounds/pop-06.wav?url';
import questUrl from './sounds/quest_claimed.wav?url';
import questCompleteUrl from './sounds/quest_complete.ogg?url';
import researchDoneUrl from './sounds/research_complete.mp3?url';
import researchUrl from './sounds/research_started.mp3?url';
import revealDoneUrl from './sounds/reveal_done.wav?url';
import revealPaidUrl from './sounds/reveal_paid.ogg?url';
import tapEmptyUrl from './sounds/tap_empty.mp3?url';
import unitUrl from './sounds/unit_trained.mp3?url';
import upgradeUrl from './sounds/upgrade_bought.wav?url';
import villagerUrl from './sounds/villager_trained.mp3?url';
import tapTree1 from './sounds/tap_tree_01.ogg?url';
import tapTree2 from './sounds/tap_tree_02.ogg?url';
import tapTree3 from './sounds/tap_tree_03.ogg?url';
import tapBerriesUrl from './sounds/tap_berries.ogg?url';
import tapHouse1 from './sounds/tap_house_01.mp3?url';
import tapHouse2 from './sounds/tap_house_02.mp3?url';
import tapHouse3 from './sounds/tap_house_03.mp3?url';
import tapHouse4 from './sounds/tap_house_04.mp3?url';
import tapAnimalsUrl from './sounds/tap_animals.ogg?url';
import tapAnimalsSquealUrl from './sounds/tap_animals_squeal.ogg?url';
import tapStone1 from './sounds/tap_stone_01.ogg?url';
import tapStone2 from './sounds/tap_stone_02.ogg?url';
import tapStone3 from './sounds/tap_stone_03.ogg?url';

export type SfxName =
  | 'pop' | 'click' | 'discovery' | 'quest' | 'research'
  | 'error' | 'tapEmpty' | 'revealPaid' | 'revealDone' | 'buildPlaced'
  | 'questComplete' | 'villagerTrained' | 'coinSale' | 'researchComplete'
  | 'constructionComplete' | 'upgradeBought' | 'gemSpend' | 'unitTrained'
  | 'boatSplash' | 'chainFinished'
  | 'tapTree' | 'tapBerries' | 'tapHouse' | 'tapAnimals' | 'tapStone'
  | 'tapIron' | 'tapFish';

interface SoundSpec {
  /** One or more takes — a random one plays each time (organic repeats). */
  urls: string[];
  volume: number;
  jitter: number;
  /** Base playback rate (pitch); files can be shared and re-pitched. */
  rate?: number;
}

const one = (url: string) => [url];

const SOUNDS: Record<SfxName, SoundSpec> = {
  pop: { urls: one(popUrl), volume: 0.5, jitter: 0.08 },
  click: { urls: one(clickUrl), volume: 0.35, jitter: 0.03 },
  discovery: { urls: one(discoveryUrl), volume: 0.55, jitter: 0 },
  quest: { urls: one(questUrl), volume: 0.55, jitter: 0 },
  research: { urls: one(researchUrl), volume: 0.5, jitter: 0 },
  error: { urls: one(errorUrl), volume: 0.45, jitter: 0 },
  tapEmpty: { urls: one(tapEmptyUrl), volume: 0.4, jitter: 0.05 },
  revealPaid: { urls: one(revealPaidUrl), volume: 0.4, jitter: 0.06 },
  revealDone: { urls: one(revealDoneUrl), volume: 0.5, jitter: 0 },
  buildPlaced: { urls: one(buildPlacedUrl), volume: 0.5, jitter: 0.04 },
  questComplete: { urls: one(questCompleteUrl), volume: 0.55, jitter: 0 },
  villagerTrained: { urls: one(villagerUrl), volume: 0.5, jitter: 0.04 },
  coinSale: { urls: one(coinSaleUrl), volume: 0.5, jitter: 0.04 },
  researchComplete: { urls: one(researchDoneUrl), volume: 0.55, jitter: 0 },
  constructionComplete: { urls: one(constructionUrl), volume: 0.5, jitter: 0 },
  upgradeBought: { urls: one(upgradeUrl), volume: 0.45, jitter: 0 },
  gemSpend: { urls: one(gemUrl), volume: 0.5, jitter: 0 },
  unitTrained: { urls: one(unitUrl), volume: 0.5, jitter: 0.04 },
  boatSplash: { urls: one(boatSplashUrl), volume: 0.3, jitter: 0.1 },
  chainFinished: { urls: one(chainFinishedUrl), volume: 0.6, jitter: 0 },
  // Per-target tap sounds (multi-take where the library provides them).
  tapTree: { urls: [tapTree1, tapTree2, tapTree3], volume: 0.5, jitter: 0.06 },
  tapBerries: { urls: one(tapBerriesUrl), volume: 0.45, jitter: 0.08 },
  tapHouse: { urls: [tapHouse1, tapHouse2, tapHouse3, tapHouse4], volume: 0.45, jitter: 0.05 },
  // Mostly grunts, the occasional squeal (1 in 3).
  tapAnimals: {
    urls: [tapAnimalsUrl, tapAnimalsUrl, tapAnimalsSquealUrl], volume: 0.5, jitter: 0.06,
  },
  tapStone: { urls: [tapStone1, tapStone2, tapStone3], volume: 0.5, jitter: 0.05 },
  // Iron shares the pick-axe takes, pitched down — heavier metal.
  tapIron: { urls: [tapStone1, tapStone2, tapStone3], volume: 0.5, jitter: 0.05, rate: 0.85 },
  // Fish taps reuse the boat splash, pitched up — a lighter plip.
  tapFish: { urls: one(boatSplashUrl), volume: 0.4, jitter: 0.08, rate: 1.2 },
};

let ctx: AudioContext | null = null;
// Buffers and downloads are keyed by URL, so shared takes (iron reuses the
// stone pick-axe files) download and decode exactly once.
const buffers = new Map<string, AudioBuffer>();
const decoding = new Set<string>();
const downloads = new Map<string, Promise<ArrayBuffer>>();
for (const spec of Object.values(SOUNDS)) {
  for (const url of spec.urls) {
    if (!downloads.has(url)) {
      downloads.set(url, fetch(url).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)));
    }
  }
}

/** Decode every downloaded take as soon as a context exists, so multi-take
 *  sounds aren't silent for their first few (randomly chosen) plays. */
function warmAll(): void {
  for (const [url, download] of downloads) {
    if (buffers.has(url) || decoding.has(url)) continue;
    decoding.add(url);
    void download
      .then((data) => (data.byteLength > 0 ? ctx!.decodeAudioData(data) : null))
      .then((decoded) => {
        if (decoded) buffers.set(url, decoded);
      })
      .catch(() => { /* undecodable — that take stays silent */ });
  }
}

export function playSfx(name: SfxName): void {
  try {
    if (ctx === null) {
      ctx = new AudioContext();
      warmAll();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const spec = SOUNDS[name];
    const url = spec.urls[Math.floor(Math.random() * spec.urls.length)];
    const buffer = buffers.get(url);
    if (!buffer) return; // still decoding — only the very first moments
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value =
      (spec.rate ?? 1) * (1 - spec.jitter + Math.random() * spec.jitter * 2);
    const gain = ctx.createGain();
    gain.gain.value = spec.volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    // No audio available (old browser, blocked) — feedback stays visual.
  }
}

export const playPop = (): void => playSfx('pop');
