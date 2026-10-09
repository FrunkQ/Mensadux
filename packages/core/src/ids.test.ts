import { describe, expect, it } from 'vitest';
import { slugId } from './ids.js';

describe('slugId', () => {
  it('slugifies and de-duplicates', () => {
    expect(slugId('Tavern (warm)', [])).toBe('tavern-warm');
    expect(slugId('Tavern', ['tavern', 'tavern-2'])).toBe('tavern-3');
    expect(slugId('!!!', [])).toBe('item');
  });
});
