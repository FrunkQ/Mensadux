import { describe, expect, it } from 'vitest';
import { WledClient, normaliseEndpoint } from './client.js';
import { WledDriver, sceneStateFromWled } from './driver.js';

function fakeFetch(routes: Record<string, unknown>, posted: unknown[] = []): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (init?.method === 'POST') posted.push(JSON.parse(String(init.body)));
    if (!(path in routes)) return new Response('nope', { status: 404 });
    return new Response(JSON.stringify(routes[path]), { status: 200 });
  }) as typeof fetch;
}

describe('normaliseEndpoint', () => {
  it('adds a scheme and strips trailing slashes', () => {
    expect(normaliseEndpoint('wled-table.local/')).toBe('http://wled-table.local');
    expect(normaliseEndpoint('https://x/')).toBe('https://x');
  });
});

describe('sceneStateFromWled', () => {
  it('keeps the look and drops housekeeping', () => {
    const out = sceneStateFromWled({
      on: true,
      bri: 120,
      nl: { on: false },
      udpn: { send: false },
      seg: [{ id: 0, start: 0, stop: 248, len: 248, fx: 9 }],
    });
    expect(out).toEqual({ on: true, bri: 120, seg: [{ id: 0, start: 0, stop: 248, fx: 9 }] });
  });
});

describe('WledDriver', () => {
  it('recalls a preset with ps', async () => {
    const posted: unknown[] = [];
    const d = new WledDriver('t', 'x', new WledClient('x', 1000, fakeFetch({ '/json/state': {} }, posted)));
    await d.apply({ preset: 4 });
    expect(posted).toEqual([{ ps: 4 }]);
  });

  it('turns off segments the scene does not use', async () => {
    const posted: unknown[] = [];
    const current = { seg: [{ id: 0 }, { id: 1 }, { id: 2 }] };
    const d = new WledDriver('t', 'x', new WledClient('x', 1000, fakeFetch({ '/json/state': current }, posted)));
    await d.apply({ state: { on: true, seg: [{ id: 0, fx: 1 }] } });
    expect(posted).toEqual([{ on: true, seg: [{ id: 0, fx: 1 }, { id: 1, stop: 0 }, { id: 2, stop: 0 }] }]);
  });

  it('describes the device, tolerating a missing presets file', async () => {
    const d = new WledDriver(
      't',
      'x',
      new WledClient('x', 1000, fakeFetch({ '/json/info': { name: 'Table', ver: '0.15.0', leds: { count: 854 } } })),
    );
    expect(await d.describe()).toEqual({ name: 'Table', version: '0.15.0', ledCount: 854, presets: [] });
  });

  it('reports HTTP errors', async () => {
    const d = new WledDriver('t', 'x', new WledClient('x', 1000, fakeFetch({})));
    await expect(d.capture()).rejects.toThrow(/HTTP 404/);
  });
});
