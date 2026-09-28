import { describe, it, expect } from 'vitest';
import { matchMock } from './api';

const h = () => ({ body: 1 });

describe('matchMock', () => {
  it('matches method and path, extracting params', () => {
    const m = matchMock({ 'GET /boards/:id': h }, 'GET', '/boards/42');
    expect(m?.params).toEqual({ id: '42' });
  });
  it('does not match another method or a longer path', () => {
    expect(matchMock({ 'GET /boards/:id': h }, 'POST', '/boards/42')).toBeNull();
    expect(matchMock({ 'GET /boards/:id': h }, 'GET', '/boards/42/panes')).toBeNull();
  });
  it('decodes params', () => {
    expect(matchMock({ 'GET /u/:name': h }, 'GET', '/u/a%20b')?.params).toEqual({ name: 'a b' });
  });
});
