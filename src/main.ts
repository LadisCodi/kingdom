// Bootstrap: load save → build state → start the ONE per-second tick → wire
// renderer + UI. Load order per Docs/10: the tick never runs against restored
// timestamps before rates are rebuilt (deserialize recalcs before returning).

import './style.css'; // legacy chrome — shrinks as screens migrate
import './ui/styles/index.css'; // the kit: imported second, so its rules win ties
import { syncAmbience, type AmbienceName } from './audio/ambience';
import { musicMuted, startMusic } from './audio/music';
import { Game, type OverlayName } from './game';
import { Camera } from './render/camera';
import { wireInput } from './render/input';
import { drawMap } from './render/mapRenderer';
import { SaveManager } from './persist/saveManager';
import { TECH_ORDER } from './sim/data/definitions';
import { buildMapData, TOWNHALL_ORIGIN } from './sim/grid';
import { coordKey } from './sim/state';
import { newGame } from './sim/newGame';
import { deserialize } from './sim/save';
import { mountHeader } from './ui/header';
import { mountNavbar, mountTools } from './ui/navbar';
import { renderBuildMenu } from './ui/buildMenu';
import { renderPlacementPanel } from './ui/placementPanel';
import { renderDistrictCard } from './ui/districtCard';
import { renderArmyMenu } from './ui/armyMenu';
import { renderMarketMenu } from './ui/marketMenu';
import { renderResearchMenu } from './ui/researchMenu';
import { renderSettingsMenu } from './ui/settingsMenu';
import { renderPurseSheet } from './ui/purseSheet';
import { mountQuestPill } from './ui/questPill';
import { mountBanner } from './ui/banner';
import { button, el } from './ui/format';
import { legacy, ScreenSlot } from './ui/kit/host';

const AUTOSAVE_TICKS = 30;

async function boot(): Promise<void> {
  const map = buildMapData();
  const saveManager = new SaveManager();
  await saveManager.init();
  const savedFile = await saveManager.load();

  const now = Date.now();
  // v1 saves come back null → fresh game (save format changed with the harvest loop).
  const state = (savedFile ? deserialize(savedFile, map, now) : null) ?? newGame(map, now);

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
      document.fonts.load('700 24px "Kingdom Display"'),
      document.fonts.load('400 16px "Kingdom Body"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  mountHeader(game, document.getElementById('header')!);
  mountQuestPill(game, document.getElementById('quest')!);
  mountBanner(game, document.getElementById('notice')!);
  mountNavbar(game, document.getElementById('navbar')!);
  mountTools(game, document.getElementById('tools')!);
  const saveModeLabel = saveManager.cloudActive ? '☁️ cloud save' : '💾 local save only';
  // Wipe both stores, keep the reload's pagehide save disarmed, start fresh.
  const resetSave = () => void saveManager.reset().then(() => location.reload());

  const panelRoot = document.getElementById('panel')!;
  const overlayRoot = document.getElementById('overlay')!;
  const toastRoot = document.getElementById('toast')!;

  const OVERLAYS: Record<OverlayName, (g: Game) => HTMLElement> = {
    build: renderBuildMenu,
    market: renderMarketMenu,
    army: renderArmyMenu,
    research: renderResearchMenu,
    settings: (g) => renderSettingsMenu(g, { saveModeLabel, onReset: resetSave }),
    purse: renderPurseSheet,
  };

  // Each mount point holds one keyed screen: same key → re-render in place,
  // different key → tear down and build. Screens still rebuild themselves
  // wholesale via legacy(); only the container is now stable, which is what
  // sheet animations and scroll preservation will need.
  const panelSlot = new ScreenSlot(panelRoot);
  const overlaySlot = new ScreenSlot(overlayRoot);

  const refreshScreens = () => {
    // Bottom panel: placement > district card > empty.
    const inspectedId = game.inspectedDistrictId;
    if (game.mode.kind === 'placing') {
      panelSlot.show('placement', () => legacy(() => renderPlacementPanel(game), () => game.dismiss()));
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
      const needsKnob = overlay !== 'purse';
      overlaySlot.show(overlay, () => legacy(
        () => OVERLAYS[overlay](game),
        needsKnob ? () => game.dismiss() : undefined,
      ));
    }
    else overlaySlot.clear();
  };
  game.onChange(refreshScreens);
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
      : terrain === 'Snow' || terrain === 'Tundra' || terrain === 'Mountain' ? 'snow' : 'meadow';
    return lastBiome;
  };

  let ticks = 0;
  const runTick = () => {
    game.tick();
    syncAmbience(musicMuted() ? null : biomeAtCenter());
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
    const warp = (minutes: number) => {
      // Shift every stored timestamp into the past, then let the unified
      // advance replay the "absence".
      const delta = minutes * 60_000;
      game.state.lastAdvance -= delta;
      if (game.state.city.training) game.state.city.training.startedAt -= delta;
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
    const devBar = el('div', { class: 'cast-banner', style: 'top:auto;bottom:120px' },
      '🛠 dev', button('⏪ 5 min', () => warp(5)), button('⏪ 1 h', () => warp(60)),
      button('🔬 all techs', allTechs), button('🗑 reset save', resetSave));
    document.getElementById('ui')!.append(devBar);
  }

  refreshScreens();
}

void boot();
