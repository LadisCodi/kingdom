// WRITES ONLY WHAT CHANGED. The chrome over the map — the header, the nav,
// the pills — is refreshed on every notify: once a second at rest, ten times
// while a hold collects. A write of the value already there still mutates
// the DOM and asks for a style pass, so each of these compares first.

export const setText = (n: Node, v: string): void => {
  if (n.textContent !== v) n.textContent = v;
};

export const setAttr = (n: Element, k: string, v: string): void => {
  if (n.getAttribute(k) !== v) n.setAttribute(k, v);
};

export const setStyle = (n: HTMLElement, k: string, v: string): void => {
  if (n.style.getPropertyValue(k) !== v) n.style.setProperty(k, v);
};

export const setHidden = (n: HTMLElement, hidden: boolean): void => {
  if (n.hidden !== hidden) n.hidden = hidden;
};
