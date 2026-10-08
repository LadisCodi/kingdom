// Tiny SFX registry (Web Audio). The AudioContext is created lazily on the
// first play() call — always a user gesture, satisfying the autoplay policy.
// Downloads start eagerly; decoding waits for the context. Each sound has a
// volume and an optional pitch jitter so rapid repeats don't sound
// machine-gun identical.

import armyHomeUrl from './sounds/army_home.ogg?url';
import armyMarchUrl from './sounds/army_march.ogg?url';
import armyRecallUrl from './sounds/army_recall.ogg?url';
import barFillUrl from './sounds/bar_fill.ogg?url';
import boatSplashUrl from './sounds/boat_splash.ogg?url';
import buildPlacedUrl from './sounds/build_placed.mp3?url';
import cardImpactUrl from './sounds/card_impact.ogg?url';
import cardRevealCommon1 from './sounds/card_reveal_common_01.ogg?url';
import cardRevealCommon2 from './sounds/card_reveal_common_02.ogg?url';
import cardRevealCommon3 from './sounds/card_reveal_common_03.ogg?url';
import cardRevealCommon4 from './sounds/card_reveal_common_04.ogg?url';
import cardRevealLegendUrl from './sounds/card_reveal_legend.ogg?url';
import cardRevealRareUrl from './sounds/card_reveal_rare.ogg?url';
import chainFinishedUrl from './sounds/chain_finished.wav?url';
import chestApplauseUrl from './sounds/chest_applause.ogg?url';
import chestDrawUrl from './sounds/chest_draw.ogg?url';
import chestFanfareUrl from './sounds/chest_fanfare.ogg?url';
import chestFanfareLegendUrl from './sounds/chest_fanfare_legend.ogg?url';
import chestPopUrl from './sounds/chest_pop.ogg?url';
import chestRiserShortUrl from './sounds/chest_riser_short.ogg?url';
import chestFlip1 from './sounds/chest_flip_01.ogg?url';
import chestFlip2 from './sounds/chest_flip_02.ogg?url';
import chestHeroUrl from './sounds/chest_hero.ogg?url';
import chestLandUrl from './sounds/chest_land.ogg?url';
import chestLegendUrl from './sounds/chest_legend.ogg?url';
import chestOpenUrl from './sounds/chest_open.ogg?url';
import chestRiserUrl from './sounds/chest_riser.ogg?url';
import chestSettleUrl from './sounds/chest_settle.ogg?url';
import chestSparkleUrl from './sounds/chest_sparkle.ogg?url';
import chestSummaryUrl from './sounds/chest_summary.ogg?url';
import chestUnlockUrl from './sounds/chest_unlock.ogg?url';
import chestWhooshUrl from './sounds/chest_whoosh.ogg?url';
import clickUrl from './sounds/button_click.mp3?url';
import coinSaleUrl from './sounds/coin_sale.ogg?url';
import constructionUrl from './sounds/construction_complete.mp3?url';
import discoveryUrl from './sounds/discovery.wav?url';
import errorUrl from './sounds/error_denied.ogg?url';
import explorerDepartUrl from './sounds/explorer_depart.ogg?url';
import explorerHomeUrl from './sounds/explorer_home.ogg?url';
import gemUrl from './sounds/gem_spend.wav?url';
import ghostLiftUrl from './sounds/ghost_lift.ogg?url';
import ghostPlantUrl from './sounds/ghost_plant.ogg?url';
import ghostStep1 from './sounds/ghost_step_01.ogg?url';
import ghostStep2 from './sounds/ghost_step_02.ogg?url';
import ghostStep3 from './sounds/ghost_step_03.ogg?url';
import popUrl from './sounds/pop-06.wav?url';
import tooltipUrl from './sounds/tooltip_pop.wav?url';
import questUrl from './sounds/quest_claimed.mp3?url';
import questCompleteUrl from './sounds/quest_complete.mp3?url';
import researchDoneUrl from './sounds/research_complete.mp3?url';
import researchUrl from './sounds/research_started.mp3?url';
import revealDoneUrl from './sounds/reveal_done.ogg?url';
import revealPaidUrl from './sounds/reveal_paid.ogg?url';
import raidAlarmUrl from './sounds/raid_alarm.ogg?url';
import relicWakeUrl from './sounds/relic_wake.ogg?url';
import rewardBurstUrl from './sounds/reward_burst.wav?url';
import rewardCoin1 from './sounds/reward_coin_01.mp3?url';
import rewardCoin2 from './sounds/reward_coin_02.mp3?url';
import rewardCoin3 from './sounds/reward_coin_03.mp3?url';
import rewardCoin4 from './sounds/reward_coin_04.mp3?url';
import rewardPop1 from './sounds/reward_pop_01.wav?url';
import rewardPop2 from './sounds/reward_pop_02.wav?url';
import rewardPop3 from './sounds/reward_pop_03.wav?url';
import scrollCloseUrl from './sounds/scroll_close.ogg?url';
import scrollOpenUrl from './sounds/scroll_open.ogg?url';
import speedup1 from './sounds/speedup_01.ogg?url';
import speedup2 from './sounds/speedup_02.ogg?url';
import speedup3 from './sounds/speedup_03.ogg?url';
import speedup4 from './sounds/speedup_04.ogg?url';
import spellCastUrl from './sounds/spell_cast.ogg?url';
import tapEmptyUrl from './sounds/tap_empty.mp3?url';
import tributeUrl from './sounds/tribute.ogg?url';
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
import textTick1 from './sounds/text_tick_01.ogg?url';
import textTick2 from './sounds/text_tick_02.ogg?url';
import unlockUrl from './sounds/unlock_splash.ogg?url';

import { audioContext } from './context';

export type SfxName =
  | 'pop' | 'tooltip' | 'click' | 'discovery' | 'quest' | 'research'
  | 'error' | 'tapEmpty' | 'revealPaid' | 'revealDone' | 'buildPlaced'
  | 'questComplete' | 'villagerTrained' | 'coinSale' | 'researchComplete'
  | 'constructionComplete' | 'upgradeBought' | 'gemSpend' | 'unitTrained'
  | 'boatSplash' | 'chainFinished'
  // The quest scroll unrolling and rolling back up (questPill.ts).
  | 'scrollOpen' | 'scrollClose'
  // A reward flying into the header (rewardFly.ts): the burst it leaves the
  // claim with (Special Powerup 11), and one tick per fragment landing — a coin for money, a pop
  // for goods.
  | 'rewardBurst' | 'rewardCoin' | 'rewardPop'
  | 'tapTree' | 'tapBerries' | 'tapHouse' | 'tapAnimals' | 'tapStone'
  | 'tapIron' | 'tapFish'
  // A line of dialogue typing itself (ui/stage/stage.ts): Click Tap Knock
  // Subtle, light and dark — a soft knock on the box's wood.
  | 'textTick'
  // A door or a book opening, full-screen (ui/unlockSplash.ts).
  | 'unlock'
  // An offer splash that opens by itself, at the start of a session
  // (ui/offerSplash.ts) — never one the player opened.
  | 'offerSplash'
  // The chest a random reward is opened from (ui/gachaScreen.ts), in the
  // order they sound: it lands, the key turns, the lid flies, a card is
  // drawn, flipped and flown to its place; a new hero's riser, its fanfare
  // (a Legendary's own), and the summary's chime.
  | 'chestLand' | 'chestUnlock' | 'chestOpen' | 'cardDraw' | 'cardFlip'
  | 'cardWhoosh' | 'cardSettle' | 'cardSparkle' | 'heroRiser' | 'heroNew'
  | 'heroLegend' | 'chestSummary'
  // A WHOLE hero out of the chest is the rarest thing in it, and is
  // celebrated: a short drum roll before the flip, the confetti cannons'
  // pop, a full fanfare (a Legendary's own) and, for a Legendary, applause.
  | 'heroRiserShort' | 'heroPop' | 'heroFanfare' | 'heroFanfareLegend' | 'heroApplause'
  // Any card turning face up lands with a drum hit and its rarity's
  // stinger; a fragments bar counts up as it fills.
  | 'cardImpact' | 'cardRevealCommon' | 'cardRevealRare' | 'cardRevealLegend' | 'barFill'
  // The world board: an explorer sets out and comes home; an army marches,
  // is called back, comes home; a camp is paid off.
  | 'explorerDepart' | 'explorerHome' | 'armyMarch' | 'armyRecall' | 'armyHome' | 'tribute'
  // A lair's garrison came down on the city — a far horn, not an alarm.
  | 'raidAlarm'
  // A speed-up taking time off a wait; a spell cast; a relic woken.
  | 'speedup' | 'spellCast' | 'relicWake'
  // The placement ghost (game.ts): picked up, carried a cell, set down to
  // build.
  | 'ghostLift' | 'ghostStep' | 'ghostPlant'
  | BattleSfx;

/**
 * THE BATTLE PLAYBACK's sounds (ui/battleScreen.ts). Each is a file — or a
 * few takes of one, `battle_<name>_NN.ogg` — in `sounds/`, cut from the
 * sound collection: silence trimmed, a fade at the tail, mono, levelled
 * (a hit to the same mean level, a stinger to -16 LUFS), so the volumes
 * below are the mix. The frequent ones sit low: a fight lands a dozen blows
 * a second.
 */
export type BattleSfx =
  | 'battleStart' | 'swordHit' | 'lanceHit' | 'cavalryCharge' | 'cavalryHit'
  | 'arrowLoose' | 'arrowHit' | 'boltCast' | 'squadDown' | 'skullStamp' | 'heroDown'
  | 'skillCharge' | 'ribbon' | 'volley' | 'cleave' | 'crush' | 'ambush' | 'sharpshot'
  | 'heal' | 'shieldUp' | 'shieldSoak' | 'shieldBreak' | 'daze'
  | 'warCry' | 'bulwark' | 'vigour' | 'finalBlow' | 'victory' | 'defeat';

const BATTLE_MIX: Record<BattleSfx, { volume: number; jitter: number }> = {
  // Battle Viking Horn Call, under the armies marching on.
  battleStart: { volume: 0.5, jitter: 0 },
  // Sword Hits Type 2 · Spear Pierce Through Flesh (Heavy Edgy) · Body Hit
  // Punch Kick Fight: a blow by Warrior, Lancer, Cavalry.
  swordHit: { volume: 0.26, jitter: 0.08 },
  lanceHit: { volume: 0.26, jitter: 0.08 },
  cavalryHit: { volume: 0.3, jitter: 0.08 },
  // Horse Snort, as a cavalry line sets off.
  cavalryCharge: { volume: 0.25, jitter: 0.06 },
  // Bow Crossbow Arrow Shoot Type 1 and Wood Hit; a hero's bolt is Light
  // Wand Whoosh.
  arrowLoose: { volume: 0.16, jitter: 0.08 },
  arrowHit: { volume: 0.2, jitter: 0.08 },
  boltCast: { volume: 0.28, jitter: 0.06 },
  // A ring cracking (Swing Hit Wood Shield Break), the skull stamped on it
  // (Pixel Thud) and, for a hero, a body falling (Body Fall).
  squadDown: { volume: 0.42, jitter: 0.06 },
  skullStamp: { volume: 0.38, jitter: 0.04 },
  heroDown: { volume: 0.45, jitter: 0.04 },
  // A skill charging (Pixel Skill Ready) and its ribbon unrolling (Cloth
  // Movement Fast).
  skillCharge: { volume: 0.35, jitter: 0.05 },
  ribbon: { volume: 0.3, jitter: 0.06 },
  // Each skill's own: Mass Loose · Big Sword Hit · Rock Impact Heavy Slam ·
  // Pixel Phase Swish · Rapid Shot Critical · Pixel Simple Heal · Pixel
  // Bubble Deflect · Metallic Bubble · Glass Small · Charm.
  volley: { volume: 0.42, jitter: 0.03 },
  cleave: { volume: 0.45, jitter: 0.04 },
  crush: { volume: 0.55, jitter: 0.03 },
  ambush: { volume: 0.4, jitter: 0.05 },
  sharpshot: { volume: 0.42, jitter: 0.03 },
  heal: { volume: 0.36, jitter: 0.04 },
  shieldUp: { volume: 0.38, jitter: 0.03 },
  shieldSoak: { volume: 0.26, jitter: 0.08 },
  shieldBreak: { volume: 0.42, jitter: 0.05 },
  daze: { volume: 0.4, jitter: 0.04 },
  // The rallies: Bravery · Shield Buff V1 · Heavenly Positive Buff.
  warCry: { volume: 0.42, jitter: 0 },
  bulwark: { volume: 0.42, jitter: 0 },
  vigour: { volume: 0.42, jitter: 0 },
  // The last blow in slow motion (Alien Strike, a cinematic hit), and the
  // plaque: Victory 1 · Defeat 1 Short (RPG Fanfares).
  finalBlow: { volume: 0.5, jitter: 0 },
  victory: { volume: 0.55, jitter: 0 },
  defeat: { volume: 0.55, jitter: 0 },
};

const BATTLE_FILES = import.meta.glob('./sounds/battle_*.ogg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const battleTakes = (name: BattleSfx): string[] => Object.entries(BATTLE_FILES)
  .filter(([path]) => new RegExp(`/battle_${name}(_\\d+)?\\.ogg$`).test(path))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

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
  ...Object.fromEntries((Object.keys(BATTLE_MIX) as BattleSfx[]).map((name) => [
    name, { urls: battleTakes(name), ...BATTLE_MIX[name] },
  ])) as Record<BattleSfx, SoundSpec>,
  pop: { urls: one(popUrl), volume: 0.5, jitter: 0.08 },
  // A tooltip opening (kit/tooltip.ts): Pop 02, short and soft, apart from
  // the generic pop so the two never read as the same event.
  tooltip: { urls: one(tooltipUrl), volume: 0.45, jitter: 0.06 },
  click: { urls: one(clickUrl), volume: 0.35, jitter: 0.03 },
  discovery: { urls: one(discoveryUrl), volume: 0.55, jitter: 0 },
  // A quest's goal met (Fantasy Event 09) and its reward claimed (Fantasy
  // Event 17): two different stingers, so the two moments never sound alike.
  // Louder than the rest: the stinger is mastered quiet (-14 dB peak) and
  // starts on the same instant as the scroll-close rustle.
  quest: { urls: one(questUrl), volume: 0.9, jitter: 0 },
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
  scrollOpen: { urls: one(scrollOpenUrl), volume: 0.4, jitter: 0.04 },
  scrollClose: { urls: one(scrollCloseUrl), volume: 0.4, jitter: 0.04 },
  rewardBurst: { urls: one(rewardBurstUrl), volume: 0.4, jitter: 0.03 },
  rewardCoin: { urls: [rewardCoin1, rewardCoin2, rewardCoin3, rewardCoin4], volume: 0.3, jitter: 0.04 },
  rewardPop: { urls: [rewardPop1, rewardPop2, rewardPop3], volume: 0.35, jitter: 0.04 },
  // Fish taps reuse the boat splash, pitched up — a lighter plip.
  tapFish: { urls: one(boatSplashUrl), volume: 0.4, jitter: 0.08, rate: 1.2 },
  textTick: { urls: [textTick1, textTick2], volume: 0.3, jitter: 0.1 },
  // The unlock splash: Fairy Magical 05, a five-second stinger. Mastered
  // about 10 dB hotter than `discovery`, so it plays well under it.
  unlock: { urls: one(unlockUrl), volume: 0.3, jitter: 0 },
  // The offer splash: the chest's Collect Item Sparkle Pop, a step lower and
  // softer — a glint, not a fanfare, for something that greets every session.
  offerSplash: { urls: one(chestSparkleUrl), volume: 0.25, jitter: 0, rate: 0.85 },
  // The chest. Every file is loudness-normalised to -16 LUFS, so these
  // volumes are the mix: the foley under the stingers, the fanfares on top.
  // Impact Deep Thud Bounce · Door Lock Turn · Chest Open · Card Draw ·
  // Card Flip (two takes) · a whoosh cut to 0.7 s · Card Set Down · Collect
  // Item Sparkle Pop · Epic Risers cut to 2.2 s · Big Item Get 1 and 2 ·
  // Harpsichord Chime Positive.
  chestLand: { urls: one(chestLandUrl), volume: 0.55, jitter: 0.03 },
  chestUnlock: { urls: one(chestUnlockUrl), volume: 0.5, jitter: 0.02 },
  chestOpen: { urls: one(chestOpenUrl), volume: 0.6, jitter: 0.02 },
  cardDraw: { urls: one(chestDrawUrl), volume: 0.4, jitter: 0.06 },
  cardFlip: { urls: [chestFlip1, chestFlip2], volume: 0.55, jitter: 0.05 },
  cardWhoosh: { urls: one(chestWhooshUrl), volume: 0.22, jitter: 0.08 },
  cardSettle: { urls: one(chestSettleUrl), volume: 0.45, jitter: 0.06 },
  cardSparkle: { urls: one(chestSparkleUrl), volume: 0.35, jitter: 0.04 },
  heroRiser: { urls: one(chestRiserUrl), volume: 0.45, jitter: 0 },
  heroNew: { urls: one(chestHeroUrl), volume: 0.6, jitter: 0 },
  heroLegend: { urls: one(chestLegendUrl), volume: 0.65, jitter: 0 },
  chestSummary: { urls: one(chestSummaryUrl), volume: 0.5, jitter: 0 },
  // Epic Risers 3 cut whole · Rocket Explode Sparkle cut to 2.5 s ·
  // Exciting Fanfare 01 and 05 · Applause cut to 3.5 s.
  heroRiserShort: { urls: one(chestRiserShortUrl), volume: 0.45, jitter: 0 },
  heroPop: { urls: one(chestPopUrl), volume: 0.45, jitter: 0.03 },
  heroFanfare: { urls: one(chestFanfareUrl), volume: 0.6, jitter: 0 },
  heroFanfareLegend: { urls: one(chestFanfareLegendUrl), volume: 0.65, jitter: 0 },
  heroApplause: { urls: one(chestApplauseUrl), volume: 0.3, jitter: 0 },
  // Cut from the collection like the battle's: a hit levelled by mean, a
  // stinger to -16 LUFS. Drum Hit 01 · RPG Fanfares Pick Up Coin (four
  // takes), Item Get 1 Short · Fairy Magical 01 · Count Prize Long.
  cardImpact: { urls: one(cardImpactUrl), volume: 0.4, jitter: 0.04 },
  cardRevealCommon: {
    urls: [cardRevealCommon1, cardRevealCommon2, cardRevealCommon3, cardRevealCommon4], volume: 0.4, jitter: 0.02,
  },
  cardRevealRare: { urls: one(cardRevealRareUrl), volume: 0.5, jitter: 0 },
  cardRevealLegend: { urls: one(cardRevealLegendUrl), volume: 0.6, jitter: 0 },
  barFill: { urls: one(barFillUrl), volume: 0.3, jitter: 0 },
  // Harpsichord Level Start and Level Complete · Battle Intro 1 Short Drums
  // Only · Horn 01 · RPG Fanfares Quest Complete Short · Coins in Sack
  // Dropped on Wood.
  explorerDepart: { urls: one(explorerDepartUrl), volume: 0.4, jitter: 0 },
  explorerHome: { urls: one(explorerHomeUrl), volume: 0.4, jitter: 0 },
  armyMarch: { urls: one(armyMarchUrl), volume: 0.45, jitter: 0 },
  armyRecall: { urls: one(armyRecallUrl), volume: 0.35, jitter: 0.03 },
  armyHome: { urls: one(armyHomeUrl), volume: 0.4, jitter: 0 },
  tribute: { urls: one(tributeUrl), volume: 0.5, jitter: 0.05 },
  // Battle Viking Horn Call Far.
  raidAlarm: { urls: one(raidAlarmUrl), volume: 0.4, jitter: 0 },
  // Clock Tick (four takes) · Casting Magic · Arcane Symbol Activate.
  speedup: { urls: [speedup1, speedup2, speedup3, speedup4], volume: 0.45, jitter: 0.04 },
  spellCast: { urls: one(spellCastUrl), volume: 0.45, jitter: 0.02 },
  relicWake: { urls: one(relicWakeUrl), volume: 0.45, jitter: 0 },
  // The ghost. Peak-normalised to -3 dB, so these volumes are the mix: Pop 09
  // as it is picked up; Wood Block Sticks Hit Clap 01–03, cut to 0.16 s, one
  // per cell it is carried — quiet, it can fire ten times a second; Impact
  // Deep Thud Bounce 03 under Hitting Nail with Hammer 01 as it is planted.
  ghostLift: { urls: one(ghostLiftUrl), volume: 0.45, jitter: 0.05 },
  ghostStep: { urls: [ghostStep1, ghostStep2, ghostStep3], volume: 0.18, jitter: 0.08 },
  ghostPlant: { urls: one(ghostPlantUrl), volume: 0.6, jitter: 0.03 },
};

let ctx: AudioContext | null = null;
// Buffers and downloads are keyed by URL, so shared takes (iron reuses the
// stone pick-axe files) download and decode exactly once.
const buffers = new Map<string, AudioBuffer>();
const decoding = new Set<string>();
const downloads = new Map<string, Promise<ArrayBuffer>>();
const fetchTakes = (spec: SoundSpec): void => {
  for (const url of spec.urls) {
    if (!downloads.has(url)) {
      downloads.set(url, fetch(url).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)));
    }
  }
};
// Everything but the battle's comes down at boot. The battle's — 47 takes, a
// player who never fights this session should not pay for them — come down
// when a fight is in sight (`warmBattleSfx`).
for (const [name, spec] of Object.entries(SOUNDS)) {
  if (!(name in BATTLE_MIX)) fetchTakes(spec);
}

/** Fetch (and, once there is a context, decode) the battle's sounds. Called
 *  when a deploy sheet opens, so they are ready by the first blow — and by
 *  the playback itself, for any fight that comes without one. Idempotent. */
export function warmBattleSfx(): void {
  for (const name of Object.keys(BATTLE_MIX) as BattleSfx[]) fetchTakes(SOUNDS[name]);
  if (ctx !== null) warmAll();
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

// Like music's, this is a DEVICE preference, so it lives in its own
// localStorage key rather than in the game save.
const MUTE_KEY = 'kingdom.sfxMuted';

export const sfxMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export function setSfxMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* storage blocked — the toggle just won't persist */ }
}

/** How a single play deviates from the sound's authored spec. */
export interface PlayOptions {
  /** Multiplier on the authored volume. Half for a worker's strike, so the
   *  player's own tap stays the louder gesture. */
  gain?: number;
  /** EXTRA pitch jitter on top of the sound's own, as a fraction of rate.
   *  Two identical takes landing together turn into a drone without it. */
  jitter?: number;
  /** Voice limiting: at most `limit` sounds of this group may be in flight,
   *  and the rest are dropped in silence. Thirty workers striking is two a
   *  second before upgrades, and a machine gun after them. */
  group?: string;
  limit?: number;
  /** Multiplier on the playback rate — a rising run of ticks climbs in pitch. */
  rate?: number;
}

/** Sounds currently in flight, per voice-limit group. */
const voices = new Map<string, number>();

export function playSfx(name: SfxName, opts: PlayOptions = {}): void {
  playSpec(SOUNDS[name], opts);
}

// ------------------------------------------------------------------ voices
// A speaker's little vocal emote as they start to talk (ui/stage/stage.ts):
// `sounds/voice/<speaker>.ogg`, or `<speaker>_<expression>.ogg` where the
// mood has its own — the same rule as the portraits. A file on disk is the
// whole registration: a speaker without one stays silent.
const VOICE_FILES = import.meta.glob('./sounds/voice/*.ogg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const VOICES = new Map<string, SoundSpec>(Object.entries(VOICE_FILES).map(([path, url]) => [
  path.replace(/^.*\/(.*)\.ogg$/, '$1'),
  { urls: one(url), volume: 0.5, jitter: 0.03 },
]));
for (const spec of VOICES.values()) {
  for (const url of spec.urls) {
    if (!downloads.has(url)) {
      downloads.set(url, fetch(url).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)));
    }
  }
}

/** Play `speaker`'s emote in `expression`'s mood, if they have one. */
export function playVoice(speaker: string, expression: string): void {
  const spec = (expression !== '' ? VOICES.get(`${speaker}_${expression}`) : undefined)
    ?? VOICES.get(speaker);
  if (spec !== undefined) playSpec(spec, { group: 'voice', limit: 1 });
}

function playSpec(spec: SoundSpec, opts: PlayOptions): void {
  if (sfxMuted()) return;
  const group = opts.group;
  if (group !== undefined && (voices.get(group) ?? 0) >= (opts.limit ?? 3)) return;
  try {
    if (ctx === null) {
      ctx = audioContext();
      if (ctx === null) return;
      warmAll();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const url = spec.urls[Math.floor(Math.random() * spec.urls.length)];
    const buffer = buffers.get(url);
    if (!buffer) return; // still decoding — only the very first moments
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const jitter = spec.jitter + (opts.jitter ?? 0);
    source.playbackRate.value =
      (spec.rate ?? 1) * (opts.rate ?? 1) * (1 - jitter + Math.random() * jitter * 2);
    const gain = ctx.createGain();
    gain.gain.value = spec.volume * (opts.gain ?? 1);
    source.connect(gain).connect(ctx.destination);
    if (group !== undefined) {
      voices.set(group, (voices.get(group) ?? 0) + 1);
      source.onended = () => voices.set(group, Math.max(0, (voices.get(group) ?? 1) - 1));
    }
    source.start();
  } catch {
    // No audio available (old browser, blocked) — feedback stays visual.
  }
}

export const playPop = (): void => playSfx('pop');
