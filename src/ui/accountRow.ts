// The account rows of Settings (Docs/features/15-social.md §2): link an
// email to this kingdom, or play the kingdom an email keeps on this device.
// Both are an email, then the six-digit code sent to it, typed here.
//
// The steps live at module level, as the reset's armed state does: the sheet
// is rebuilt whenever its signature changes, and what is being typed must
// survive that. Typing changes no signature; a step, a refusal or a wait does.

import type { Game } from '../game';
import {
  cloudEmail, linkEmailStart, linkEmailVerify, signInStart, signInVerify, type AccountProblem,
} from '../persist/cloud';
import { el } from './format';
import { btn } from './kit';

type Step = 'idle' | 'linkEmail' | 'linkCode' | 'signInEmail' | 'signInCode';

let step: Step = 'idle';
let emailDraft = '';
let codeDraft = '';
let problem: AccountProblem | null = null;
let busy = false;

const WORDS: Record<AccountProblem, string> = {
  taken: 'That email already keeps a kingdom. Sign in with it instead.',
  unknown: 'No kingdom keeps that email.',
  badCode: 'That code is wrong or has expired.',
  tooMany: 'Too many codes asked for. Try again in a while.',
  offline: 'The server could not be reached. Try again.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{6,10}$/;

export const accountSignature = (): string => [step, problem ?? '-', busy, cloudEmail() ?? '-'].join('|');

export function accountRows(game: Game, opts: { onSignedIn: () => void }): HTMLElement[] {
  const go = (next: Step): void => {
    step = next;
    problem = null;
    if (next === 'linkEmail' || next === 'signInEmail' || next === 'idle') codeDraft = '';
    game.notify();
  };
  const run = async (f: () => Promise<AccountProblem | null>, then: () => void): Promise<void> => {
    busy = true;
    problem = null;
    game.notify();
    const p = await f();
    busy = false;
    problem = p;
    if (p === null) then();
    game.notify();
  };

  const linked = cloudEmail();
  if (step === 'idle') {
    return [
      el('div', { class: 'set-row' },
        el('span', { class: 'set-icon is-save', role: 'img', 'aria-hidden': 'true' }),
        el('div', { class: 'set-words' },
          el('div', { class: 'set-label' }, linked === null ? 'No email linked' : 'Email linked'),
          el('div', { class: 'set-hint' }, linked ?? 'To play it on another device')),
        ...(linked === null ? [btn({ label: 'Link', kind: 'primary', onClick: () => go('linkEmail') })] : [])),
      el('div', { class: 'set-alt' },
        el('span', {}, 'Your kingdom is on another device?'),
        btn({ label: 'Sign in', onClick: () => go('signInEmail') })),
    ];
  }

  const asksCode = step === 'linkCode' || step === 'signInCode';
  const field = el('input', asksCode
    ? { class: 'nick-field', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '10', placeholder: '123456', 'aria-label': 'The code' }
    : { class: 'nick-field', type: 'email', autocomplete: 'email', autocapitalize: 'off', spellcheck: 'false', placeholder: 'you@example.com', 'aria-label': 'Your email' },
  ) as HTMLInputElement;
  field.value = asksCode ? codeDraft : emailDraft;
  field.addEventListener('input', () => {
    if (asksCode) codeDraft = field.value.replace(/\D/g, '');
    else emailDraft = field.value.trim();
  });

  const submit = (): void => {
    if (busy) return;
    const to = emailDraft.trim();
    if (!asksCode && !EMAIL.test(to)) return;
    if (asksCode && !CODE.test(codeDraft)) return;
    if (step === 'linkEmail') void run(() => linkEmailStart(to), () => { step = 'linkCode'; });
    else if (step === 'signInEmail') void run(() => signInStart(to), () => { step = 'signInCode'; });
    else if (step === 'linkCode') void run(() => linkEmailVerify(to, codeDraft), () => { step = 'idle'; codeDraft = ''; });
    else void run(() => signInVerify(to, codeDraft), () => { step = 'idle'; opts.onSignedIn(); });
  };
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  globalThis.requestAnimationFrame?.(() => field.focus());

  const lede = step === 'linkEmail' ? 'The email to link this kingdom to. A code will be sent to it.'
    : step === 'signInEmail' ? 'The email your kingdom is linked to. A code will be sent to it.'
    : `Type the code sent to ${emailDraft}.`;
  // Signing in leaves this device's kingdom behind: said before, not after.
  const warning = step === 'signInEmail' && cloudEmail() === null
    ? [el('div', { class: 'nick-hint is-refused' }, 'The kingdom on this device is not linked to an email, and will be lost.')]
    : [];
  return [el('div', { class: 'set-account' },
    el('p', { class: 'set-hint' }, lede),
    field,
    el('div', { class: `nick-hint${problem !== null ? ' is-refused' : ''}` }, problem !== null ? WORDS[problem] : ''),
    ...warning,
    el('div', { class: 'set-account-buttons' },
      btn({ label: 'Back', onClick: () => go(asksCode ? (step === 'linkCode' ? 'linkEmail' : 'signInEmail') : 'idle') }),
      btn({
        label: busy ? 'Sending…' : asksCode ? 'Confirm' : 'Send code',
        kind: 'primary',
        onClick: submit,
        ...(busy ? { disabledReason: 'Sending' } : {}),
      })))];
}
