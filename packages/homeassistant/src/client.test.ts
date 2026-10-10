import { describe, expect, it } from 'vitest';
import { HaClient, defaultService } from './client.js';

function fakeFetch(handler: (path: string, init: RequestInit) => Response, seen: { path: string; init: RequestInit }[] = []) {
  return (async (url: string | URL, init: RequestInit = {}) => {
    const path = new URL(String(url)).pathname;
    seen.push({ path, init });
    return handler(path, init);
  }) as typeof fetch;
}

describe('defaultService', () => {
  it('picks a sensible service per domain', () => {
    expect(defaultService('scene.tavern')).toBe('scene.turn_on');
    expect(defaultService('automation.dim')).toBe('automation.trigger');
    expect(defaultService('light.ceiling')).toBe('light.turn_on');
  });
});

describe('HaClient', () => {
  it('calls a service with the token and entity', async () => {
    const seen: { path: string; init: RequestInit }[] = [];
    const ha = new HaClient('ha.local:8123', 'tok', 1000, fakeFetch(() => new Response(''), seen));
    await ha.call('scene.turn_on', 'scene.tavern');
    expect(seen[0].path).toBe('/api/services/scene/turn_on');
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ entity_id: 'scene.tavern' });
  });

  it('lists pickable entities sorted by domain then name', async () => {
    const states = [
      { entity_id: 'sensor.temp' },
      { entity_id: 'scene.z', attributes: { friendly_name: 'Zed' } },
      { entity_id: 'light.a', attributes: { friendly_name: 'Lamp' } },
      { entity_id: 'scene.a', attributes: { friendly_name: 'Alpha' } },
    ];
    const ha = new HaClient('x', 't', 1000, fakeFetch(() => new Response(JSON.stringify(states))));
    expect((await ha.entities()).map((e) => e.entity_id)).toEqual(['light.a', 'scene.a', 'scene.z']);
  });

  it('explains a bad token and a missing token', async () => {
    const bad = new HaClient('x', 't', 1000, fakeFetch(() => new Response('', { status: 401 })));
    await expect(bad.ping()).rejects.toThrow(/rejected the access token/);
    await expect(new HaClient('x', '').ping()).rejects.toThrow(/No Home Assistant access token/);
  });

  it('rejects a malformed service name', async () => {
    const ha = new HaClient('x', 't', 1000, fakeFetch(() => new Response('')));
    await expect(ha.call('turn_on')).rejects.toThrow(/scene.turn_on/);
  });
});
