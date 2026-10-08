// THE BROWSER PICKS THE LANGUAGE (Docs/features/28-languages.md §1). Imported
// FIRST by main.ts, for its side effect: the data is localized as it loads,
// so the language must be set before anything imports the definitions.
// Kept out of lang.ts so the world server's bundle never meets `window`.

import { isLang, setLang, type Lang } from './lang';

const KEY = 'kingdom.lang';

/** The language saved on this device, else the first of the browser's that
 *  the game speaks, else English. The data tools are always in English: they
 *  edit the English source. */
function detect(): Lang {
  if (/[?&]dev=(data|map|tree)\b/.test(window.location.search)) return 'en';
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage blocked: fall through to the browser */ }
  const asked = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  for (const l of asked) {
    const code = (l ?? '').toLowerCase().slice(0, 2);
    if (isLang(code)) return code;
  }
  return 'en';
}

setLang(detect());

/** The player picked a language: remembered on this device, and the game
 *  reloads in it. */
export function chooseLang(l: Lang): void {
  try { window.localStorage.setItem(KEY, l); } catch { /* the reload cannot keep it */ }
  window.location.reload();
}
