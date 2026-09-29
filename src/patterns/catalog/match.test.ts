import { describe, it, expect } from 'vitest';
import { matchApps, type AppEntry } from './index';

const e = (name: string, extra: Partial<AppEntry> = {}): AppEntry =>
  ({ key: name, name, publisher: 'tester', keywords: [], links: {}, action: 'open', ...extra });

const apps = [
  e('Squad Chats', { keywords: ['chat', 'messaging'], category: 'messaging', description: 'A Discord-style chat.' }),
  e('Chat EU', { category: 'messaging' }),
  e('Wallet', { keywords: ['custody'], description: 'Hold keys; no chat here.' }),
  e('Governance', { category: 'governance' }),
];

describe('matchApps', () => {
  it('an empty or blank query matches nothing — browse, not search, is the empty state', () => {
    expect(matchApps(apps, '')).toEqual([]);
    expect(matchApps(apps, '   ')).toEqual([]);
  });
  it('is case-insensitive', () => {
    expect(matchApps(apps, 'WALLET').map((a) => a.name)).toEqual(['Wallet']);
  });
  it('ranks a name prefix, then a name word, then a keyword, then category or description', () => {
    expect(matchApps(apps, 'chat').map((a) => a.name)).toEqual(['Chat EU', 'Squad Chats', 'Wallet']);
  });
  it('matches keywords and category', () => {
    expect(matchApps(apps, 'custody').map((a) => a.name)).toEqual(['Wallet']);
    expect(matchApps(apps, 'governance').map((a) => a.name)).toEqual(['Governance']);
  });
  it('finds nothing for a word nothing carries', () => {
    expect(matchApps(apps, 'zebra')).toEqual([]);
  });
});
