<script lang="ts">
  import { api } from '../api';
  import { live } from '../live.svelte';
  import type { Device } from '../types';

  let devices = $state<Device[]>([]);
  let name = $state('');
  let url = $state('');
  let kind = $state<Device['kind']>('wled');
  let tokens = $state<Record<string, string>>({});
  let error = $state('');
  let busy = $state(false);

  api.devices().then((d) => (devices = d));

  const statusOf = (id: string) => live.state?.devices.find((d) => d.id === id);

  async function save(next: Device[]) {
    busy = true;
    error = '';
    try {
      devices = await api.saveDevices(next);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function saveToken(id: string) {
    error = '';
    try {
      await api.saveToken(id, tokens[id] ?? '');
      tokens[id] = '';
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function add(e: SubmitEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const label = name.trim() || url.trim();
    let id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || kind;
    let n = 2;
    const base = id;
    while (devices.some((d) => d.id === id)) id = `${base}-${n++}`;
    save([...devices, { id, name: label, kind, url: url.trim() }]).then(() => {
      name = '';
      url = '';
    });
  }
</script>

<div class="stack">
  <section class="panel">
    <h2>Devices</h2>
    {#each devices as d (d.id)}
      {@const s = statusOf(d.id)}
      <div class="device">
        <span class="dot" class:on={s?.online}></span>
        <div>
          <strong>{d.name}</strong> <span class="muted small">({d.id})</span>
          <div class="muted small">
            {d.url}
            {#if d.kind === 'homeassistant'} · Home Assistant{/if}
            {#if s?.info} · {s.info.name} · {s.info.ledCount} LEDs · WLED {s.info.version} · {s.info.presets.length} presets{/if}
          </div>
          {#if s?.error}<div class="error small">{s.error}</div>{/if}
          {#if d.kind === 'homeassistant'}
            <div class="row" style="margin-top: 0.4rem">
              <input
                type="password"
                autocomplete="off"
                placeholder={s?.hasToken ? 'Token saved. Paste a new one to replace it' : 'Paste a long-lived access token'}
                bind:value={tokens[d.id]}
                style="flex: 1"
              />
              <button disabled={!tokens[d.id]} onclick={() => saveToken(d.id)}>Save token</button>
            </div>
          {/if}
        </div>
        <button class="danger" disabled={busy} onclick={() => save(devices.filter((x) => x.id !== d.id))}>Remove</button>
      </div>
    {:else}
      <p class="muted">None yet.</p>
    {/each}
    <div class="row" style="margin-top: 0.75rem">
      <button disabled={busy} onclick={() => api.refreshDevices()}>Check again</button>
    </div>
  </section>

  <form class="panel" onsubmit={add}>
    <h2>Add a device</h2>
    <div class="row">
      <select bind:value={kind}>
        <option value="wled">WLED controller</option>
        <option value="homeassistant">Home Assistant</option>
      </select>
      <input placeholder={kind === 'wled' ? 'Name, e.g. Table' : 'Name, e.g. House'} bind:value={name} />
      <input
        placeholder={kind === 'wled' ? 'Address, e.g. 192.168.1.50 or wled-table.local' : 'Address, e.g. homeassistant.local:8123'}
        bind:value={url}
        style="flex: 1"
      />
      <button class="primary" disabled={busy || !url.trim()}>Add</button>
    </div>
    {#if kind === 'homeassistant'}
      <p class="muted small">After adding it, paste a long-lived access token (Home Assistant → your profile → Security).</p>
    {/if}
    {#if error}<p class="error small">{error}</p>{/if}
  </form>
</div>

<style>
  .device { display: grid; grid-template-columns: auto 1fr auto; gap: 0.75rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
</style>
