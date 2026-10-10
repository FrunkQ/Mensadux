import type { FastifyInstance } from 'fastify';
import {
  ActionSchema,
  BindingSchema,
  DeviceSchema,
  SceneSchema,
  TableEventSchema,
  slugId,
} from '@tabledux/core';
import { z } from 'zod';
import type { Table } from './table.js';

/**
 * REST API used by the web UI and by anything else that wants to drive
 * the table (StreamDeck, Home Assistant, scripts). Live state is pushed
 * over the /ws websocket; these routes are for reading config and
 * making changes.
 */
export function registerApi(app: FastifyInstance, table: Table): void {
  const { config } = table;

  const parse = <S extends z.ZodType>(schema: S, body: unknown): z.output<S> => {
    const r = schema.safeParse(body);
    if (!r.success) throw badRequest(r.error.message);
    return r.data;
  };

  app.get('/api/state', async () => table.snapshot());

  // Devices
  app.get('/api/devices', async () => config.devices);
  app.put('/api/devices', async (req) => {
    const devices = parse(z.array(DeviceSchema), req.body);
    await config.saveDevices(devices);
    table.rebuildDrivers();
    await table.refreshDevices();
    return config.devices;
  });
  app.post('/api/devices/refresh', async () => {
    await table.refreshDevices();
    return table.snapshot().devices;
  });

  // Scenes
  app.get('/api/scenes', async () => config.scenes);
  app.put('/api/scenes', async (req) => {
    await config.saveScenes(parse(z.array(SceneSchema), req.body));
    return config.scenes;
  });
  app.post('/api/scenes/capture', async (req) => {
    const { name, devices } = parse(
      z.object({ name: z.string().min(1), devices: z.array(z.string()).optional() }),
      req.body,
    );
    return table.captureScene(name, devices);
  });
  app.post('/api/scenes/:id/activate', async (req) => {
    await table.activateScene((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post('/api/lights/off', async () => {
    await table.allOff();
    return { ok: true };
  });

  // Bindings
  app.get('/api/bindings', async () => config.bindings);
  app.put('/api/bindings', async (req) => {
    const raw = parse(z.array(BindingSchema.partial({ id: true })), req.body);
    const taken: string[] = [];
    const bindings = raw.map((b) => {
      const id = b.id ?? slugId(b.name || b.when.type, [...taken, ...raw.flatMap((x) => (x.id ? [x.id] : []))]);
      taken.push(id);
      return { ...b, id };
    });
    await config.saveBindings(bindings);
    table.engine.setBindings(config.bindings);
    return config.bindings;
  });

  // Events in, from any HTTP client. This is the generic "external trigger" input.
  app.post('/api/events', async (req) => {
    const ev = parse(TableEventSchema, req.body);
    table.bus.emit({ ...ev, source: ev.source === 'unknown' ? 'http' : ev.source });
    return { ok: true };
  });

  // Run one action directly, e.g. a "test" button in the UI.
  app.post('/api/actions', async (req) => {
    const action = parse(ActionSchema, req.body);
    const result = await table.engine.run('manual', action, { type: 'manual', source: 'api', data: {}, ts: Date.now() });
    if (!result.ok) throw badRequest(result.error ?? 'Action failed');
    return result;
  });
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}
