import { describe, expect, it } from 'vitest';
import { BindingSchema, type TableEvent } from './schema.js';
import { BindingsEngine, bindingMatches } from './bindings.js';

const ev = (type: string, data: Record<string, unknown> = {}): TableEvent => ({ type, source: 'test', data, ts: 0 });
const binding = (raw: unknown) => BindingSchema.parse(raw);

describe('bindingMatches', () => {
  const b = binding({ id: 'b1', when: { type: 'key.down', match: { key: 'F5' } }, do: [{ type: 'scene.activate' }] });

  it('matches type and data, ignoring string case', () => {
    expect(bindingMatches(b, ev('key.down', { key: 'f5' }), 'idle')).toBe(true);
  });

  it('rejects a different key or event type', () => {
    expect(bindingMatches(b, ev('key.down', { key: 'F6' }), 'idle')).toBe(false);
    expect(bindingMatches(b, ev('key.up', { key: 'F5' }), 'idle')).toBe(false);
  });

  it('respects modes and enabled', () => {
    const scoped = binding({ ...b, modes: ['rpg'] });
    expect(bindingMatches(scoped, ev('key.down', { key: 'F5' }), 'idle')).toBe(false);
    expect(bindingMatches(scoped, ev('key.down', { key: 'F5' }), 'rpg')).toBe(true);
    expect(bindingMatches({ ...b, enabled: false }, ev('key.down', { key: 'F5' }), 'idle')).toBe(false);
  });

  it('with an empty match, matches any event of that type', () => {
    const any = binding({ id: 'b2', when: { type: 'card.present' }, do: [{ type: 'x' }] });
    expect(bindingMatches(any, ev('card.present', { uid: 'ABC' }), 'idle')).toBe(true);
  });
});

describe('BindingsEngine', () => {
  it('runs every matching action and keeps going after a failure', async () => {
    const calls: string[] = [];
    const engine = new BindingsEngine(() => 'idle');
    engine.registerAction('ok', (p) => void calls.push(String(p.n)));
    engine.registerAction('boom', () => {
      throw new Error('nope');
    });
    engine.setBindings([
      binding({ id: 'a', when: { type: 'go' }, do: [{ type: 'ok', params: { n: 1 } }, { type: 'boom' }, { type: 'ok', params: { n: 2 } }] }),
      binding({ id: 'b', when: { type: 'other' }, do: [{ type: 'ok', params: { n: 3 } }] }),
      binding({ id: 'c', when: { type: 'go' }, do: [{ type: 'missing' }] }),
    ]);

    const results = await engine.handle(ev('go'));

    expect(calls).toEqual(['1', '2']);
    expect(results.map((r) => r.ok)).toEqual([true, false, true, false]);
    expect(results[3].error).toMatch(/No handler/);
  });
});
