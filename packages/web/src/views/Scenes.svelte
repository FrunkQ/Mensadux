<script lang="ts">
  import { api } from '../api';
  import { live } from '../live.svelte';
  import type { Scene } from '../types';
  import SceneEditor from '../editor/SceneEditor.svelte';

  let scenes = $state<Scene[]>([]);
  let newName = $state('');
  let error = $state('');
  let busy = $state(false);
  let renaming = $state<string | null>(null);
  let renameTo = $state('');
  /** undefined = list view, null = new scene, Scene = editing that scene. */
  let editing = $state<Scene | null | undefined>(undefined);

  async function closeEditor() {
    editing = undefined;
    scenes = await api.scenes();
  }

  function duplicate(s: Scene) {
    run(async () => {
      const copy = await api.saveScene({ ...$state.snapshot(s), id: undefined, name: `${s.name} copy` });
      scenes = [...scenes, copy];
    });
  }

  api.scenes().then((s) => (scenes = s));

  async function run(fn: () => Promise<unknown>) {
    busy = true;
    error = '';
    try {
      await fn();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  function capture(e: SubmitEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const scene = await api.captureScene(name);
      scenes = [...scenes, scene];
      newName = '';
    });
  }

  const save = (next: Scene[]) => run(async () => (scenes = await api.saveScenes(next)));

  function finishRename(id: string) {
    const name = renameTo.trim();
    renaming = null;
    if (name) save(scenes.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function lightsSummary(s: Scene): string {
    const parts = Object.entries(s.lights).map(([dev, t]) =>
      'preset' in t ? `${dev}: preset ${t.preset}` : `${dev}: ${segCount(t.state)} segment(s)`,
    );
    if (s.actions.length) parts.push(`${s.actions.length} other action(s)`);
    return parts.join(' · ');
  }
  const segCount = (state: Record<string, unknown>) => (Array.isArray(state.seg) ? state.seg.length : 0);

  /** A rough colour swatch from the first colour of each captured segment. */
  function swatch(s: Scene): string[] {
    const out: string[] = [];
    for (const t of Object.values(s.lights)) {
      if (!('state' in t) || !Array.isArray(t.state.seg)) continue;
      for (const seg of t.state.seg as { col?: number[][] }[]) {
        const c = seg.col?.[0];
        if (c) out.push(`rgb(${c[0]},${c[1]},${c[2]})`);
      }
    }
    return out.slice(0, 8);
  }
</script>

{#if editing !== undefined}
  <SceneEditor scene={editing} onclose={closeEditor} />
{:else}
<div class="stack">
  <form class="panel" onsubmit={capture}>
    <h2>Capture the current look</h2>
    <p class="muted small">
      Save whatever the lights show right now as a scene, then fine-tune it with Edit. Or
      <button type="button" class="link" onclick={() => (editing = null)}>start an empty scene</button>.
    </p>
    <div class="row">
      <input placeholder="Scene name, e.g. Tavern" bind:value={newName} style="flex: 1" />
      <button class="primary" disabled={busy || !newName.trim()}>Save as scene</button>
      <button type="button" class="danger" disabled={busy} onclick={() => run(() => api.lightsOff())}>All lights off</button>
    </div>
    {#if error}<p class="error small">{error}</p>{/if}
  </form>

  <section class="grid">
    {#each scenes as s (s.id)}
      <article class="panel scene" class:active={live.state?.activeSceneId === s.id}>
        <div class="swatch">
          {#each swatch(s) as c}<span style="background: {c}"></span>{:else}<span></span>{/each}
        </div>
        {#if renaming === s.id}
          <input
            bind:value={renameTo}
            onkeydown={(e) => e.key === 'Enter' && finishRename(s.id)}
            onblur={() => finishRename(s.id)}
          />
        {:else}
          <strong>{s.name}</strong>
        {/if}
        <span class="muted small">{lightsSummary(s)}</span>
        <div class="row">
          <button class="primary" disabled={busy} onclick={() => run(() => api.activateScene(s.id))}>Show</button>
          <button disabled={busy} onclick={() => (editing = s)}>Edit</button>
          <button disabled={busy} onclick={() => duplicate(s)}>Duplicate</button>
          <button disabled={busy} onclick={() => ((renaming = s.id), (renameTo = s.name))}>Rename</button>
          <button class="danger" disabled={busy} onclick={() => save(scenes.filter((x) => x.id !== s.id))}>Delete</button>
        </div>
      </article>
    {:else}
      <p class="muted">No scenes yet.</p>
    {/each}
  </section>
</div>
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
  .scene { display: grid; gap: 0.5rem; }
  .scene.active { border-color: var(--accent); }
  .swatch { display: flex; height: 0.6rem; border-radius: 4px; overflow: hidden; background: var(--panel-2); }
  .swatch span { flex: 1; }
  .link { background: none; border: none; padding: 0; color: var(--accent); text-decoration: underline; }
</style>
