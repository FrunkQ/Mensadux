import type { LightTarget } from './schema.js';

export interface LightInfo {
  name: string;
  version: string;
  ledCount: number;
  presets: { id: number; name: string }[];
}

/** Names the editor needs to show a device's options. Index = id used in state. */
export interface LightCatalog {
  effects: string[];
  palettes: string[];
}

/** Anything that can show a scene: WLED today, other controllers later. */
export interface LightDriver {
  readonly deviceId: string;
  describe(): Promise<LightInfo>;
  catalog(): Promise<LightCatalog>;
  /** Snapshot of what the device shows now, suitable for saving in a scene. */
  capture(): Promise<LightTarget>;
  apply(target: LightTarget): Promise<void>;
  off(): Promise<void>;
}
