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
  kind: 'wled';
  url: string;
}
export interface Scene {
  id: string;
  name: string;
  tags: string[];
  lights: Record<string, { state: Record<string, unknown> } | { preset: number }>;
}
export interface DeviceStatus extends Device {
  online: boolean;
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
