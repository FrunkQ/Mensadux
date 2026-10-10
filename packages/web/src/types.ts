// Mirrors @tabledux/core types the UI needs. Kept local so the browser bundle doesn't pull in zod.
export interface TableEvent {
  type: string;
  source: string;
  data: Record<string, unknown>;
  ts: number;
}
export interface Action {
  type: string;
  params: Record<string, unknown>;
}
export interface Binding {
  id?: string;
  name: string;
  enabled: boolean;
  modes: string[];
  when: { type: string; match: Record<string, unknown> };
  do: Action[];
}
export interface Device {
  id: string;
  name: string;
  kind: 'wled' | 'homeassistant';
  url: string;
}
export interface Scene {
  id: string;
  name: string;
  tags: string[];
  lights: Record<string, LightTarget>;
  actions: Action[];
}
export type LightTarget = { state: WledState } | { preset: number };
export interface WledSegment {
  id: number;
  start?: number;
  stop?: number;
  on?: boolean;
  bri?: number;
  col?: number[][];
  fx?: number;
  sx?: number;
  ix?: number;
  pal?: number;
  [key: string]: unknown;
}
export interface WledState {
  on?: boolean;
  bri?: number;
  seg?: WledSegment[];
  [key: string]: unknown;
}
export type DeviceCatalog =
  | { kind: 'wled'; effects: string[]; palettes: string[]; presets: { id: number; name: string }[] }
  | { kind: 'homeassistant'; entities: { entity_id: string; name: string; domain: string }[] };
export interface DeviceStatus extends Device {
  online: boolean;
  hasToken?: boolean;
  error?: string;
  info?: { name: string; version: string; ledCount: number; presets: { id: number; name: string }[] };
}
export interface ActionResult {
  bindingId: string;
  action: Action;
  ok: boolean;
  error?: string;
}
export interface TableSnapshot {
  mode: string;
  activeSceneId: string | null;
  devices: DeviceStatus[];
  log: { event: TableEvent; results: ActionResult[] }[];
  actionTypes: string[];
}
