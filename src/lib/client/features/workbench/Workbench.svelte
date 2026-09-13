<script lang="ts">
  import { createPatch } from 'diff';
  import { untrack } from 'svelte';
  import { api } from '../../api';
  import type { ModelInfo, Scope, SettingsView, SkillFile, Snapshot, Thinking } from '../../../shared/contracts';

  /** Mounted beside conversation. ontrial adopts the fresh runtime snapshot; ondirty guards shell navigation. */
  let { projectPath, section, ontrial, ondirty }: { projectPath: string; section: 'skills'|'settings'; ontrial: (snapshot: Snapshot) => void; ondirty?: (dirty: boolean) => void } = $props();
  let skills = $state<SkillFile[]>([]);
  let selected = $state<SkillFile | null>(null);
  let creating = $state(false);
  let content = $state('');
  let name = $state('');
  let description = $state('');
  let instructions = $state('');
  let scope = $state<Scope>('project');
  let busy = $state(false);
  let error = $state('');
  let status = $state('');
  let reviewed = $state(false);
  let undoTarget = $state<{ path: string; revision: string } | null>(null);
  let prompt = $state('');
  let settings = $state<SettingsView | null>(null);
  let models = $state<ModelInfo[]>([]);
  let defaultModel = $state('');
  let defaultThinking = $state('');
  let overrideModel = $state('');
  let overrideLevel = $state('');
  let loadToken = 0;
  const levels: Thinking[] = ['off','minimal','low','medium','high','xhigh','max'];
  const keyOf = (m: {provider:string;id:string} | undefined) => m ? `${m.provider}/${m.id}` : '';
  const modelSelection = (value: SettingsView) => keyOf(value.model) || (value.defaultProvider !== undefined || value.defaultModel !== undefined ? '__partial__' : '');
  const parseModel = (key: string) => { const split = key.indexOf('/'); return { provider: key.slice(0, split), id: key.slice(split + 1) }; };
  let draft = $derived(creating ? `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n\n${instructions}\n` : content);
  let skillDirty = $derived(creating || !!selected && content !== selected.content);
  let settingsDirty = $derived(!!settings && (defaultModel !== modelSelection(settings) || defaultThinking !== (settings.thinking ?? '') || !!overrideModel && overrideLevel !== (settings.modelThinkingLevels?.[overrideModel] ?? '')));
  let dirty = $derived(section === 'skills' ? skillDirty : settingsDirty);
  let patch = $derived(createPatch(selected?.path ?? `${scope}/skills/${name || 'new-skill'}/SKILL.md`, selected?.content ?? '', draft, 'saved', 'draft'));
  let modelChoices = $derived([...new Set([...models.map(keyOf), keyOf(settings?.model), keyOf(settings?.effectiveModel), ...Object.keys(settings?.effectiveModelThinkingLevels ?? {})].filter(Boolean))]);
  $effect(() => { ondirty?.(dirty); });
  $effect(() => { projectPath; section; untrack(() => { void load(); }); });

  function canDiscard() { return !dirty || window.confirm('Discard your unsaved draft?'); }
  function clearNotice() { error = ''; status = ''; reviewed = false; }
  function adoptSettings(value: SettingsView) {
    settings = value; defaultModel = modelSelection(value); defaultThinking = value.thinking ?? '';
    overrideModel = ''; overrideLevel = '';
  }
  async function load() {
    const token = ++loadToken; const cwd = projectPath; const tab = section;
    busy = true; error = ''; status = ''; undoTarget = null;
    try {
      if (tab === 'skills') {
        const result = await api.skills.query({ projectPath: cwd });
        if (token !== loadToken) return;
        skills = result; selected = null; content = ''; creating = false;
      } else {
        const [value, snapshot] = await Promise.all([api.settings.query({projectPath: cwd, scope}), api.state.query()]);
        if (token !== loadToken) return;
        adoptSettings(value); models = snapshot?.models ?? [];
      }
    } catch (cause) { if (token === loadToken) error = String(cause); }
    finally { if (token === loadToken) busy = false; }
  }
  async function choose(file: SkillFile, discardChecked = false) {
    if (!discardChecked && !canDiscard()) return;
    busy = true; clearNotice();
    try {
      const value = await api.readSkill.query({ projectPath, resourceId: file.resourceId });
      selected = value; scope = value.scope; content = value.content; creating = false;
    } catch (cause) { error = String(cause); } finally { busy = false; }
  }
  function create() {
    if (!canDiscard()) return;
    selected = null; creating = true; scope = 'project'; name = ''; description = ''; instructions = ''; clearNotice();
  }
  async function saveSkill() {
    busy = true; error = '';
    try {
      const result = await api.saveSkill.mutate({projectPath, resourceId: selected?.resourceId, name: creating ? name : selected!.name, scope, expectedRevision: selected?.revision ?? null, content: draft});
      if (!result.ok) { error = result.message; return; }
      undoTarget = {path: result.path, revision: result.revision};
      // The acknowledged bytes remain recoverable even if the following discovery refresh fails.
      selected = { resourceId: result.path, path: result.path, scope, name: creating ? name : selected!.name, description: creating ? description : selected!.description, content: draft, revision: result.revision };
      content = selected.content; creating = false; reviewed = false;
      status = 'Saved to disk. Not applied to the current conversation.';
      skills = await api.skills.query({projectPath});
    } catch (cause) { error = String(cause); } finally { busy = false; }
  }
  async function changeScope(next: Scope) {
    if (!canDiscard()) return;
    busy = true; clearNotice();
    try { const value = await api.settings.query({projectPath, scope: next}); scope = next; adoptSettings(value); undoTarget = null; }
    catch (cause) { error = String(cause); } finally { busy = false; }
  }
  async function saveSettings() {
    if (!settings) return;
    busy = true; error = '';
    try {
      const result = await api.saveSettings.mutate({projectPath, scope, expectedRevision: settings.revision,
        ...(defaultModel !== modelSelection(settings) ? { model: defaultModel ? parseModel(defaultModel) : null } : {}),
        ...(defaultThinking !== (settings.thinking ?? '') ? { thinking: (defaultThinking || null) as Thinking | null } : {}),
        ...(overrideModel && overrideLevel !== (settings.modelThinkingLevels?.[overrideModel] ?? '') ? { modelThinking: { ...parseModel(overrideModel), level: (overrideLevel || null) as Thinking | null } } : {}),
      });
      if (!result.ok) { error = result.message; return; }
      undoTarget = {path: result.path, revision: result.revision}; status = 'Saved to disk. A fresh trusted session uses these defaults; the current session is unchanged.';
      adoptSettings(await api.settings.query({projectPath, scope}));
    } catch (cause) { error = String(cause); } finally { busy = false; }
  }
  async function undo() {
    if (!undoTarget || !canDiscard()) return;
    busy = true; error = '';
    try {
      const result = await api.undo.mutate({projectPath, path: undoTarget.path, expectedRevision: undoTarget.revision});
      if (!result.ok) { error = result.message; return; }
      undoTarget = null; status = 'Last save undone on disk. The running session is unchanged.';
      if (section === 'settings') adoptSettings(await api.settings.query({projectPath, scope}));
      else {
        const files = await api.skills.query({projectPath}); skills = files;
        selected = files.find(file => file.path === result.path) ?? null; content = selected?.content ?? ''; creating = false;
      }
    } catch (cause) { error = String(cause); } finally { busy = false; }
  }
  async function reload() {
    if (!canDiscard()) return;
    if (section === 'skills' && selected) { await choose(selected, true); return; }
    await load();
  }
  async function trial() {
    if (!selected || dirty) return;
    busy = true; error = ''; status = '';
    try {
      const snapshot = await api.trial.mutate({projectPath, resourceId: selected.resourceId, revision: selected.revision, prompt});
      ontrial(snapshot);
      status = snapshot.trial?.loaded ? `Fresh trial invoked ${snapshot.trial.invocation}. Loading is confirmed; instruction-following must be reviewed in the conversation.` : 'Trial returned without confirmed skill loading. Inspect the conversation and trust status.';
    } catch (cause) { error = String(cause); } finally { busy = false; }
  }
</script>

<section class="workbench" aria-label="Harness workbench">
  <header><div><small>HARNESS WORKBENCH</small><h2>{section === 'skills' ? 'Skills' : 'Model & thinking defaults'}</h2></div><span class="badge">{dirty ? 'Unsaved draft' : 'Disk configuration'}</span></header>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if status}<p class="notice" role="status">{status}</p>{/if}
  {#if busy}<p role="status">Working…</p>{/if}
  {#if section === 'skills'}
    <div class="toolbar"><button onclick={create} disabled={busy}>New project skill</button><button onclick={reload} disabled={busy}>Reload saved files</button></div>
    <p class="muted">Editable files discovered on disk. Discovery does not mean pi loaded them; inspect the conversation’s harness for trust and load evidence. Package and glob-only resources are read-only in the runtime inspector.</p>
    <nav aria-label="Skill files">{#each skills as file}<button class:active={selected?.resourceId === file.resourceId} onclick={() => choose(file)} disabled={busy}><strong>{file.name}</strong><small>{file.scope} · {file.path}</small></button>{/each}</nav>
    {#if !skills.length && !busy}<p>No editable skills found. Create a project skill to begin.</p>{/if}
    {#if creating || selected}
      {#if creating}
        <label>Save scope<select bind:value={scope} disabled={busy}><option value="project">Project only</option><option value="global">Global — all projects</option></select></label>
        {#if scope === 'global'}<p class="notice">This deliberately creates a skill in your global pi configuration.</p>{/if}
        <label>Name<input bind:value={name} oninput={() => reviewed = false} placeholder="review-changes" disabled={busy}/></label>
        <label>Description<input bind:value={description} oninput={() => reviewed = false} placeholder="When pi should use this skill" disabled={busy}/></label>
        <label>Instructions<textarea bind:value={instructions} oninput={() => reviewed = false} rows="12" disabled={busy}></textarea></label>
      {:else if selected}
        <h3>{selected.name}</h3><p class="path">{selected.path}</p><small>Saved revision: {selected.revision.slice(0,12)} · {selected.scope}</small>
        {#if selected.scope === 'global'}<p class="notice">Edits affect the global skill used across projects.</p>{/if}
        <label>SKILL.md<textarea bind:value={content} oninput={() => reviewed = false} rows="18" spellcheck="false" disabled={busy}></textarea></label>
      {/if}
      <div class="toolbar"><button onclick={() => reviewed = true} disabled={busy || !skillDirty}>Review actual diff</button><button class="primary" onclick={saveSkill} disabled={busy || !skillDirty || !reviewed}>Save revision</button></div>
      {#if reviewed}<pre class="diff" aria-label="Skill diff">{patch}</pre>{/if}
      {#if selected}<div class="trial"><h3>Try the saved revision</h3><p class="muted">Starts a fresh conversation and explicitly invokes this saved skill. Project trust still applies.</p><label>Trial prompt<textarea bind:value={prompt} rows="3" placeholder="What should pi do with this skill?" disabled={busy}></textarea></label><button onclick={trial} disabled={busy || dirty || !prompt.trim()}>Start fresh trial</button></div>{/if}
    {/if}
  {:else}
    <label>Settings scope<select value={scope} onchange={(event) => void changeScope(event.currentTarget.value as Scope)} disabled={busy}><option value="project">Project overrides</option><option value="global">Global defaults — all projects</option></select></label>
    {#if settings}
      <p class="path">{settings.path}</p>
      <p class="notice">Configured startup: {keyOf(settings.effectiveModel) || 'pi model selection fallback'} · {settings.effectiveThinking} thinking. Source: {settings.source}.</p>
      <p class="muted">Project settings apply only when pi trusts the project. A running session can have temporary choices. Pi may clamp thinking to the model’s supported levels.</p>
      <label>Default model<select bind:value={defaultModel} disabled={busy}>{#if modelSelection(settings) === '__partial__'}<option value="__partial__">Keep partial override</option>{/if}<option value="">{scope === 'project' ? 'Use my default' : 'Use pi model selection fallback'}</option>{#each modelChoices as key}<option value={key}>{key}</option>{/each}</select></label>
      {#if modelSelection(settings) === '__partial__'}<p class="muted">This scope sets {settings.defaultProvider !== undefined ? `provider ${settings.defaultProvider}` : `model ${settings.defaultModel}`}; {settings.defaultProvider === undefined ? 'provider' : 'model'} is inherited. Choose {scope === 'project' ? 'Use my default' : 'Use pi model selection fallback'} to remove this partial override.</p>{/if}
      <label>Default thinking<select bind:value={defaultThinking} disabled={busy}><option value="">{scope === 'project' ? 'Use my default' : 'Use pi default (medium)'}</option>{#each levels as level}<option value={level}>{level}</option>{/each}</select></label>
      <p class="muted">Per-model overrides take precedence over default thinking, including an inherited global per-model override.</p>
      <fieldset><legend>Per-model thinking override</legend>
        {#each Object.entries(settings.effectiveModelThinkingLevels ?? {}) as [key, level]}<p class="override">{key}: <strong>{level}</strong> <small>({Object.hasOwn(settings.modelThinkingLevels ?? {}, key) ? scope : 'global'})</small></p>{/each}
        <label>Model<select value={overrideModel} onchange={(event) => { if (overrideModel && overrideLevel !== (settings?.modelThinkingLevels?.[overrideModel] ?? '') && !window.confirm('Discard the unsaved per-model override?')) { event.currentTarget.value = overrideModel; return; } overrideModel = event.currentTarget.value; overrideLevel = settings?.modelThinkingLevels?.[overrideModel] ?? ''; }} disabled={busy}><option value="">Choose a model</option>{#each modelChoices as key}<option value={key}>{key}</option>{/each}</select></label>
        {#if overrideModel}<label>Thinking for this model<select bind:value={overrideLevel} disabled={busy}><option value="">{scope === 'project' ? 'Use inherited override / default' : 'Use default thinking'}</option>{#each levels as level}<option value={level}>{level}</option>{/each}</select></label>{/if}
      </fieldset>
      <div class="toolbar"><button class="primary" onclick={saveSettings} disabled={busy || !settingsDirty}>Save scoped settings</button><button onclick={reload} disabled={busy}>Reload saved settings</button></div>
    {/if}
  {/if}
  {#if undoTarget}<button onclick={undo} disabled={busy}>Undo last save</button>{/if}
</section>

<style>
  .workbench{padding:22px;min-width:0;height:100%;overflow:auto;background:#f8f7f3;color:#222c28;font:14px/1.5 system-ui,sans-serif;box-sizing:border-box}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}h2{font-size:20px;margin:4px 0}h3{font-size:16px;margin-bottom:8px}small,.muted{color:#637168}header small{font-size:10px;letter-spacing:.12em}.badge{border:1px solid #cdd7d0;border-radius:20px;padding:3px 8px;font-size:11px;white-space:nowrap}label{display:grid;gap:5px;margin:14px 0;font-weight:600}input,select,textarea{font:inherit;min-width:0;width:100%;box-sizing:border-box;padding:9px;border:1px solid #bdc9c0;border-radius:6px;background:white;color:#222c28}textarea{font-family:ui-monospace,monospace;resize:vertical;font-size:13px}button{font:inherit;padding:7px 11px;border-radius:6px;border:1px solid #bdc9c0;background:white;color:#244a37;cursor:pointer}button:disabled{opacity:.5;cursor:default}button.primary{background:#2e6248;color:white;border-color:#2e6248}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}nav{display:flex;flex-direction:column;gap:5px;max-height:210px;overflow:auto}nav button{text-align:left}nav small{display:block;overflow-wrap:anywhere}nav .active{background:#e4efe7;border-color:#60866b}.error,.notice{padding:10px 12px;border-radius:6px;overflow-wrap:anywhere}.error{color:#8c2828;background:#fae5e5}.notice{background:#e9efe9}.path{font:11px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}.diff{overflow:auto;padding:14px;background:#202923;color:#e5eee6;font:12px/1.5 ui-monospace,monospace;max-height:400px}.trial{border-top:1px solid #d4ddd6;margin-top:22px;padding-top:8px}fieldset{border:1px solid #cdd7d0;border-radius:6px;margin:20px 0;padding:12px;min-width:0}.override{overflow-wrap:anywhere;font-size:12px}@media(max-width:600px){.workbench{padding:14px}header{align-items:flex-start;flex-direction:column}}
</style>
