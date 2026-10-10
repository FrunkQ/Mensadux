<script lang="ts">
  import { live } from '../live.svelte';

  const time = (ts: number) => new Date(ts).toLocaleTimeString();
  const summary = (data: Record<string, unknown>) =>
    Object.entries(data).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
</script>

<div class="stack">
  <section class="panel">
    <h2>Devices</h2>
    {#if !live.state?.devices.length}
      <p class="muted">No devices yet. Add your WLED controller on the Devices tab.</p>
    {:else}
      {#each live.state.devices as d}
        <div class="row">
          <span class="dot" class:on={d.online}></span>
          <strong>{d.name || d.id}</strong>
          <span class="muted small">{d.url}</span>
          {#if d.info}<span class="muted small">{d.info.ledCount} LEDs · WLED {d.info.version}</span>{/if}
          {#if d.error}<span class="error small">{d.error}</span>{/if}
        </div>
      {/each}
    {/if}
  </section>

  <section class="panel">
    <h2>Recent events</h2>
    <p class="muted small">Every key press, card, button or API call shows here with what it triggered. Handy for building bindings.</p>
    {#if !live.state?.log.length}
      <p class="muted">Nothing yet. Press a key on the table keyboard.</p>
    {:else}
      <ul class="log">
        {#each live.state.log as entry}
          <li>
            <span class="muted small">{time(entry.event.ts)}</span>
            <code>{entry.event.type}</code>
            <span class="small">{summary(entry.event.data)}</span>
            <span class="muted small">from {entry.event.source}</span>
            {#each entry.results as r}
              <span class="small" class:error={!r.ok}>→ {r.action.type}{r.ok ? '' : `: ${r.error}`}</span>
            {/each}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
  .log li { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: baseline; }
  code { color: var(--accent); }
</style>
