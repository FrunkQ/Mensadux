/**
 * WLED JSON API client for Node. Adapted from Mappadux's Stagecraft
 * wledClient.ts (never tested on hardware there either). Every call
 * has a timeout; failures throw with a readable message so the
 * bindings engine can report them.
 *
 * Endpoints:
 *   GET  /json/info     device identity, firmware, LED count
 *   GET  /json/state    current state (on, bri, segments…)
 *   GET  /presets.json  preset library keyed by id
 *   POST /json/state    apply state, or {ps: id} to recall a preset
 */

const DEFAULT_TIMEOUT_MS = 4000;

export interface WledInfoRaw {
  name: string;
  ver: string;
  leds: { count: number };
}

export type WledState = Record<string, unknown>;

/** Accepts "192.168.1.42", "wled-table.local" or a full URL; returns a base URL with no trailing slash. */
export function normaliseEndpoint(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s;
}

export class WledClient {
  readonly baseUrl: string;

  constructor(
    url: string,
    private timeoutMs = DEFAULT_TIMEOUT_MS,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = normaliseEndpoint(url);
  }

  info(): Promise<WledInfoRaw> {
    return this.request<WledInfoRaw>('GET', '/json/info');
  }

  state(): Promise<WledState> {
    return this.request<WledState>('GET', '/json/state');
  }

  async presets(): Promise<{ id: number; name: string }[]> {
    const raw = await this.request<Record<string, { n?: string }>>('GET', '/presets.json');
    return Object.entries(raw)
      .map(([id, p]) => ({ id: Number(id), name: p?.n ?? '' }))
      // Preset 0 is WLED's internal default slot, and empty objects are unused slots.
      .filter((p) => p.id > 0 && p.name !== '')
      .sort((a, b) => a.id - b.id);
  }

  setState(state: WledState): Promise<unknown> {
    return this.request('POST', '/json/state', state);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = this.baseUrl + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        signal: ctrl.signal,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`WLED ${method} ${url} returned HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`WLED ${method} ${url} timed out after ${this.timeoutMs} ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
