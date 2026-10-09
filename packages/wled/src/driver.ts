import type { LightDriver, LightInfo, LightTarget } from '@tabledux/core';
import { WledClient, type WledState } from './client.js';

/**
 * Keys in WLED's /json/state that describe what's on show. Everything
 * else (nightlight, UDP sync, live/realtime flags, playlist ids…) is
 * device housekeeping we don't want to replay from a saved scene.
 */
const SCENE_STATE_KEYS = ['on', 'bri', 'transition', 'mainseg', 'seg'] as const;

/** Read-only or runtime-only segment fields that WLED rejects or ignores on write. */
const SEGMENT_DROP_KEYS = new Set(['len', 'lc', 'cct']);

export function sceneStateFromWled(state: WledState): WledState {
  const out: WledState = {};
  for (const key of SCENE_STATE_KEYS) {
    if (key in state) out[key] = state[key];
  }
  if (Array.isArray(out.seg)) {
    out.seg = (out.seg as Record<string, unknown>[]).map((seg) =>
      Object.fromEntries(Object.entries(seg).filter(([k]) => !SEGMENT_DROP_KEYS.has(k))),
    );
  }
  return out;
}

export class WledDriver implements LightDriver {
  readonly client: WledClient;

  constructor(
    readonly deviceId: string,
    url: string,
    client?: WledClient,
  ) {
    this.client = client ?? new WledClient(url);
  }

  async describe(): Promise<LightInfo> {
    const [info, presets] = await Promise.all([this.client.info(), this.client.presets().catch(() => [])]);
    return { name: info.name, version: info.ver, ledCount: info.leds?.count ?? 0, presets };
  }

  async capture(): Promise<LightTarget> {
    return { state: sceneStateFromWled(await this.client.state()) };
  }

  async apply(target: LightTarget): Promise<void> {
    if ('preset' in target) {
      await this.client.setState({ ps: target.preset });
      return;
    }
    // A captured scene lists every segment it had. Any other segment on the
    // device is deleted (WLED deletes a segment when its stop is set to 0),
    // so leftovers from a previous scene don't linger.
    const state = { ...target.state };
    const segs = Array.isArray(state.seg) ? [...(state.seg as Record<string, unknown>[])] : undefined;
    if (segs) {
      const used = new Set(segs.map((s) => s.id));
      const current = await this.client.state().catch(() => undefined);
      const existing = Array.isArray(current?.seg) ? (current.seg as { id?: unknown }[]) : [];
      for (const s of existing) {
        if (typeof s.id === 'number' && !used.has(s.id)) segs.push({ id: s.id, stop: 0 });
      }
      state.seg = segs;
    }
    await this.client.setState(state);
  }

  async off(): Promise<void> {
    await this.client.setState({ on: false });
  }
}
