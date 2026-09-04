// Bootstrap: load save → build state → start the ONE per-second tick → wire
// renderer + UI. Load order per Docs/10: the tick never runs against restored
// timestamps before rates are rebuilt (deserialize recalcs before returning).

import './style.css'; // legacy chrome — shrinks as screens migrate
import './ui/styles/index.css'; // the kit: imported second, so its rules win ties
import { syncAmbience, type AmbienceName } from './audio/ambience';
import { startMusic } from './audio/music';
import { Game, type OverlayName } from './game';
import { Camera } from './render/camera';
import { wireInput } from './render/input';
import { drawMap } from './render/mapRenderer';
import { SaveManager } from './persist/saveManager';
import { ARTIFACT_ORDER, TECH_ORDER } from './sim/data/definitions';
import { grantArtifact, normaliseSlots } from './sim/artifacts';
import { addMana, manaCap } from './sim/mana';
import { forceConjunction } from './sim/timeline';
import { grantBuilder } from './sim/commands';
import { addGood } from './sim/goods';
import { GOOD_ORDER } from './sim/data/definitions';
import { buildMapData, TOWNHALL_ORIGIN } from './sim/grid';
import { coordKey } from './sim/state';
import { newGame } from './sim/newGame';
import { deserialize, type CatchUpReport } from './sim/save';
import { mountHeader } from './ui/header';
import { mountNavbar, mountTools } from './ui/navbar';
import { mountAdOfferPill } from './ui/adOfferPill';
import { mountAdScreen } from './ui/adScreen';
import { renderAdOfferSheet } from './ui/adOfferSheet';
import { renderBuilderSheet } from './ui/builderSheet';
import { renderDailySheet } from './ui/dailySheet';
import { mountDailyPill } from './ui/dailyPill';
import { renderBuildMenu } from './ui/buildMenu';
import { renderPlacementPanel } from './ui/placementPanel';
import { renderCastPanel } from './ui/castPanel';
import { renderDistrictCard } from './ui/districtCard';
import { renderSiteCard } from './ui/siteCard';
import { renderMarketMenu } from './ui/marketMenu';
import { renderResearchMenu } from './ui/researchMenu';
import { renderSettingsMenu } from './ui/settingsMenu';
import { renderPurseSheet } from './ui/purseSheet';
import { renderReliquarySheet } from './ui/reliquarySheet';
import { renderExpeditionSheet } from './ui/expeditionSheet';
import { renderCheckpointSheet } from './ui/checkpointSheet';
import { renderWelcomeSheet, WELCOME_MIN_MS } from './ui/welcomeSheet';
import { renderStoreSheet } from './ui/storeSheet';
import { renderPayerSheet } from './ui/payerSheet';
import { renderIapSheet } from './ui/iapSheet';
import { mountQuestPill } from './ui/questPill';
import { mountDelvePill } from './ui/delvePill';
import { mountBanner } from './ui/banner';
import { watchChromeMetrics } from './ui/chromeMetrics';
import { button, el } from './ui/format';
import { legacy, ScreenSlot } from './ui/kit/host';

const AUTOSAVE_TICKS = 30;

async function boot(): Promise<void> {
  // ?dev=map — the map editor, INSTEAD of the game. Checked before anything
  // else boots: it needs no save, no tick and no supabase, and the game's
  // 9:16 phone frame is the wrong shape for looking at a region.
  if (new URLSearchParams(location.search).get('dev') === 'map') {
    const { mountEditor } = await import('./editor/mount');
    mountEditor();
    return;
  }

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
  if (savedFile) {
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

  if (!savedFile) saveManager.save(state, now); // brand-new game: save immediately

  // ------------------------------------------------------------------- UI
  // Let the type land before the first mount. The display face's metrics are
  // nothing like system-ui, so swapping it in afterwards would visibly reflow
  // the HUD. This is cheap here precisely because nothing has painted yet —
  // the app is a module script mounting into an empty #app — and the race
  // puts a hard ceiling on a slow or failed download.
  await Promise.race([
    Promise.all([
      // Germania One ships one weight, so asking for 700 would resolve to a
      // synthesised bold and leave the real face unwaited-for.
      document.fonts.load('400 24px "Kingdom Display"'),
      document.fonts.load('400 16px "Kingdom Body"'),
      document.fonts.load('700 16px "Kingdom Body"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  mountHeader(game, document.getElementById('header')!);
  mountQuestPill(game, document.getElementById('quest')!);
  mountDailyPill(game, document.getElementById('daily')!);
  mountDelvePill(game, document.getElementById('delves')!);
  mountBanner(game, document.getElementById('notice')!);
  mountNavbar(game, document.getElementById('navbar')!);
  mountTools(game, document.getElementById('tools')!);
  mountAdOfferPill(game, document.getElementById('adoffer')!);
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
  const resetSave = () => void saveManager.reset().then(() => location.reload());

  const panelRoot = document.getElementById('panel')!;
  const overlayRoot = document.getElementById('overlay')!;
  const toastRoot = document.getElementById('toast')!;

  const OVERLAYS: Record<OverlayName, (g: Game) => HTMLElement> = {
    build: renderBuildMenu,
    market: renderMarketMenu,
    research: renderResearchMenu,
    settings: (g) => renderSettingsMenu(g, { saveModeLabel, onReset: resetSave }),
    purse: renderPurseSheet,
    reliquary: renderReliquarySheet,
    expedition: renderExpeditionSheet,
    checkpoint: renderCheckpointSheet,
    adOffer: renderAdOfferSheet,
    builder: renderBuilderSheet,
    daily: renderDailySheet,
    welcome: (g) => renderWelcomeSheet(g, catchUp!),
    store: renderStoreSheet,
    payerProfile: renderPayerSheet,
    // The confirmation needs a SKU; with none pending it falls back to the
    // store rather than drawing an empty sheet.
    iapConfirm: (g) => (g.pendingSku !== null ? renderIapSheet(g, g.pendingSku) : renderStoreSheet(g)),
  };

  // Each mount point holds one keyed screen: same key → re-render in place,
  // different key → tear down and build. Screens still rebuild themselves
  // wholesale via legacy(); only the container is now stable, which is what
  // sheet animations and scroll preservation will need.
  const panelSlot = new ScreenSlot(panelRoot);
  const overlaySlot = new ScreenSlot(overlayRoot);

  const refreshScreens = () => {
    // Bottom panel: placement > site card > district card > empty.
    const inspectedId = game.inspectedDistrictId;
    const site = game.inspectedSite;
    if (game.mode.kind === 'placing' || game.mode.kind === 'moving') {
      // One key for both: the bar is the same element, and re-keying it would
      // tear the panel down between placing and moving for no visible reason.
      panelSlot.show('placement', () => legacy(() => renderPlacementPanel(game), () => game.dismiss()));
    } else if (game.mode.kind === 'casting') {
      panelSlot.show('casting', () => legacy(() => renderCastPanel(game), () => game.dismiss()));
    } else if (site !== null) {
      // Keyed by cell, so tapping a different site is a real remount.
      panelSlot.show(`site:${site.x},${site.y}`, () => legacy(
        () => renderSiteCard(game, site) ?? el('div'),
        () => game.dismiss(),
      ));
    } else if (inspectedId !== null) {
      // Keyed by district, so inspecting a different one is a real remount.
      panelSlot.show(`district:${inspectedId}`, () => legacy(() => {
        const district = game.state.city.districts.find((d) => d.uniqueId === inspectedId);
        return district ? renderDistrictCard(game, district) : el('div');
      }, () => game.dismiss()));
    } else {
      panelSlot.clear();
    }
    // Overlays. Exhaustive over OverlayName, so adding a name without a
    // screen is a compile error rather than an overlay that draws nothing.
    const overlay = game.openOverlay;
    if (overlay !== null) {
      // Kit sheets bring their own close knob; legacy overlays get one added.
      const KIT_SHEETS: OverlayName[] = [
        'purse', 'reliquary', 'expedition', 'checkpoint', 'welcome', 'settings',
        'adOffer', 'builder', 'daily', 'store', 'payerProfile', 'iapConfirm',
      ];
      const needsKnob = !KIT_SHEETS.includes(overlay);
      overlaySlot.show(overlay, () => legacy(
        () => OVERLAYS[overlay](game),
        needsKnob ? () => game.dismiss() : undefined,
      ));
    }
    else overlaySlot.clear();
  };
  // Show the offline report once, and only when the absence was long enough
  // to be worth interrupting for.
  if (catchUp !== null && (catchUp as CatchUpReport).elapsedMs >= WELCOME_MIN_MS) {
    game.setOverlay('welcome');
  }
  // A save with no payer profile stops here until one is chosen
  // (Docs/features/14-monetization.md §3). setOverlay already forces the
  // profile sheet over anything else asked for, so this only matters when
  // nothing else was — a fresh game with no welcome report.
  if (game.state.player.payer === null) game.setOverlay('payerProfile');

  game.onChange(refreshScreens);

  // Tap the dimmed map beside a sheet to dismiss it (§5.4). Scoped to kit
  // sheets: a legacy full-screen menu has no "beside" to tap. #overlay is
  // inset:0 and pointer-events:auto, so this also guarantees the tap never
  // reaches the canvas underneath and fires a harvest.
  overlayRoot.addEventListener('pointerdown', (e) => {
    if (e.target === overlayRoot && overlayRoot.querySelector('.k-sheet')) game.dismiss();
  });

  game.onToast((msg) => {
    const t = el('div', { class: 'toast-msg' }, msg);
    toastRoot.append(t);
    setTimeout(() => t.remove(), 2600);
  });

  // Background music can only start on a user gesture; keep nudging it on
  // every pointerdown until the browser lets it through (then it's a no-op).
  window.addEventListener('pointerdown', () => startMusic());

  // Interacting with the hinted element retires its arrow (capture phase, so
  // it works no matter what the element's own handler does).
  document.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest?.('.hinted')) game.clearHint();
  }, true);

  // ----------------------------------------------------------------- input
  wireInput(
    canvas, camera,
    (sx, sy) => game.handleTap(sx, sy),
    (sx, sy) => game.handleHold(sx, sy),
    (sx, sy) => game.grabGhost(sx, sy),
    (sx, sy) => game.dragGhostTo(sx, sy),
  );

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
  const runTick = () => {
    game.tick();
    syncAmbience(biomeAtCenter()); // ambience has its own mute now
    ticks += 1;
    if (ticks % AUTOSAVE_TICKS === 0) saveManager.save(game.state, game.now());
  };
  setInterval(runTick, 1000);
  runTick(); // catch up immediately on load (offline progress pays out here)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runTick(); // browsers throttle hidden tabs
    else saveManager.save(game.state, game.now(), true);
  });
  window.addEventListener('pagehide', () => saveManager.save(game.state, game.now(), true));

  // ------------------------------------------------------------ render loop
  const frame = () => {
    drawMap(canvas, camera, game.state, map, game.markers(), game.floaters, game.villagers, game.tapFx, game.now());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

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
    // function of it, so `kingdom.openExpedition('HollowBarrow')` is a faster
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
      game.state.city.lastTaxAt -= delta;
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
      for (const a of game.state.research.active) a.startedAt -= delta;
      for (const r of game.state.featureRespawns) r.readyAt -= delta;
      runTick();
    };
    const allTechs = () => {
      for (const id of TECH_ORDER) {
        if (!game.state.research.completed.includes(id)) game.state.research.completed.push(id);
      }
      game.state.research.active = [];
      runTick();
    };
    // Relics normally arrive from ruins, which is a delve away — this is how
    // the reliquary, the sockets and cast mode get exercised in one click.
    const allRelics = () => {
      for (const id of ARTIFACT_ORDER) grantArtifact(game.state, id);
      normaliseSlots(game.state);
      game.state.kingdom.wallet.Stardust = 5000;
      addMana(game.state, manaCap(game.state));
      runTick();
    };
    // "Warp then reload" is the only way to exercise the offline report: the
    // in-place time warp above never goes through deserialize().
    const warpReload = (minutes: number) => {
      warp(minutes);
      saveManager.save(game.state, game.now(), true);
      location.reload();
    };
    const devBar = el('div', { class: 'cast-banner', style: 'top:auto;bottom:120px' },
      '🛠 dev', button('⏪ 5 min', () => warp(5)), button('⏪ 1 h', () => warp(60)),
      button('💤 6 h + reload', () => warpReload(360)),
      button('🔬 all techs', allTechs), button('🔮 all relics', allRelics),
      // The only way to raise the builder count until the store exists
      // (Phase 3). See grantBuilder() for why it is unpriced.
      button('👷 +1 builder', () => {
        if (grantBuilder(game.state) === 'AtCeiling') game.toast('Builders are at the ceiling');
        runTick();
      }),
      // Goods, until a workshop can make them (Docs/plans/builder-30-days.md
      // §3): the prices that name them ship before the producer does.
      button('📦 +10 goods', () => {
        for (const id of GOOD_ORDER) addGood(game.state.city.goods, id, 10);
        runTick();
      }),
      button('✨ conjunction', () => { forceConjunction(game.state, game.now()); runTick(); }),
      // Force an offer: drain the pool under the gate and clear the cooldown.
      button('📺 ad offer', () => {
        game.state.ads.readyAt = 0;
        game.state.ads.pending = false;
        game.state.city.wallet.Mana = 1;
        runTick();
      }),
      button('🗑 reset save', resetSave));
    document.getElementById('ui')!.append(devBar);
  }

  refreshScreens();
}

void boot();
