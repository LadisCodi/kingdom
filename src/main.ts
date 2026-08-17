// Bootstrap: load save → build state → start the ONE per-second tick → wire
// renderer + UI. Load order per Docs/10: the tick never runs against restored
// timestamps before rates are rebuilt (deserialize recalcs before returning).

import './style.css';
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
import { renderCastBanner, renderSpellbook } from './ui/spellbook';
import { button, el } from './ui/format';

const AUTOSAVE_TICKS = 30;

async function boot(): Promise<void> {
  const map = buildMapData();
  const saveManager = new SaveManager();
  await saveManager.init();
  const savedFile = await saveManager.load();

  const now = Date.now();
  const state = savedFile
    ? deserialize(savedFile, map, now, Math.random)
    : newGame(map, now, Math.random);

  const canvas = document.getElementById('map') as HTMLCanvasElement;
  const camera = new Camera(canvas);
  camera.centerOnCell(TOWNHALL_ORIGIN);
  const game = new Game(state, map, camera);

  if (!savedFile) saveManager.save(state, now); // brand-new game: save immediately

  // ------------------------------------------------------------------- UI
  mountHeader(game, document.getElementById('header')!);
  mountNavbar(game, document.getElementById('navbar')!);
  setCloudBadge(saveManager.cloudActive ? '☁️ cloud save' : '💾 local save only');

  const panelRoot = document.getElementById('panel')!;
  const overlayRoot = document.getElementById('overlay')!;
  const toastRoot = document.getElementById('toast')!;
  let castBanner: HTMLElement | null = null;

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
    else if (game.openOverlay === 'spellbook') overlayRoot.append(renderSpellbook(game));
    else if (game.openOverlay === 'army') overlayRoot.append(renderArmyMenu(game));
    else if (game.openOverlay === 'research') {
      overlayRoot.append(
        el('div', { class: 'menu' },
          el('h2', {}, 'Research', button('✕', () => game.setOverlay(null))),
          el('p', { class: 'muted' }, 'Coming soon…')),
      );
    }
    // Cast banner.
    castBanner?.remove();
    castBanner = null;
    if (game.mode.kind === 'targeting') {
      castBanner = renderCastBanner(game);
      document.getElementById('ui')!.append(castBanner);
    }
  };
  game.onChange(refreshScreens);
  game.onToast((msg) => {
    const t = el('div', { class: 'toast-msg' }, msg);
    toastRoot.append(t);
    setTimeout(() => t.remove(), 2600);
  });

  // ----------------------------------------------------------------- input
  wireInput(canvas, camera, (sx, sy) => game.handleTap(sx, sy));

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
    drawMap(canvas, camera, game.state, map, game.markers(), game.floaters, game.now());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Dev time-warp (?dev): shift every timestamp back N minutes to demo offline catch-up.
  if (new URLSearchParams(location.search).has('dev')) {
    const warp = (minutes: number) => {
      const delta = minutes * 60_000;
      for (const d of game.state.city.districts) {
        for (const g of d.generators) g.lastProduction -= delta;
      }
      for (const g of game.state.kingdom.generators) g.lastProduction -= delta;
      for (const q of game.state.city.queue) {
        if (q.startedAt !== null) q.startedAt -= delta;
      }
      for (const s of game.state.activeSpells) s.expiresAt -= delta;
      runTick();
    };
    const devBar = el('div', { class: 'cast-banner', style: 'top:auto;bottom:120px' },
      '🛠 dev', button('⏪ 5 min', () => warp(5)), button('⏪ 1 h', () => warp(60)),
      button('🗑 reset save', () => {
        localStorage.removeItem('kingdom.save');
        location.reload();
      }));
    document.getElementById('ui')!.append(devBar);
  }

  refreshScreens();
}

void boot();
