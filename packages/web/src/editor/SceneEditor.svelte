<script lang="ts">
  import { untrack } from 'svelte';
  import { api } from '../api';
  import { live } from '../live.svelte';
  import type { Action, Binding, Device, DeviceCatalog, LightTarget, Scene } from '../types';
  import WledTargetEditor from './WledTargetEditor.svelte';

  let { scene, onclose }: { scene: Scene | null; onclose: (saved?: Scene) => void } = $props();

  // Work on a copy taken once when the editor opens, so Cancel leaves the saved scene untouched.
  const initial = untrack(() => scene);
  let draft = $state<Scene>(
    initial ? structuredClone($state.snapshot(initial)) : { id: '', name: '', tags: [], lights: {}, actions: [] },
  );
  let tagText = $state(draft.tags.join(', '));
  let devices = $state<Device[]>([]);
  let catalogs = $state<Record<string, DeviceCatalog | null>>({});
  let bindings = $state<Binding[]>([]);
  let livePreview = $state(true);
  let previewed = false;
  let error = $state('');
  let busy = $state(false);
  let recording = $state<number | null>(null);

  const lightDevices = $derived(devices.filter((d) => d.kind === 'wled'));
  const haDevices = $derived(devices.filter((d) => d.kind === 'homeassistant'));
  const sceneBindings = $derived(
    bindings.filter((b) => draft.id && b.do.some((a) => a.type === 'scene.activate' && a.params.scene === draft.id)),
  );

  api.devices().then(async (d) => {
    devices = d;
    for (const dev of d) {
      api.catalog(dev.id).then(
        (c) => (catalogs[dev.id] = c),
        () => (catalogs[dev.id] = null),
      );
    }
  });
  api.bindings().then((b) => (bindings = b));

  const ledCount = (id: string) => live.state?.devices.find((d) => d.id === id)?.info?.ledCount ?? 0;
  const wledCatalog = (id: string) => {
    const c = catalogs[id];
    return c && c.kind === 'wled' ? c : null;
  };
  const haEntities = (id: string) => {
    const c = catalogs[id];
    return c && c.kind === 'homeassistant' ? c.entities : [];
  };

  // ── Live preview: push edits to the device, at most every 150 ms per device.
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  function changed(deviceId: string) {
    if (!livePreview) return;
    clearTimeout(timers[deviceId]);
    timers[deviceId] = setTimeout(() => {
      const target = draft.lights[deviceId];
      if (!target) return;
      previewed = true;
      api.preview(deviceId, $state.snapshot(target) as LightTarget).catch((e) => (error = e.message));
    }, 150);
  }

  async function include(deviceId: string) {
    await recapture(deviceId);
  }

  async function recapture(deviceId: string) {
    error = '';
    try {
      draft.lights[deviceId] = await api.captureDevice(deviceId);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function exclude(deviceId: string) {
    delete draft.lights[deviceId];
  }

  // ── Actions (Home Assistant for now; any action type is kept as-is).
  function addHaAction() {
    const dev = haDevices[0];
    if (!dev) return;
    draft.actions.push({ type: 'ha.call', params: { device: dev.id, entity: haEntities(dev.id)[0]?.entity_id ?? '' } });
  }

  async function testAction(a: Action) {
    error = '';
    await api.runAction($state.snapshot(a) as Action).catch((e) => (error = e.message));
  }

  // ── Hotkeys for this scene, recorded from the table keyboard.
  $effect(() => {
    if (recording === null) return;
    const latest = live.state?.log[0];
    if (!latest || latest.event.ts <= recording || latest.event.type !== 'key.down') return;
    const key = String(latest.event.data.key);
    recording = null;
    addKeyBinding(key);
  });

  async function addKeyBinding(key: string) {
    if (!draft.id) return;
    const next: Binding[] = [
      ...$state.snapshot(bindings),
      {
        name: `${key} → ${draft.name}`,
        enabled: true,
        modes: [],
        when: { type: 'key.down', match: { key } },
        do: [{ type: 'scene.activate', params: { scene: draft.id } }],
      },
    ];
    try {
      bindings = await api.saveBindings(next);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function removeBinding(b: Binding) {
    bindings = await api.saveBindings($state.snapshot(bindings).filter((x) => x.id !== b.id));
  }

  // ── Save / cancel
  async function save() {
    busy = true;
    error = '';
    try {
      draft.tags = tagText.split(',').map((t) => t.trim()).filter(Boolean);
      const body = $state.snapshot(draft) as Scene;
      const saved = await api.saveScene(body.id ? body : { ...body, id: undefined });
      onclose(saved);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function cancel() {
    // Put the table back to the scene that was showing before we previewed.
    const active = live.state?.activeSceneId;
    if (previewed && active) await api.activateScene(active).catch(() => {});
    onclose();
  }
</script>

<div class="stack">
  <section class="panel">
    <div class="row">
      <input class="name" placeholder="Scene name" bind:value={draft.name} />
      <input class="tags" placeholder="Tags, comma separated" bind:value={tagText} />
    </div>
    <div class="row" style="margin-top: 0.6rem">
      <label class="row small"><input type="checkbox" bind:checked={livePreview} /> Live preview on the table</label>
      <span class="spacer"></span>
      <button onclick={cancel} disabled={busy}>Cancel</button>
      <button class="primary" onclick={save} disabled={busy || !draft.name.trim()}>Save scene</button>
    </div>
    {#if error}<p class="error small">{error}</p>{/if}
  </section>

  {#each lightDevices as dev (dev.id)}
    <section class="panel">
      <div class="row head">
        <h2>{dev.name}</h2>
        {#if draft.lights[dev.id]}
          <button class="danger small" onclick={() => exclude(dev.id)}>Leave this device alone</button>
        {/if}
      </div>
      {#if draft.lights[dev.id]}
        <WledTargetEditor
          bind:target={draft.lights[dev.id]}
          catalog={wledCatalog(dev.id)}
          ledCount={ledCount(dev.id)}
          onchange={() => changed(dev.id)}
          onrecapture={() => recapture(dev.id)}
        />
      {:else}
        <p class="muted small">This scene doesn't change {dev.name}.</p>
        <button onclick={() => include(dev.id)}>Include it, starting from what it shows now</button>
      {/if}
    </section>
  {/each}

  <section class="panel">
    <h2>Also do</h2>
    {#each draft.actions as a, i}
      <div class="row action">
        {#if a.type === 'ha.call'}
          <select bind:value={a.params.device}>
            {#each haDevices as d}<option value={d.id}>{d.name}</option>{/each}
          </select>
          <select bind:value={a.params.entity}>
            {#each haEntities(String(a.params.device)) as e}
              <option value={e.entity_id}>{e.domain}: {e.name}</option>
            {/each}
            {#if a.params.entity && !haEntities(String(a.params.device)).some((e) => e.entity_id === a.params.entity)}
              <option value={a.params.entity}>{a.params.entity}</option>
            {/if}
          </select>
          <input placeholder="service (optional), e.g. light.turn_off" bind:value={a.params.service} />
        {:else}
          <code class="small">{a.type} {JSON.stringify(a.params)}</code>
        {/if}
        <button class="small" onclick={() => testAction(a)}>Test</button>
        <button class="danger small" onclick={() => draft.actions.splice(i, 1)}>Remove</button>
      </div>
    {:else}
      <p class="muted small">Nothing else.</p>
    {/each}
    {#if haDevices.length}
      <button class="small" onclick={addHaAction}>Add a Home Assistant action</button>
    {:else}
      <p class="muted small">Add Home Assistant on the Devices tab to trigger its scenes and scripts here.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Hotkeys</h2>
    {#if !draft.id}
      <p class="muted small">Save the scene first, then assign keys to it.</p>
    {:else}
      {#each sceneBindings as b (b.id)}
        <div class="row">
          <span>{b.when.type === 'key.down' ? `Key ${b.when.match.key}` : b.name}</span>
          <button class="danger small" onclick={() => removeBinding(b)}>Remove</button>
        </div>
      {/each}
      <button class="small" onclick={() => (recording = live.state?.log[0]?.event.ts ?? 0)} disabled={recording !== null}>
        {recording !== null ? 'Press a key on the table…' : 'Assign a key'}
      </button>
    {/if}
  </section>
</div>

<style>
  .name { font-size: 1.1rem; font-weight: 600; flex: 1 1 14rem; }
  .tags { flex: 1 1 12rem; }
  .spacer { flex: 1; }
  .head { justify-content: space-between; }
  .head h2 { margin: 0; }
  .action select, .action input { max-width: 18rem; }
  button.small { padding: 0.3rem 0.6rem; }
</style>
