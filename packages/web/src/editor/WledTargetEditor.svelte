<script lang="ts">
  import type { DeviceCatalog, LightTarget, WledSegment } from '../types';
  import { fromHex, toHex } from './colour';

  type WledCatalog = Extract<DeviceCatalog, { kind: 'wled' }>;

  let {
    target = $bindable(),
    catalog,
    ledCount,
    onchange,
    onrecapture,
  }: {
    target: LightTarget;
    catalog: WledCatalog | null;
    ledCount: number;
    onchange: () => void;
    onrecapture: () => void;
  } = $props();

  const usePreset = () => {
    target = { preset: catalog?.presets[0]?.id ?? 1 };
    onchange();
  };
  const useLook = () => onrecapture();

  function addSegment() {
    if (!('state' in target)) return;
    const segs = target.state.seg ?? [];
    const id = segs.reduce((m, s) => Math.max(m, s.id), -1) + 1;
    const lastStop = segs.reduce((m, s) => Math.max(m, s.stop ?? 0), 0);
    const start = lastStop < ledCount ? lastStop : 0;
    segs.push({ id, start, stop: Math.min(start + 20, ledCount || start + 20), on: true, bri: 255, col: [[255, 255, 255], [0, 0, 0], [0, 0, 0]], fx: 0, sx: 128, ix: 128, pal: 0 });
    target.state.seg = segs;
    onchange();
  }

  function removeSegment(seg: WledSegment) {
    if (!('state' in target)) return;
    target.state.seg = (target.state.seg ?? []).filter((s) => s !== seg);
    onchange();
  }

  function setColour(seg: WledSegment, slot: number, hex: string) {
    const col = seg.col ? [...seg.col] : [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    col[slot] = fromHex(hex, col[slot]);
    seg.col = col;
    onchange();
  }
</script>

<div class="mode row">
  <label><input type="radio" checked={'state' in target} onchange={useLook} /> Custom look</label>
  <label><input type="radio" checked={'preset' in target} onchange={usePreset} /> WLED preset</label>
</div>

{#if 'preset' in target}
  <div class="row">
    <select bind:value={target.preset} onchange={onchange}>
      {#each catalog?.presets ?? [] as p}<option value={p.id}>{p.id}: {p.name}</option>{/each}
      {#if !catalog?.presets.some((p) => 'preset' in target && p.id === target.preset)}
        <option value={target.preset}>{target.preset}</option>
      {/if}
    </select>
    <span class="muted small">Presets are made in WLED's own app.</span>
  </div>
{:else}
  <div class="row">
    <label class="row small"><input type="checkbox" bind:checked={target.state.on} onchange={onchange} /> On</label>
    <label class="slider small">
      Brightness
      <input type="range" min="0" max="255" bind:value={target.state.bri} oninput={onchange} />
    </label>
    <button class="small" onclick={onrecapture}>Copy from device</button>
  </div>

  {#each target.state.seg ?? [] as seg (seg.id)}
    <div class="segment">
      <div class="row">
        <strong class="small">Segment {seg.id}</strong>
        <label class="row small"><input type="checkbox" bind:checked={seg.on} onchange={onchange} /> On</label>
        <label class="small">LEDs
          <input type="number" min="0" max={ledCount || undefined} bind:value={seg.start} onchange={onchange} class="num" />
          to
          <input type="number" min="0" max={ledCount || undefined} bind:value={seg.stop} onchange={onchange} class="num" />
        </label>
        <span class="colours">
          {#each [0, 1, 2] as slot}
            <input
              type="color"
              title={['Main colour', 'Second colour', 'Third colour'][slot]}
              value={toHex(seg.col?.[slot])}
              oninput={(e) => setColour(seg, slot, e.currentTarget.value)}
            />
          {/each}
        </span>
        <button class="danger small" onclick={() => removeSegment(seg)}>Remove</button>
      </div>
      <div class="row">
        <label class="small">Effect
          <select bind:value={seg.fx} onchange={onchange}>
            {#each catalog?.effects ?? [] as name, i}{#if name && name !== 'RSVD' && name !== '-'}<option value={i}>{name}</option>{/if}{/each}
            {#if !catalog}<option value={seg.fx}>#{seg.fx}</option>{/if}
          </select>
        </label>
        <label class="small">Palette
          <select bind:value={seg.pal} onchange={onchange}>
            {#each catalog?.palettes ?? [] as name, i}<option value={i}>{name}</option>{/each}
            {#if !catalog}<option value={seg.pal}>#{seg.pal}</option>{/if}
          </select>
        </label>
        <label class="slider small">Speed <input type="range" min="0" max="255" bind:value={seg.sx} oninput={onchange} /></label>
        <label class="slider small">Intensity <input type="range" min="0" max="255" bind:value={seg.ix} oninput={onchange} /></label>
        <label class="slider small">Brightness <input type="range" min="0" max="255" bind:value={seg.bri} oninput={onchange} /></label>
      </div>
    </div>
  {/each}
  <button class="small" onclick={addSegment}>Add segment</button>
{/if}

<style>
  .mode { margin-bottom: 0.5rem; }
  .segment { border: 1px solid var(--line); border-radius: 8px; padding: 0.6rem; display: grid; gap: 0.5rem; margin: 0.5rem 0; }
  .num { width: 5rem; }
  .slider { display: inline-flex; align-items: center; gap: 0.4rem; }
  .slider input { width: 7rem; padding: 0; }
  .colours { display: inline-flex; gap: 0.25rem; }
  input[type='color'] { width: 2.25rem; height: 2rem; padding: 0.1rem; }
  button.small { padding: 0.3rem 0.6rem; }
</style>
