/**
 * Home Assistant REST client. Adapted from Mappadux's Stagecraft
 * haClient.ts (untested there). Mensadux doesn't author HA entities:
 * you build scenes and scripts in Home Assistant, then pick them here.
 *
 * Endpoints:
 *   GET  /api/                          check the URL and token
 *   GET  /api/states                    list entities
 *   POST /api/services/{domain}/{svc}   call a service, e.g. scene.turn_on
 *
 * Auth: a long-lived access token (HA → Profile → Security).
 */

const DEFAULT_TIMEOUT_MS = 4000;

export interface HaEntity {
  entity_id: string;
  name: string;
  domain: string;
}

/** Domains worth offering in the scene editor. Others can still be called by typing the entity id. */
export const PICKABLE_DOMAINS = ['scene', 'script', 'automation', 'light', 'switch', 'media_player', 'cover', 'fan'];

/** The service a plain "run this" means for each domain. */
export function defaultService(entityId: string): string {
  const domain = entityId.split('.', 1)[0];
  if (domain === 'automation') return 'automation.trigger';
  if (domain === 'media_player') return 'media_player.media_play';
  return `${domain}.turn_on`;
}

export class HaClient {
  readonly baseUrl: string;

  constructor(
    url: string,
    private token: string,
    private timeoutMs = DEFAULT_TIMEOUT_MS,
    private fetchImpl: typeof fetch = fetch,
  ) {
    let s = url.trim().replace(/\/+$/, '');
    if (s && !/^https?:\/\//i.test(s)) s = 'http://' + s;
    this.baseUrl = s;
  }

  /** Resolves with HA's message if the URL and token work. */
  async ping(): Promise<string> {
    const r = await this.request<{ message?: string }>('GET', '/api/');
    return r?.message ?? 'API running.';
  }

  async entities(domains: string[] = PICKABLE_DOMAINS): Promise<HaEntity[]> {
    const raw = await this.request<{ entity_id: string; attributes?: { friendly_name?: string } }[]>('GET', '/api/states');
    return raw
      .map((e) => ({
        entity_id: e.entity_id,
        name: e.attributes?.friendly_name ?? e.entity_id,
        domain: e.entity_id.split('.', 1)[0],
      }))
      .filter((e) => domains.includes(e.domain))
      .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
  }

  /** service is "domain.service", e.g. "scene.turn_on". */
  async call(service: string, entityId?: string, data: Record<string, unknown> = {}): Promise<void> {
    const [domain, svc] = service.split('.');
    if (!domain || !svc) throw new Error(`Service should look like "scene.turn_on", got "${service}"`);
    const body = entityId ? { entity_id: entityId, ...data } : data;
    await this.request('POST', `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(svc)}`, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!this.token) throw new Error('No Home Assistant access token set for this device');
    const url = this.baseUrl + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('Home Assistant rejected the access token');
      }
      if (!res.ok) throw new Error(`Home Assistant ${method} ${path} returned HTTP ${res.status}`);
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Home Assistant ${method} ${path} timed out after ${this.timeoutMs} ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
