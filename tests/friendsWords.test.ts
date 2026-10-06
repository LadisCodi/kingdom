// How the friends list says when a kingdom was last about: roughly, the way
// a friend would (Docs/features/15-social.md §2.1).
import { describe, expect, it } from 'vitest';
import { lastSeenWords } from '../src/friendsClient';

const NOW = Date.parse('2026-10-06T18:00:00');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('last seen', () => {
  it('reads roughly, from online now to months ago', () => {
    expect(lastSeenWords(null, NOW)).toBe('Not seen yet');
    expect(lastSeenWords(NOW - 2 * MIN, NOW)).toBe('Online now');
    expect(lastSeenWords(NOW - 3 * 60 * MIN, NOW)).toBe('Today');
    expect(lastSeenWords(NOW - DAY, NOW)).toBe('Yesterday');
    expect(lastSeenWords(NOW - 4 * DAY, NOW)).toBe('This week');
    expect(lastSeenWords(NOW - 10 * DAY, NOW)).toBe('1 week ago');
    expect(lastSeenWords(NOW - 22 * DAY, NOW)).toBe('3 weeks ago');
    expect(lastSeenWords(NOW - 40 * DAY, NOW)).toBe('1 month ago');
    expect(lastSeenWords(NOW - 70 * DAY, NOW)).toBe('2 months ago');
  });
});
