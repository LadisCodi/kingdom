// THE PLAYER'S LANGUAGE (Docs/features/28-languages.md): English or Spanish.
//
// Chosen once, at boot, before any data is read — the data's names are
// localized as they load — so changing it reloads the game. The choice lives
// on the device, not in the save: two people on one kingdom may read it in
// two languages.
//
// Pure: English until the browser's boot says otherwise (src/i18n/browser.ts),
// so the tests and the world server read English.

export type Lang = 'en' | 'es';
export const LANGS: readonly Lang[] = ['en', 'es'];

/** Each language as it names itself, for the selector. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Español' };

/** How its numbers are written: *25,000* or *25.000*. */
export const NUMBER_LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-ES' };

let lang: Lang = 'en';

export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'es';

export const currentLang = (): Lang => lang;

/** Set once, by the browser's boot (src/i18n/browser.ts) before any data is
 *  read — and by tests. Data already loaded keeps the language it loaded in. */
export function setLang(l: Lang): void { lang = l; }

/** A decimal as the language writes it, for text the sim builds without
 *  `src/ui/format.ts`: *2.5* / *2,5*. No grouping — these are small. */
export const decimal = (n: number): string => (lang === 'es' ? String(n).replace('.', ',') : String(n));
