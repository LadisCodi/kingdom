// What is mounted, mirrored as classes on #ui, for the CSS that steps aside
// while a menu is open (nav.css, hud.css, unlock.css).
//
// Those rules were `#ui:has(> #overlay:not(:empty))`. WebKit — every browser
// on iOS — does not always invalidate `:has(:empty)` when the last child is
// removed, and a closed window's last node goes from a timer after its exit
// animation (ScreenSlot), so on a device the nav bar stayed away over the map
// until some other mutation restyled the page. A class set by an observer is
// invalidated like any other class. It is still keyed on what is actually
// mounted, so it cannot drift from what is on screen.

export function mirrorMountFlags(ui: HTMLElement): void {
  const overlay = ui.querySelector<HTMLElement>(':scope > #overlay');
  const panel = ui.querySelector<HTMLElement>(':scope > #panel');
  const unlock = ui.querySelector<HTMLElement>(':scope > #unlock');

  const sync = () => {
    ui.classList.toggle('has-menu', overlay?.hasChildNodes() === true);
    ui.classList.toggle('has-card', panel?.querySelector('.dc') != null);
    ui.classList.toggle('has-unlock', unlock?.hasChildNodes() === true);
  };

  const observer = new MutationObserver(sync);
  if (overlay) observer.observe(overlay, { childList: true });
  if (panel) observer.observe(panel, { childList: true, subtree: true });
  if (unlock) observer.observe(unlock, { childList: true });
  sync();
}
