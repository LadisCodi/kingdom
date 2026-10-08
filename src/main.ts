// Bootstrap: load save → build state → start the ONE per-second tick → wire
// renderer + UI. Load order per Docs/10: the tick never runs against restored
// timestamps before rates are rebuilt (deserialize recalcs before returning).

import { portalEvent, portalOpen, portalOpensAt } from './worldServer/core';
import { renderHeroPicker } from './ui/heroPicker';
import { renderRelicMoveConfirm, renderRelicPicker } from './ui/relicPicker';
import './style.css'; // legacy chrome — shrinks as screens migrate
import './ui/styles/index.css'; // the kit: imported second, so its rules win ties
import { syncAmbience, type AmbienceName } from './audio/ambience';
import { setMusterMusic, startMusic } from './audio/music';
import { warmBattleSfx } from './audio/sfx';
import { Game, type OverlayName } from './game';
import { CAMERA_GLIDE_MS, Camera } from './render/camera';
import { wireInput } from './render/input';
import { drawMap } from './render/mapRenderer';
import { shouldDraw } from './render/framePacer';
import { SaveManager } from './persist/saveManager';
import { ARTIFACT_ORDER, BANNERS, DISTRICTS, GAME_VERSION, ITEM_ORDER, SAVE_VERSION, TECH_ORDER } from './sim/data/definitions';
import { grantArtifactLevel } from './sim/artifacts';
import { dropFragments, giveRelic, openRelicDoor } from './sim/relics';
import { grantItem } from './sim/bag';
import { LAIR_ORDER } from './sim/data/definitions';
import { addMana, manaCap } from './sim/mana';
import { grantBuilder } from './sim/commands';
import { addGood } from './sim/goods';
import { GOOD_ORDER } from './sim/data/definitions';
import { buildMapData, TOWNHALL_ORIGIN } from './sim/grid';
import { coordKey, districtById, districtSize, type Coord } from './sim/state';
import { newGame } from './sim/newGame';
import { deserialize, isPrototypeStale, type CatchUpReport } from './sim/save';
import { mountHeader } from './ui/header';
import { mountNavbar } from './ui/navbar';
import { mountRewardFly } from './ui/rewardFly';
import { mountAdScreen } from './ui/adScreen';
import { mountBattleScreen } from './ui/battleScreen';
import { mountGachaScreen } from './ui/gachaScreen';
import { renderManaSheet } from './ui/manaSheet';
import { renderKnowledgeSheet } from './ui/knowledgeSheet';
import { renderBuilderSheet } from './ui/builderSheet';
import { renderSurveySheet } from './ui/surveySheet';
import { mountSurveyPill } from './ui/surveyPill';
import { buildMenuSignature, renderBuildMenu } from './ui/buildMenu';
import { renderPlacementPanel } from './ui/placementPanel';
import { renderCastPanel } from './ui/castPanel';
import { districtCardScreen } from './ui/districtCard';
import { lairCardScreen, landmarkCardScreen, renderAbandonedCard } from './ui/siteCard';
import { landmarkDefAt, standingAbandonedAt, standingLairAt } from './sim/sites';
import { renderResearchMenu, researchSignature } from './ui/researchMenu';
import { renderSettingsMenu, settingsSignature } from './ui/settingsMenu';
import { renderPurseSheet } from './ui/purseSheet';
import { renderRelicSheet } from './ui/relicSheet';
import { bagSignature, renderBagSheet } from './ui/bagSheet';
import { renderSpeedupSheet } from './ui/speedupSheet';
import { renderShortfallSheet } from './ui/shortfallSheet';
import { renderHeroesSheet } from './ui/heroesSheet';
import { renderLairSheet } from './ui/lairSheet';
import { renderDispatchSheet } from './ui/world/dispatchSheet';
import { renderWorldBuilding, renderWorldSlot } from './ui/world/hexCard';
import { renderPortalScreen } from './ui/world/portalScreen';
import { renderArmySheet } from './ui/world/armySheet';
import { renderDelveScreen } from './ui/world/delveScreen';
import { mountExplorerChip } from './ui/world/explorerChip';
import { mountRankingWidget } from './ui/world/rankingWidget';
import { renderRankingSheet } from './ui/world/rankingSheet';
import { HexCamera } from './render/world/hexCamera';
import { drawWorld } from './render/world/boardRenderer';
import { LocalWorldServer, browserStore } from './worldServer/local';
import { RemoteWorldServer } from './worldServer/remote';
import { renderNicknameSheet } from './ui/world/nicknameSheet';
import { mountMinimap } from './ui/world/minimap';
import { bitsFrom } from './sim/world/fogBits';
import { BOARD_HEXES } from './sim/world/hex';
import { renderCrestEditor } from './ui/friends/crestEditor';
import { renderFriendSearch } from './ui/friends/friendSearch';
import { renderWishFilled, renderWishGive, renderWishNeed } from './ui/friends/wishSheets';
import { renderFriendProfile, renderFriendsSheet } from './ui/friends/friendsSheet';
import { LocalSocialServer, LOCAL_SOCIAL_KEY, browserSocialStore } from './socialServer/local';
import { RemoteSocialServer } from './socialServer/remote';
import { cloudAnalyticsSend, cloudSocialCall, cloudWorldCall } from './persist/cloud';
import { Analytics, browserAnalyticsStore } from './analytics/analytics';
import { trackedWorld } from './analytics/worldEvents';
import { mountWorldKnob } from './ui/worldKnob';
import { mountStage } from './ui/stage/stage';
import { giveBook } from './sim/research';
import { stockBuild } from './sim/districts';
import { mountUnlockSplash } from './ui/unlockSplash';
import { mountOfferSplash } from './ui/offerSplash';
import { mountNoticeColumn, mountStandingColumn } from './ui/notices/column';
import { renderNoticeCard } from './ui/notices/card';
import { mountOfferWidgets } from './ui/offerWidget';
import { ABANDONED, SCENES, UNLOCKS } from './sim/data/definitions';
import { activeQuest, claimQuest } from './sim/quests';
import { createPerfMeter } from './ui/perfHud';
import { renderWelcomeSheet, WELCOME_MIN_MS } from './ui/welcomeSheet';
import { renderStoreSheet } from './ui/storeSheet';
import { renderUpgradeSheet, upgradeSignature } from './ui/upgradeSheet';
import { renderPayerSheet } from './ui/payerSheet';
import { ToastShelf } from './ui/toasts';
import { choosePayerProfile, PAYER_PROFILES } from './sim/store';
import type { PayerProfile } from './sim/state';
import { renderIapSheet } from './ui/iapSheet';
import { mountQuestPill } from './ui/questPill';
import { dismissBootScreen, revealWhenReady } from './ui/bootScreen';
import { watchChromeMetrics } from './ui/chromeMetrics';
import { mirrorMountFlags } from './ui/mountFlags';
import { button, el, formatCount } from './ui/format';
import { recordResourceDiscovery } from './sim/discovery';
import { addToWallet, getWallet, type CurrencyId } from './sim/state';
import { holdWhileScrolling, legacy, ScreenSlot } from './ui/kit/host';
import { dragToScroll } from './ui/kit/scroll';

/** How far ahead of the device the dev world's clock runs (ms). */
const DEV_CLOCK_KEY = 'kingdom.devClockMs';

/** The dev bar's resource buttons (main.ts dev bar): what each adds — a
 *  material, null, doubles what is held (at least 1,000). */
const DEV_GRANTS: ReadonlyArray<{ icon: string; coin: CurrencyId; amount: number | null }> = [
  { icon: '🪙', coin: 'Gold', amount: null },
  { icon: '🍎', coin: 'Food', amount: null },
  { icon: '🪵', coin: 'Wood', amount: null },
  { icon: '🪨', coin: 'Stone', amount: null },
  { icon: '🔮', coin: 'Mana', amount: 100 },
  { icon: '📖', coin: 'Knowledge', amount: 10 },
  { icon: '💎', coin: 'Gems', amount: 1000 },
  { icon: '✨', coin: 'Stardust', amount: 100 },
  { icon: '⭐', coin: 'HeroXp', amount: 1000 },
];


// Every five seconds to the device: a page killed without a `pagehide` (an
// app swiped away, a crashed tab) loses no more than that. The cloud copy is
// debounced on its own (persist/saveManager.ts).
const AUTOSAVE_TICKS = 5;
/** A heartbeat a minute while the page is seen, and a batch of analytics
 *  every half minute (Docs/plans/analytics.md §3.1, §5). */
const HEARTBEAT_TICKS = 60;
const ANALYTICS_FLUSH_TICKS = 30;
/** Hidden this long, a page that shows again starts a new session. */
const NEW_SESSION_AFTER_MS = 5 * 60_000;

async function boot(): Promise<void> {
  // ?dev=data — every piece of game data in one tool (Docs/plans/data-editor.md),
  // INSTEAD of the game. Checked before anything else boots: it needs no
  // save, no tick and no supabase, and the game's chrome is in the way of a
  // desk tool. The map and tech tree editors live inside
  // it; their old URLs land on them there.
  const dev = new URLSearchParams(location.search).get('dev');
  if (dev === 'map' || dev === 'tree') {
    location.replace(`${location.pathname}?dev=data#${dev}`);
    return;
  }
  if (dev === 'data') {
    const { mountEditor } = await import('./editor/data/mount');
    dismissBootScreen();
    mountEditor();
    return;
  }

  // A data file changing is an event, not a module update
  // (scripts/vite-data-editor.mjs); the game simply starts again on the new
  // numbers, as it did when the file was a module.
  import.meta.hot?.on('kingdom:data', () => location.reload());

  const map = buildMapData();
  const saveManager = new SaveManager();
  await saveManager.init();
  const savedFile = await saveManager.load();

  const now = Date.now();
  // The offline replay happens INSIDE deserialize, before a Game exists, so
  // its results are captured here to be shown once the UI is up.
  //
  // The try/catch is not defensive decoration: an unexpected save shape used
  // to throw straight out of boot() and WHITE-SCREEN the app, which is a far
  // worse failure than the one being handled. A fresh game is recoverable; a
  // blank page is not.
  let catchUp: CatchUpReport | null = null;
  let restored = null;
  if (savedFile && isPrototypeStale(savedFile)) {
    console.info(`kingdom: save v${String(savedFile.SaveVersion)} predates the prototype's fresh start — starting a new kingdom`);
  } else if (savedFile) {
    try {
      restored = deserialize(savedFile, map, now, (r) => { catchUp = r; });
    } catch (err) {
      console.error('kingdom: unreadable save — starting fresh', err);
      catchUp = null;
    }
  }
  const state = restored ?? newGame(map, now);

  const canvas = document.getElementById('map') as HTMLCanvasElement;
  const camera = new Camera(canvas);
  // Center on the middle of the Townhall's 2x2 footprint (fractional cell).
  camera.centerOnCell({ x: TOWNHALL_ORIGIN.x + 0.5, y: TOWNHALL_ORIGIN.y + 0.5 });
  const game = new Game(state, map, camera);
  // The world board's own canvas and camera (Docs/features/19-world-map.md):
  // a second scene, drawn instead of the province while the player is out.
  const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
  const worldCamera = new HexCamera(worldCanvas);
  game.worldCamera = worldCamera;
  // World control is server state: the `world` edge function when the cloud
  // is up (worldServer/remote.ts), else a stand-in in the browser under its
  // own key (worldServer/local.ts). `?world=local` keeps the stand-in.
  const remoteWorld = saveManager.cloudActive && new URLSearchParams(location.search).get('world') !== 'local';
  // A dev clock for the stand-in: how far ahead of the device the world runs
  // (the dev bar's Portal button), so a timed event can be played any day.
  const devClockMs = (): number => {
    if (!new URLSearchParams(location.search).has('dev')) return 0;
    try { return Number(localStorage.getItem(DEV_CLOCK_KEY)) || 0; } catch { return 0; }
  };
  game.worldServer = remoteWorld ? new RemoteWorldServer(cloudWorldCall)
    : new LocalWorldServer(browserStore(), () => Date.now() + devClockMs(), devClockMs);
  // The friends list follows the world: the `social` edge function beside
  // the `world` one, else a stand-in peopled with made-up kingdoms
  // (socialServer/local.ts).
  game.friends.server = remoteWorld
    ? new RemoteSocialServer(cloudSocialCall)
    : new LocalSocialServer(browserSocialStore(), () => game.playerId);
  // An invitation link (`?friend=CODE`) is searched the first time the
  // friends list can.
  game.friends.invitedBy = new URLSearchParams(location.search).get('friend');
  // The playtest's analytics (Docs/plans/analytics.md), when there is a
  // server to send them to: every world command is an event of its own.
  if (saveManager.cloudActive) {
    game.analytics = new Analytics({
      send: cloudAnalyticsSend,
      store: browserAnalyticsStore(),
      context: () => game.analyticsContext(),
      dev: new URLSearchParams(location.search).has('dev'),
      gameVersion: GAME_VERSION,
      saveVersion: SAVE_VERSION,
    });
    game.worldServer = trackedWorld(game.worldServer, (name, props) => game.track(name, props));
    const away = catchUp as CatchUpReport | null;
    game.analytics.startSession(game.now(), {
      away_ms: away?.elapsedMs ?? 0,
      gold: away?.result.goldEarned ?? 0,
      mana: away?.result.manaEarned ?? 0,
      knowledge: away?.result.knowledgeEarned ?? 0,
    });
    // What no player reports: an error, with where it happened.
    const failed = (message: string, stack: string): void => game.track('client_error', {
      message: message.slice(0, 300), stack: stack.split('\n').slice(0, 4).join('\n'),
    });
    window.addEventListener('error', (e) => failed(String(e.message), String((e.error as Error | undefined)?.stack ?? '')));
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason as Error | undefined;
      failed(String(reason?.message ?? e.reason), String(reason?.stack ?? ''));
    });
  }
  game.playerId = saveManager.playerId();
  game.persist = () => saveManager.save(game.state, game.now());
  void game.connectWorld();

  if (!restored) saveManager.save(state, now); // brand-new game: save immediately

  // ------------------------------------------------------------------- UI
  // Let the type land before the first mount. The display face's metrics are
  // nothing like system-ui, so swapping it in afterwards would visibly reflow
  // the HUD. This is cheap here precisely because nothing has painted yet —
  // the app is a module script mounting into an empty #app — and the race
  // puts a hard ceiling on a slow or failed download.
  await Promise.race([
    Promise.all([
      // All four weights: the roles of tokens.css (--weight-small · body ·
      // strong · title). A weight left off this list is the one that swaps in
      // after the first paint and reflows the row it is in.
      document.fonts.load('400 16px "Nunito"'),
      document.fonts.load('600 16px "Nunito"'),
      document.fonts.load('700 16px "Nunito"'),
      document.fonts.load('800 22px "Nunito"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  mountHeader(game, document.getElementById('header')!);
  mountQuestPill(game, document.getElementById('quest')!);
  mountSurveyPill(game, document.getElementById('survey')!);
  mountNoticeColumn(game, document.getElementById('notices')!);
  mountStandingColumn(game, document.getElementById('standing')!);
  mountNavbar(game, document.getElementById('navbar')!);
  // Rewards flying into the header, over it and under the nav bar.
  mountRewardFly(game, document.getElementById('flyers')!);
  mountOfferWidgets(game, document.getElementById('offerwidgets')!);
  mountWorldKnob(game, document.getElementById('worldknob')!);
  mountExplorerChip(game, document.getElementById('worldchip')!);
  mountRankingWidget(game, document.getElementById('worldrank')!);
  mountMinimap(game, document.getElementById('worldmini')!);
  // The tutorial's stage: the First Morning, the introductions and the help
  // (Docs/features/23-tutorials.md). Over the nav, under the reveal.
  mountStage(game, document.getElementById('stage')!, document.getElementById('app')!);
  mountOfferSplash(game, document.getElementById('offersplash')!);
  mountUnlockSplash(game, document.getElementById('unlock')!);
  // What is mounted, as classes on #ui, for the CSS that steps aside.
  mirrorMountFlags(document.getElementById('ui')!);
  // A mouse drags every list and row the way a finger does (kit/scroll.ts).
  dragToScroll(document.getElementById('ui')!);
  // The fight, under the reveal that deals what it paid.
  mountBattleScreen(game, document.getElementById('battle')!);
  mountGachaScreen(game, document.getElementById('gacha')!);
  mountAdScreen(game, document.getElementById('ad')!);
  // The two bars publish their REAL heights as --hud-h / --nav-h, which is
  // what every other screen positions against. The tokens are only the
  // pre-paint fallback; see ui/chromeMetrics.ts for what went wrong when the
  // numbers were hand-written.
  watchChromeMetrics({
    header: document.getElementById('header')!,
    navbar: document.getElementById('navbar')!,
    quest: document.getElementById('quest')!,
  });
  const saveModeLabel = saveManager.cloudActive ? '☁️ cloud save' : '💾 local save only';
  // Wipe both stores, keep the reload's pagehide save disarmed, start fresh.
  const resetSave = () => void saveManager.reset().then(() => {
    // The local world server's board goes with the save it was played from.
    try { localStorage.removeItem('kingdom.worldServer'); } catch { /* private window */ }
    try { localStorage.removeItem(LOCAL_SOCIAL_KEY); } catch { /* private window */ }
    location.reload();
  });

  const panelRoot = document.getElementById('panel')!;
  const overlayRoot = document.getElementById('overlay')!;
  const toastRoot = document.getElementById('toast')!;

  const OVERLAYS: Record<OverlayName, (g: Game) => HTMLElement> = {
    build: renderBuildMenu,
    research: renderResearchMenu,
    settings: (g) => renderSettingsMenu(g, { saveModeLabel, onReset: resetSave }),
    purse: renderPurseSheet,
    relic: renderRelicSheet,
    bag: renderBagSheet,
    speedup: renderSpeedupSheet,
    shortfall: renderShortfallSheet,
    heroes: renderHeroesSheet,
    lair: renderLairSheet,
    heroPicker: renderHeroPicker,
    relicPicker: renderRelicPicker,
    relicMoveConfirm: renderRelicMoveConfirm,
    mana: renderManaSheet,
    knowledge: renderKnowledgeSheet,
    world: renderDispatchSheet,
    worldSlot: renderWorldSlot,
    portal: renderPortalScreen,
    worldBuilding: renderWorldBuilding,
    army: renderArmySheet,
    delve: renderDelveScreen,
    builder: renderBuilderSheet,
    survey: renderSurveySheet,
    welcome: (g) => renderWelcomeSheet(g, catchUp!),
    store: renderStoreSheet,
    payerProfile: renderPayerSheet,
    nickname: renderNicknameSheet,
    friends: renderFriendsSheet,
    friendProfile: renderFriendProfile,
    ranking: renderRankingSheet,
    notice: renderNoticeCard,
    crestEditor: renderCrestEditor,
    friendSearch: renderFriendSearch,
    wishNeed: renderWishNeed,
    wishGive: renderWishGive,
    wishFilled: renderWishFilled,
    // The confirmation needs a SKU; with none pending it falls back to the
    // store rather than drawing an empty sheet.
    iapConfirm: (g) => (g.pendingSku !== null ? renderIapSheet(g, g.pendingSku) : renderStoreSheet(g)),
    // The popup needs a building. With none — it was demolished under the
    // sheet, or a save reloaded — it draws nothing rather than half a sheet.
    upgrade: (g) => {
      const d = g.upgradeDistrict();
      return d === null ? el('div', {}) : renderUpgradeSheet(g, d);
    },
  };

  /**
   * Screens that opt OUT of the per-tick rebuild, by saying what they read.
   *
   * A screen with no countdown on it has nothing to redraw a second later,
   * and one that draws images pays for the rebuild visibly — a fresh `<img>`
   * decodes before its first paint, so a grid of portraits blinks once a
   * second. Anything absent from this map keeps rebuilding, which is the
   * safe default.
   */
  const OVERLAY_SIGNATURES: Partial<Record<OverlayName, () => string>> = {
    settings: () => settingsSignature(game),
    build: () => buildMenuSignature(game),
    research: () => researchSignature(game),
    // Each of these reads one presenter view and nothing that counts down,
    // so that view IS what it is drawn from.
    purse: () => JSON.stringify(game.state.city.wallet),
    bag: () => bagSignature(game),
    survey: () => JSON.stringify(game.surveyScreen()),
    ranking: () => JSON.stringify(game.worldRanking()),
    upgrade: () => {
      const d = game.upgradeDistrict();
      return d === null ? 'none' : upgradeSignature(game, d);
    },
  };
  for (const name of Object.keys(OVERLAYS) as OverlayName[]) {
    if (game.overlaySignature(name) !== null) {
      OVERLAY_SIGNATURES[name] = () => game.overlaySignature(name)!;
    }
  }

  // Each mount point holds one keyed screen: same key → re-render in place,
  // different key → tear down and build. Screens still rebuild themselves
  // wholesale via legacy(); only the container is now stable, which is what
  // sheet animations and scroll preservation will need.
  const panelSlot = new ScreenSlot(panelRoot);
  const overlaySlot = new ScreenSlot(overlayRoot);

  // A card about something ON the map moves that thing into the map the
  // card leaves visible — the band between the header and the card's top
  // edge — once, when the card mounts. Panning after that is the player's.
  let framedPanelKey: string | null = null;
  const frameOnMap = (key: string, cell: Coord, size: { x: number; y: number }) => {
    if (framedPanelKey === key) return;
    framedPanelKey = key;
    const canvasTop = canvas.getBoundingClientRect().top;
    const top = document.getElementById('header')!.getBoundingClientRect().bottom - canvasTop;
    // The card sits at the bottom of #panel, so its top edge is the lowest
    // top among the slot's children — not the slot's own. A legacy screen is
    // a `display: contents` wrapper with no box of its own, so it is measured
    // by what it holds.
    const boxed = (c: Element): Element =>
      getComputedStyle(c).display === 'contents' && c.firstElementChild ? boxed(c.firstElementChild) : c;
    const tops = [...panelRoot.children].map((c) => boxed(c).getBoundingClientRect().top - canvasTop);
    const bottom = tops.length > 0 ? Math.min(...tops) : canvas.clientHeight;
    camera.centerFootprintWithin(cell, size, top, bottom, CAMERA_GLIDE_MS);
  };

  const refreshScreens = () => {
    // Bottom panel: placement > site card > district card > empty.
    const inspectedId = game.inspectedDistrictId;
    const site = game.inspectedSite;
    if (game.mode.kind === 'placing' || game.mode.kind === 'moving') {
      // One key for both: the bar is the same element, and re-keying it would
      // tear the panel down between placing and moving for no visible reason.
      // The window carries its own close (placementPanel.ts), so no legacy knob.
      panelSlot.show('placement', () => legacy(() => renderPlacementPanel(game)));
    } else if (game.mode.kind === 'casting') {
      panelSlot.show('casting', () => legacy(() => renderCastPanel(game), () => game.dismiss()));
    } else if (site !== null && standingLairAt(game.state, site)) {
      // A lair's card is a screen of its own, built once and ticked
      // (siteCard.ts, `lairCardScreen`), in the district card's frame.
      const lair = standingLairAt(game.state, site)!;
      panelSlot.show(`lair:${lair.id}`, () => lairCardScreen(game, lair.id));
      frameOnMap(`lair:${lair.id}`, lair.location, { x: lair.size, y: lair.size });
    } else if (site !== null && standingAbandonedAt(game.state, site)) {
      // An abandoned building's card is the district card's frame, with its
      // own close (siteCard.ts `renderAbandonedCard`).
      const ruin = standingAbandonedAt(game.state, site)!;
      panelSlot.show(`abandoned:${ruin.id}`, () => legacy(() => renderAbandonedCard(game, ruin)));
      frameOnMap(`abandoned:${ruin.id}`, ruin.location, DISTRICTS[ruin.districtId].size);
    } else if (site !== null && landmarkDefAt(site)) {
      // A landmark's card, in the same frame as a lair's (siteCard.ts,
      // `landmarkCardScreen`). Keyed by cell, so tapping a different site is
      // a real remount.
      const landmark = landmarkDefAt(site)!;
      panelSlot.show(`site:${site.x},${site.y}`, () => landmarkCardScreen(game, landmark));
      frameOnMap(`site:${site.x},${site.y}`, landmark.location, { x: landmark.size, y: landmark.size });
    } else if (inspectedId !== null) {
      // Keyed by district, so inspecting a different one is a real remount.
      // Built once per building and mutated on the tick (districtCard.ts):
      // the most-used panel and the longest scroller, so it is the one screen
      // that does not go through legacy().
      panelSlot.show(`district:${inspectedId}`, () => districtCardScreen(game, inspectedId));
      const inspected = districtById(game.state, inspectedId);
      if (inspected) frameOnMap(`district:${inspectedId}`, inspected.location, districtSize(inspected));
    } else {
      panelSlot.clear();
      framedPanelKey = null;
    }
    // Overlays. Exhaustive over OverlayName, so adding a name without a
    // screen is a compile error rather than an overlay that draws nothing.
    const overlay = game.openOverlay;
    if (overlay !== null) {
      // Kit sheets bring their own close knob; legacy overlays get one added.
      const KIT_SHEETS: OverlayName[] = [
        'purse', 'relic', 'bag', 'speedup', 'shortfall', 'heroes', 'lair', 'welcome', 'settings',
        'mana', 'knowledge', 'builder', 'store', 'payerProfile', 'iapConfirm', 'world', 'army', 'nickname', 'crestEditor', 'friendSearch', 'wishNeed', 'wishGive', 'wishFilled',
      ];
      const needsKnob = !KIT_SHEETS.includes(overlay);
      overlaySlot.show(overlay, () => {
        const screen = legacy(
          () => OVERLAYS[overlay](game),
          needsKnob ? () => game.dismiss() : undefined,
          OVERLAY_SIGNATURES[overlay],
        );
        // Browsed by dragging while the purse fills — the Build menu's row of
        // cards, the research book's page: a rebuild under a finger replaces
        // the scroller, and a phone drops the drag with it.
        return overlay === 'build' || overlay === 'research' ? holdWhileScrolling(screen) : screen;
      });
    }
    else overlaySlot.clear();
  };
  // A playtest organiser can set a tester's profile in the link
  // (`?payer=Minnow`): it is chosen here, before anything asks, and is as
  // final as one picked on the sheet (14-monetization.md §3).
  const presetPayer = new URLSearchParams(location.search).get('payer');
  if (presetPayer !== null && (PAYER_PROFILES as readonly string[]).includes(presetPayer)) {
    choosePayerProfile(game.state, presetPayer as PayerProfile, game.now());
  }
  // A return is watched for its first tap (Docs/playtest.md §5).
  game.armReturnTap(catchUp === null ? 0 : (catchUp as CatchUpReport).elapsedMs);
  // Show the offline report once, and only when the absence was long enough
  // to be worth interrupting for.
  if (catchUp !== null && (catchUp as CatchUpReport).elapsedMs >= WELCOME_MIN_MS) {
    game.setOverlay('welcome');
  }
  // A save with no payer profile stops here until one is chosen, once its
  // First Morning is over (Docs/features/14-monetization.md §3). setOverlay
  // already forces the profile sheet over anything else asked for, so this
  // only matters when nothing else was — and the moment the morning ends,
  // the sheet takes the next free screen.
  const askPayer = (): void => {
    if (game.payerDue() && game.openOverlay === null) game.setOverlay('payerProfile');
  };
  askPayer();

  game.onChange(refreshScreens);
  game.onChange(askPayer);
  // Which board is on screen, as a class the CSS swaps the canvases and the
  // province's pills on.
  const appRoot = document.getElementById('app')!;
  const syncScene = () => appRoot.classList.toggle('in-world', game.scene === 'world');
  game.onChange(syncScene);
  syncScene();
  // War drums while a party is mustered on a deploy sheet — a lair's or an
  // army's (src/audio/music.ts) — and in the hero picker opened from one,
  // which hands back to it. A fight played from it outranks them.
  // The battle's sounds come down then too, so they are ready by the first blow.
  const isDeploy = (o: string | null) => o === 'lair' || o === 'army';
  const syncMuster = () => {
    const mustering = isDeploy(game.openOverlay)
      || (game.openOverlay === 'heroPicker' && isDeploy(game.heroPick?.returnTo ?? null));
    setMusterMusic(mustering);
    if (mustering) warmBattleSfx();
  };
  game.onChange(syncMuster);
  syncMuster();

  // Tap the dimmed map beside a sheet to dismiss it (§5.4). Scoped to kit
  // sheets: a legacy full-screen menu has no "beside" to tap. #overlay is
  // inset:0 and pointer-events:auto, so this also guarantees the tap never
  // reaches the canvas underneath and fires a harvest.
  overlayRoot.addEventListener('pointerdown', (e) => {
    if (e.target === overlayRoot && overlayRoot.querySelector('.k-sheet')) game.dismiss();
  });

  // One slip per message: the same refusal twice restarts the one on screen.
  const toasts = new ToastShelf((msg) => {
    const t = el('div', { class: 'toast-msg' }, msg);
    toastRoot.append(t);
    return {
      // Its CSS fade starts over: dropped, laid out, given back.
      restart: () => { t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; },
      remove: () => t.remove(),
    };
  }, 2600);
  game.onToast((msg) => toasts.show(msg));

  // Background music can only start on a user gesture; keep nudging it on
  // every pointerdown until the browser lets it through (then it's a no-op).
  window.addEventListener('pointerdown', () => startMusic());

  // Interacting with the hinted element retires its arrow (capture phase, so
  // it works no matter what the element's own handler does). On the click,
  // not the press: retiring it re-renders the menu, and a button replaced
  // between press and release never receives its click.
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest?.('.hinted')) game.clearHint();
  }, true);

  // ----------------------------------------------------------------- input
  wireInput(
    canvas, camera,
    (sx, sy) => game.handleTap(sx, sy),
    (sx, sy) => game.grabGhost(sx, sy),
    (sx, sy) => game.dragGhostTo(sx, sy),
    (held) => game.holdGhost(held),
    (sx, sy) => game.holdAt(sx, sy),
  );
  // The world board takes the same gestures: a drag pans, a pinch or the
  // wheel zooms, a tap picks a hex. Nothing there is held or dragged.
  wireInput(
    worldCanvas, worldCamera,
    (sx, sy) => game.handleWorldTap(sx, sy),
    () => false,
    () => {},
  );

  // The perf readout's meter (?dev): every section below is timed through
  // it, and the dev bar's 📈 shows what a second costs.
  const perf = new URLSearchParams(location.search).has('dev') ? createPerfMeter() : null;
  if (perf !== null) {
    const notify = game.notify.bind(game);
    game.notify = () => perf.time('notify', notify);
  }
  const timed = <T>(label: string, fn: () => T): T => (perf === null ? fn() : perf.time(label, fn));

  // ------------------------------------------------------- the single tick
  // The ambience bed follows the camera: waves over water, wind over snow.
  // Off-map void keeps the LAST bed — the world's edge shouldn't chirp.
  let lastBiome: AmbienceName = 'meadow';
  const biomeAtCenter = (): AmbienceName => {
    const center = camera.screenToCell(canvas.clientWidth / 2, canvas.clientHeight / 2);
    const terrain = map.terrain.get(coordKey(center));
    if (terrain === undefined) return lastBiome;
    lastBiome = terrain === 'Water' ? 'coast'
      : terrain === 'Snow' || terrain === 'Tundra' ? 'snow' : 'meadow';
    return lastBiome;
  };

  let ticks = 0;
  let lastTickAt = Date.now();
  const runTick = () => {
    timed('tick', () => game.tick());
    syncAmbience(biomeAtCenter()); // ambience has its own mute now
    ticks += 1;
    if (ticks % AUTOSAVE_TICKS === 0) saveManager.save(game.state, game.now());
    // Time on screen (Docs/plans/analytics.md §2): only while the page is
    // seen, and never a throttled background gap.
    const at = Date.now();
    const visible = document.visibilityState === 'visible';
    if (visible) game.state.signals.playMs += Math.min(Math.max(0, at - lastTickAt), 5_000);
    lastTickAt = at;
    if (visible && ticks % HEARTBEAT_TICKS === 0) game.track('heartbeat');
    if (ticks % ANALYTICS_FLUSH_TICKS === 0) void game.analytics?.flush();
  };
  setInterval(runTick, 1000);
  runTick(); // catch up immediately on load (offline progress pays out here)

  // A page out of sight ends its session for now: it carries on if it is
  // seen again soon, and a new one starts after a longer absence.
  let hiddenAt: number | null = null;
  const leaving = (): void => {
    saveManager.save(game.state, game.now(), true);
    game.analytics?.endSession(game.now());
    void game.analytics?.flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (hiddenAt !== null && Date.now() - hiddenAt >= NEW_SESSION_AFTER_MS) {
        game.analytics?.startSession(game.now(), { away_ms: Date.now() - hiddenAt });
      }
      hiddenAt = null;
      lastTickAt = Date.now();
      runTick(); // browsers throttle hidden tabs
    } else {
      hiddenAt = Date.now();
      leaving();
    }
  });
  window.addEventListener('pagehide', leaving);

  // ------------------------------------------------------------ render loop
  // Paced (render/framePacer.ts): the display's rate while the map is being
  // touched or the camera is moving, slower while it is only being looked at.
  // The world board is paced the same way: its marchers move on their own,
  // and 30 fps is plenty for a walk.
  let lastDraw = -Infinity;
  let lastActive = -Infinity;
  let lastView = '';
  let lastWorldView = '';
  // THE FULL-SCREEN LAYERS — the battle, the unlock splash, the gacha reveal,
  // the rewarded video — hide the board whole. Nothing is drawn under them:
  // the canvas keeps its last frame, which is all a dimmed backdrop shows.
  const fullScreens = ['battle', 'unlock', 'gacha', 'ad']
    .map((id) => document.getElementById(id))
    .filter((e): e is HTMLElement => e !== null);
  const underFullScreen = (): boolean => fullScreens.some((e) => e.childElementCount > 0);
  const touched = () => { lastActive = performance.now(); };
  for (const type of ['pointerdown', 'pointermove', 'wheel'] as const) {
    window.addEventListener(type, touched, { capture: true, passive: true });
  }
  const frame = (t: number) => {
    perf?.frame(t);
    if (underFullScreen()) {
      // Nothing to draw; see fullScreens.
    } else if (game.scene === 'world') {
      const view = `${worldCamera.x}|${worldCamera.y}|${worldCamera.zoom}|${worldCanvas.clientWidth}|${worldCanvas.clientHeight}`;
      if (view !== lastWorldView) { lastWorldView = view; lastActive = t; }
      if (shouldDraw({ now: t, lastDraw, lastActive, covered: overlayRoot.childElementCount > 0 })) {
        lastDraw = t;
        timed('world', () => drawWorld(worldCanvas, worldCamera, {
          state: game.state, source: game.worldSource(), now: game.now(), selected: game.selectedHex,
          armies: game.worldView?.armies,
        }));
      }
    } else {
      const view = `${camera.x}|${camera.y}|${camera.zoom}|${canvas.clientWidth}|${canvas.clientHeight}`;
      if (view !== lastView) { lastView = view; lastActive = t; }
      if (shouldDraw({ now: t, lastDraw, lastActive, covered: overlayRoot.childElementCount > 0 })) {
        lastDraw = t;
        timed('map', () => drawMap(canvas, camera, game.state, map, game.markers(), game.floaters, game.villagers, game.tapFx, game.now(), game.collectBubbles, game.vanishingLairs));
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  void revealWhenReady();

  // ?dev=kit — the UI-kit gallery, in place of the game. Mounted before the
  // time-warp bar so it takes the whole screen.
  if (new URLSearchParams(location.search).get('dev') === 'kit') {
    const { mountGallery } = await import('./ui/devGallery');
    mountGallery(document.getElementById('ui')!);
    return;
  }

  // Dev time-warp (?dev): shift every timestamp back N minutes to demo offline catch-up.
  if (new URLSearchParams(location.search).has('dev')) {
    // The presenter, reachable from the console. Every screen is a pure
    // function of it, so `kingdom.openLair('Orcs')` is a faster
    // way to reach a sheet than finding its cell on the map — and it is the
    // difference between checking a layout in ten seconds and in ten clicks.
    (window as unknown as { kingdom: Game }).kingdom = game;
    const warp = (minutes: number) => {
      // Shift every stored timestamp into the past, then let the unified
      // advance replay the "absence".
      const delta = minutes * 60_000;
      game.state.lastAdvance -= delta;
      for (const item of game.state.city.trainingQueue) {
        if (item.startedAt !== null) item.startedAt -= delta;
      }
      for (const d of game.state.city.districts) {
        if (d.rentAnchor !== undefined) d.rentAnchor -= delta;
      }
      for (const w of game.state.workers) {
        w.stateStartedAt -= delta;
        if (w.stateUntil !== null) w.stateUntil -= delta;
      }
      for (const [, h] of Object.entries(game.state.harvest)) {
        if (h.exhaustedUntil !== null) h.exhaustedUntil -= delta;
      }
      for (const q of game.state.city.queue) {
        if (q.startedAt !== null) q.startedAt -= delta;
      }
      game.state.kingdom.lastKnowledgeAt -= delta;
      // Mana accrues against its own anchor, like rent: without this a warped
      // absence filled every store and left the well where it was.
      game.state.city.lastManaAt -= delta;
      // The founding too, so a warp past midnight is a second day.
      game.state.tutorial.startedAt -= delta;
      for (const r of game.state.featureRespawns) r.readyAt -= delta;
      // The lairs' counters, so the warp demos a raid landing during an
      // absence the way it demos the rest of it.
      for (const lair of Object.values(game.state.lairs)) {
        if (lair === undefined) continue;
        lair.armedAt -= delta;
        if (lair.nextRaidAt !== null) lair.nextRaidAt -= delta;
      }
      // The world board as well: the explorers and builders out, and every
      // time the local world server keeps — marches, builds, rivals.
      for (const e of game.state.world.explorers) e.departedAt -= delta;
      for (const b of game.state.world.builds) b.finishesAt -= delta;
      void game.worldServer?.devShift?.(delta).then(() => game.refreshWorld());
      runTick();
    };
    const allTechs = () => {
      for (const id of TECH_ORDER) {
        if (!game.state.research.completed.includes(id)) game.state.research.completed.push(id);
      }
      game.state.research.poured = {};
      runTick();
    };
    // Relics are restored from fragments a long way into a game — this is
    // how the relic sheets and cast mode get exercised in one click. Level 2
    // on every relic, so the sheet's "now → next" has something to say.
    const allRelics = () => {
      for (const id of ARTIFACT_ORDER) {
        grantArtifactLevel(game.state, id);
        grantArtifactLevel(game.state, id);
      }
      addMana(game.state, manaCap(game.state));
      runTick();
    };
    // Every relic door opened and a handful of fragments each, so the Bag's
    // Relics tab, Restore and the forge can be seen without the lairs.
    let devDrops = 0;
    const someFragments = () => {
      for (const door of [...LAIR_ORDER, 'room', 'boss', 'portal', 'scouting']) openRelicDoor(game.state, door);
      dropFragments(game.state, 'any', 24, ['dev', devDrops++]);
      runTick();
    };
    // A chest on demand (ui/gachaScreen.ts): a REAL call on a banner, the
    // keys handed over first, or a real relic pack with the Gems for it.
    const devCall = (banner: 'basic' | 'advanced', count: number) => {
      grantItem(game.state, BANNERS[banner].key, count);
      if (count === 1) game.doPull(banner);
      else game.doPullMany(banner, count);
    };
    const devRelicPack = () => {
      for (const door of [...LAIR_ORDER, 'room', 'boss', 'portal', 'scouting']) openRelicDoor(game.state, door);
      addToWallet(game.state.player.wallet, 'Gems', game.fragmentPackOffer().gems);
      game.doBuyFragmentPack();
    };
    // Three of every item, so the Bag's tiles, popovers and Use ×N can be
    // seen before anything in the game pays an item.
    const someItems = () => {
      for (const id of ITEM_ORDER) grantItem(game.state, id, 3);
      runTick();
    };
    // "Warp then reload" is the only way to exercise the offline report: the
    // in-place time warp above never goes through deserialize().
    const warpReload = (minutes: number) => {
      warp(minutes);
      saveManager.save(game.state, game.now(), true);
      location.reload();
    };
    // THE DEVICE FRAME: the game's frame (#app) forced to a phone's or a
    // tablet's aspect ratio, as large as the window allows and centred, to
    // sign off a menu on each device from a desktop browser. The UI scales
    // with the frame (tokens.css, --rpx / --px), so the frame's SHAPE is what
    // decides the composition — the size only zooms it.
    //
    // THE NOTCH, TOO. A desktop browser's safe-area insets are zero, so the
    // header and the nav read `var(--safe-top, env(…))` and the frame sets
    // --safe-top / --safe-bottom to the device's own, in the device's CSS
    // pixels scaled to the frame (100cqw is the frame's width). style.css
    // draws the notch or Dynamic Island and the home bar over the frame, so
    // what they cover is in plain sight. Remembered across reloads, like
    // whether the bar is open.
    const DEVICES = [
      { id: 'off', label: 'Off' },
      { id: 'iphone-x', label: 'iPhone X', w: 375, h: 812, top: 44, bottom: 34 },
      { id: 'iphone-17', label: 'iPhone 17', w: 402, h: 874, top: 62, bottom: 34 },
      // The widest iPad for its height (3:4) AND one with insets: the least
      // usable height in proportion, which is what sets the menus' size.
      { id: 'ipad-pro', label: 'iPad Pro 12.9"', w: 1024, h: 1366, top: 24, bottom: 20 },
    ] as const;
    const DEVICE_KEY = 'kingdom.devDevice';
    const deviceButton = button('', () => {});
    const setDevice = (id: string) => {
      const device = DEVICES.find((d) => d.id === id) ?? DEVICES[0];
      const root = document.documentElement;
      const dials = ['--device-ar', '--device-w', '--safe-top', '--safe-bottom'];
      if ('w' in device) {
        root.dataset.device = device.id;
        root.style.setProperty('--device-ar', String(device.w / device.h));
        root.style.setProperty('--device-w', String(device.w));
        root.style.setProperty('--safe-top', `calc(100cqw * ${device.top} / ${device.w})`);
        root.style.setProperty('--safe-bottom', `calc(100cqw * ${device.bottom} / ${device.w})`);
      } else {
        delete root.dataset.device;
        for (const dial of dials) root.style.removeProperty(dial);
      }
      deviceButton.textContent = `📱 ${device.label}`;
      try { localStorage.setItem(DEVICE_KEY, device.id); } catch { /* private window */ }
    };
    deviceButton.addEventListener('click', () => {
      const at = DEVICES.findIndex((d) => d.id === (document.documentElement.dataset.device ?? 'off'));
      setDevice(DEVICES[(at + 1) % DEVICES.length].id);
    });
    try { setDevice(localStorage.getItem(DEVICE_KEY) ?? 'off'); } catch { setDevice('off'); }
    // THE PERF READOUT (ui/perfHud.ts), remembered across reloads.
    const PERF_KEY = 'kingdom.devPerf';
    const perfButton = button('📈 perf', () => {
      perf?.setVisible(!perf.visible());
      try { localStorage.setItem(PERF_KEY, perf?.visible() ? '1' : '0'); } catch { /* private window */ }
    });
    if (perf !== null) {
      document.getElementById('ui')!.append(perf.node);
      try { perf.setVisible(localStorage.getItem(PERF_KEY) === '1'); } catch { /* private window */ }
    }
    const devGrid = el('div', { class: 'dev-grid' },
      deviceButton, perfButton,
      button('⏪ 5 min', () => warp(5)), button('⏪ 1 h', () => warp(60)),
      button('💤 6 h + reload', () => warpReload(360)),
      button('🔬 all techs', allTechs), button('🔮 all relics', allRelics),
      button('🧩 fragments', someFragments), button('🎒 items', someItems),
      button('🪙 call ×1', () => devCall('basic', 1)), button('🪙 call ×10', () => devCall('basic', 10)),
      button('👑 call ×1', () => devCall('advanced', 1)), button('👑 call ×10', () => devCall('advanced', 10)),
      button('🔮 relic pack', devRelicPack),
      // The only way to raise the builder count until the store exists
      // (Phase 3). See grantBuilder() for why it is unpriced.
      button('👷 +1 builder', () => {
        if (grantBuilder(game.state) === 'AtCeiling') game.toast('Builders are at the ceiling');
        runTick();
      }),
      // The Townhall ladder is step 7; until it lands, the buildings gated
      // behind TH5+ — the workshops first — are only reachable from here.
      button('🏛 +1 Townhall', () => {
        const th = game.state.city.districts.find((d) => d.definitionId === 'Townhall');
        if (th && th.level < 10) th.level += 1;
        runTick();
      }),
      // Goods, until a workshop can make them (Docs/features/17-workshops-and-goods.md
      // §3): the prices that name them ship before the producer does.
      button('📦 +10 goods', () => {
        for (const id of GOOD_ORDER) addGood(game.state.city.goods, id, 10);
        runTick();
      }),
      // RESOURCES, into the wallet each one lives in (the scopes the Survey
      // pays into, sim/survey.ts). A material adds 1,000 or doubles what is
      // held, whichever is more, so the button keeps up with a late city.
      ...DEV_GRANTS.map(({ icon, coin, amount }) =>
        Object.assign(button(amount === null ? `${icon} +${coin}` : `${icon} +${formatCount(amount)} ${coin}`, () => {
          const wallet = coin === 'Gems' ? game.state.player.wallet
            : coin === 'Stardust' || coin === 'Knowledge' || coin === 'HeroXp' ? game.state.kingdom.wallet
              : game.state.city.wallet;
          addToWallet(wallet, coin, amount ?? Math.max(1000, getWallet(wallet, coin)));
          recordResourceDiscovery(game.state, coin);
          runTick();
        }), { title: amount === null ? `Adds ${formatCount(1000)} ${coin}, or doubles what you hold` : '' })),
      // Force an offer: drain the pool under the gate and clear the cooldown.
      button('📺 ad offer', () => {
        game.state.ads.readyAt = 0;
        game.state.ads.pending = false;
        game.state.city.wallet.Mana = 1;
        runTick();
      }),
      // The authoring tool, from the bar rather than from the URL. It mounts
      // INSTEAD of the game (see the top of boot), so this is a real
      // navigation — and the `pagehide` handler above saves on the way out.
      button('🗂 data', () => { location.href = `${location.pathname}?dev=data`; }),
      button('🗺 map', () => { location.href = `${location.pathname}?dev=data#map`; }),
      button('🌳 tree', () => { location.href = `${location.pathname}?dev=data#tree`; }),
      // THE FIRST-TIME EXPERIENCE, for reviewing it (Docs/features/23-tutorials.md):
      // skip the First Morning, finish the active quest, or play every scene
      // again from where the kingdom stands.
      button('⏭ quest', () => {
        const q = activeQuest(game.state);
        if (q === null) return;
        // An absolute goal is met by state; a relative one by its counter.
        game.state.quests.progress = Math.max(game.state.quests.progress, q.goalAmount);
        if (claimQuest(game.state) !== 'Claimed') game.toast(`${q.name} needs its goal met first`);
        runTick();
      }),
      button('🌅 skip morning', () => {
        for (const s of SCENES) if (s.id === 'intro' || s.id.startsWith('morning')) game.state.tutorial.seen[`scene:${s.id}`] = true;
        runTick();
      }),
      // Every scene still to play, played: what one would have handed over —
      // a book, a build's materials — handed over now, so nothing it gives
      // is left behind it.
      button('🎓 tutorials', () => {
        for (const s of SCENES) {
          const key = `scene:${s.id}`;
          if (game.state.tutorial.seen[key]) continue;
          for (const l of s.lines) {
            if (l.gives) giveBook(game.state, l.gives);
            if (l.stocks) stockBuild(game.state, l.stocks);
            if (l.restores) giveRelic(game.state, l.restores);
          }
          game.state.tutorial.seen[key] = true;
        }
        runTick();
      }),
      button('🎬 replay scenes', () => {
        for (const k of Object.keys(game.state.tutorial.seen)) if (k.startsWith('scene:')) delete game.state.tutorial.seen[k];
        game.state.tutorial.veteran = false;
        runTick();
      }),
      // Every unlock splash, one after another, to review them.
      button('✨ unlocks', () => {
        game.unlockQueue.push(...Object.keys(UNLOCKS));
        runTick();
      }),
      // The world board, opened for real: a Watchtower is claimed — its
      // door (sim/doors.ts) — without finding it, and the player walks out.
      button('🌍 world', () => {
        // The Watchtower repaired and standing, without the lens or the minute.
        const tower = ABANDONED.find((a) => a.districtId === 'Watchtower');
        if (tower === undefined) return;
        game.state.discoveries[`site:${tower.id}`] = true;
        if (game.state.abandoned.repaired[tower.id] !== true) {
          game.state.abandoned.repaired[tower.id] = true;
          game.state.city.districts.push({
            uniqueId: 'watchtower', definitionId: 'Watchtower', ordinal: 1, level: 1, assignedWorkers: 0,
            location: tower.location, state: 'Built', visualVariant: 1,
          });
        }
        runTick();
        game.enterWorld();
      }),
      // The Dark Portal, open now: the stand-in's clock moves on to its next
      // opening (19 §10.2), and the page reloads on it. Forward only.
      button('🌀 Portal', () => {
        const now = game.now();
        let k = portalEvent(now);
        if (portalOpen(now)) { game.toast('The Portal is open'); game.notify(); return; }
        if (portalOpensAt(k) <= now) k += 1;
        const ahead = portalOpensAt(k) - now + 60_000;
        try { localStorage.setItem(DEV_CLOCK_KEY, String((Number(localStorage.getItem(DEV_CLOCK_KEY)) || 0) + ahead)); } catch { return; }
        location.reload();
      }),
      // The whole world in view, to look the board over without exploring it.
      button('🗺 reveal', () => {
        game.state.world.revealed = bitsFrom(BOARD_HEXES.map((_, i) => i));
        runTick();
      }),
      // The friends list, opened whatever the Townhall, and one more of the
      // stand-in's kingdoms asking to be friends (socialServer/local.ts).
      button('👥 friends', () => {
        game.state.tutorial.seen['door:friends'] = true;
        void (game.friends.server?.devAsk?.() ?? Promise.resolve()).then(() => game.friends.open());
        runTick();
      }),
      // The world server's stand-in rivals: play a turn as any of them, to
      // set up a board by hand. Their commands cost the player nothing.
      (() => {
        const b = button('🎭 as: you', () => {
          const seats = game.worldView?.seats ?? [];
          const order = [null, ...seats.filter((s) => !s.you).map((s) => s.seat)];
          const at = order.indexOf(game.actingSeat);
          game.actingSeat = order[(at + 1) % order.length] ?? null;
          const who = game.actingSeat === null ? 'you' : seats.find((s) => s.seat === game.actingSeat)?.name ?? '?';
          b.textContent = `🎭 as: ${who}`;
          runTick();
        });
        return b;
      })(),
      button('🗑 reset save', resetSave));
    // A tab that shows and hides the grid, so the tools stay one tap away
    // without covering the map. Whether it is open survives a reload.
    const DEV_OPEN_KEY = 'kingdom.devBarOpen';
    const readOpen = (): boolean => {
      try { return localStorage.getItem(DEV_OPEN_KEY) !== '0'; } catch { return true; }
    };
    const devBar = el('div', { class: 'dev-bar' });
    const devToggle = el('button', { class: 'dev-toggle', type: 'button' });
    const setOpen = (open: boolean) => {
      devBar.classList.toggle('is-open', open);
      devToggle.textContent = open ? '🛠 dev ▾' : '🛠 dev ▸';
      devToggle.setAttribute('aria-expanded', String(open));
      try { localStorage.setItem(DEV_OPEN_KEY, open ? '1' : '0'); } catch { /* private window */ }
    };
    devToggle.addEventListener('click', () => setOpen(!devBar.classList.contains('is-open')));
    devBar.append(devToggle, devGrid);
    setOpen(readOpen());
    document.getElementById('ui')!.append(devBar);
  }

  refreshScreens();
}

// Whatever goes wrong, the loading screen must not be what the player is
// left looking at.
boot().catch((err) => {
  dismissBootScreen();
  throw err;
});
