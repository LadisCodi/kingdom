// Bootstrap: load save → build state → start the ONE per-second tick → wire
// renderer + UI. Load order per Docs/10: the tick never runs against restored
// timestamps before rates are rebuilt (deserialize recalcs before returning).

import './style.css';
import { startMusic } from './audio/music';
import { Game } from './game';
import { Camera } from './render/camera';
import { wireInput } from './render/input';
import { drawMap } from './render/mapRenderer';
import { SaveManager } from './persist/saveManager';
import { buildMapData, TOWNHALL_ORIGIN } from './sim/grid';
import { newGame } from './sim/newGame';
import { deserialize } from './sim/save';
import { mountHeader, setCloudBadge } from './ui/header';
import { mountNavbar } from './ui/navbar';
import { renderBuildMenu } from './ui/buildMenu';
import { renderPlacementPanel } from './ui/placementPanel';
import { renderDistrictCard } from './ui/districtCard';
import { renderArmyMenu } from './ui/armyMenu';
import { renderMarketMenu } from './ui/marketMenu';
import { renderResearchMenu } from './ui/researchMenu';
import { renderSettingsMenu } from './ui/settingsMenu';
import { mountQuestPill } from './ui/questPill';
import { button, el } from './ui/format';

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
  mountHeader(game, document.getElementById('header')!);
  mountQuestPill(game, document.getElementById('quest')!);
  mountNavbar(game, document.getElementById('navbar')!);
  const saveModeLabel = saveManager.cloudActive ? '☁️ cloud save' : '💾 local save only';
  setCloudBadge(saveModeLabel);
  // Wipe both stores, keep the reload's pagehide save disarmed, start fresh.
  const resetSave = () => void saveManager.reset().then(() => location.reload());

  const panelRoot = document.getElementById('panel')!;
  const overlayRoot = document.getElementById('overlay')!;
  const toastRoot = document.getElementById('toast')!;

  const refreshScreens = () => {
    // Bottom panel: placement > district card > empty.
    panelRoot.replaceChildren();
    if (game.mode.kind === 'placing') {
      panelRoot.append(renderPlacementPanel(game));
    } else if (game.inspectedDistrictId) {
      const district = game.state.city.districts.find(
        (d) => d.uniqueId === game.inspectedDistrictId,
      );
      if (district) panelRoot.append(renderDistrictCard(game, district));
    }
    // Overlays.
    overlayRoot.replaceChildren();
    if (game.openOverlay === 'build') overlayRoot.append(renderBuildMenu(game));
    else if (game.openOverlay === 'market') overlayRoot.append(renderMarketMenu(game));
    else if (game.openOverlay === 'army') overlayRoot.append(renderArmyMenu(game));
    else if (game.openOverlay === 'research') overlayRoot.append(renderResearchMenu(game));
    else if (game.openOverlay === 'settings') {
      overlayRoot.append(renderSettingsMenu(game, { saveModeLabel, onReset: resetSave }));
    }
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

  // ----------------------------------------------------------------- input
  wireInput(
    canvas, camera,
    (sx, sy) => game.handleTap(sx, sy),
    (sx, sy) => game.handleHold(sx, sy),
  );

  // ------------------------------------------------------- the single tick
  let ticks = 0;
  const runTick = () => {
    game.tick();
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
    const devBar = el('div', { class: 'cast-banner', style: 'top:auto;bottom:120px' },
      '🛠 dev', button('⏪ 5 min', () => warp(5)), button('⏪ 1 h', () => warp(60)),
      button('🗑 reset save', resetSave));
    document.getElementById('ui')!.append(devBar);
  }

  refreshScreens();
}

void boot();
