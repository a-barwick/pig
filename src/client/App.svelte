<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snapshot } from '../shared/contracts';
  import { createWorkspaceController } from './workspace/workspaceController.svelte';
  import ProjectRail from './components/ProjectRail.svelte';
  import ConversationPanel from './components/ConversationPanel.svelte';
  import Inspector from './components/Inspector.svelte';
  import Workbench from './features/workbench/Workbench.svelte';
  import './styles.css';

  type Section = 'skills' | 'settings' | null;

  // Only state shared across workspace sections stays in the parent.
  let text = $state('');
  let section = $state<Section>(null);
  let dirty = $state(false);
  let inspector = $state(true);
  let selectedTool = $state<string | null>(null);

  const workspace = createWorkspaceController({
    hasUnsavedWorkbenchDraft: () => dirty,
  });
  let snapshot = $derived(workspace.snapshot);
  let sessions = $derived(workspace.sessions);
  let recent = $derived(workspace.recent);
  let error = $derived(workspace.error);
  let notice = $derived(workspace.notice);
  let busy = $derived(workspace.busy);
  let staleSession = $derived(workspace.staleSession);
  let connection = $derived(workspace.connection);
  let running = $derived(workspace.running);
  let disabled = $derived(workspace.disabled);

  const shortPath = (path: string) =>
    path.split('/').filter(Boolean).at(-1) ?? path;

  function canDiscard() {
    return (
      !(dirty || text.trim()) ||
      window.confirm(
        'Discard the unsaved skill/settings draft or unsent message and continue?',
      )
    );
  }

  async function openProject(path: string, sessionPath?: string) {
    if (!path.trim() || !canDiscard()) return;
    if (!(await workspace.openProject(path, sessionPath))) return;
    section = null;
    dirty = false;
    text = '';
    selectedTool = null;
  }

  function showSection(next: Section) {
    if (next === section) return;
    if (dirty && !window.confirm('Discard the unsaved workbench draft?'))
      return;
    dirty = false;
    section = next;
  }

  async function submit(): Promise<boolean> {
    const submitted = text.trim();
    if (!submitted) return false;
    const accepted = await workspace.submit(submitted);
    if (accepted && text.trim() === submitted) text = '';
    return accepted;
  }

  function inspectTool(name: string) {
    selectedTool = name;
    inspector = true;
  }

  function trust() {
    if (!canDiscard()) return;
    void workspace.trust();
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty || text.trim()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  onMount(() => {
    void workspace.connect();
    return () => workspace.dispose();
  });
</script>

<svelte:window onbeforeunload={beforeUnload} />
<div class="app">
  <header class="chrome">
    <div class="brand">
      <span class="mark" aria-hidden="true">π</span>
      Austin's pi
      <span class="tiny">{snapshot ? shortPath(snapshot.projectPath) : 'Personal workspace'}</span>
    </div>
    <div class="inline">
      <span class="status-dot" class:online={connection === 'connected'}></span>
      <span class="tiny">{connection}</span>
      {#if connection !== 'connected' || staleSession}
        <button onclick={() => void workspace.connect()}>Reconnect</button>
      {/if}
    </div>
  </header>

  {#if error}
    <div class="error-banner" role="alert">
      <span>{error}</span>
      <button aria-label="Dismiss error" onclick={() => workspace.clearError()}>Dismiss</button>
    </div>
  {/if}
  {#if staleSession}
    <div class="notice" role="status">
      This conversation is retained for reference; its active session is not confirmed.
      Reconnect, then open a project or resume a saved conversation before sending.
      Your drafts are preserved.
    </div>
  {/if}

  <div class="shell">
    <ProjectRail
      {snapshot}
      {sessions}
      {recent}
      {disabled}
      {running}
      {busy}
      {section}
      {dirty}
      {inspector}
      onopenproject={openProject}
      onrefreshsessions={(path) => workspace.refreshSessions(path)}
      onshowsection={showSection}
      ontoggleinspector={() => {
        inspector = !inspector;
        selectedTool = null;
      }}
    />

    <div class="workspace" class:studio={section !== null} class:inspected={inspector && !section}>
      {#if section && snapshot}
        <section class="workbench-panel" aria-label="Customization workbench">
          <div class="panel-heading">
            <span class="tiny">{dirty ? 'Unsaved draft' : 'Harness workbench'}</span>
            <button onclick={() => showSection(null)}>Close editor</button>
          </div>
          {#key snapshot.projectPath + section}
            <Workbench
              projectPath={snapshot.projectPath}
              {section}
              ontrial={(next: Snapshot) => workspace.adoptTrial(next)}
              ondirty={(value: boolean) => (dirty = value)}
            />
          {/key}
        </section>
      {/if}

      <ConversationPanel
        {snapshot}
        bind:text
        {disabled}
        {staleSession}
        {running}
        {notice}
        {section}
        {inspector}
        {selectedTool}
        onsubmit={submit}
        onstop={() => { void workspace.stop(); }}
        onselectmodel={(value) => { void workspace.selectModel(value); }}
        onselectthinking={(value) => { void workspace.selectThinking(value); }}
        onanswer={(dialogId, value, cancelled) => {
          void workspace.answerDialog(dialogId, value, cancelled);
        }}
        oninspect={inspectTool}
        ontrust={trust}
        ontoggleinspector={() => (inspector = !inspector)}
      />

      {#if snapshot && inspector && !section}
        <aside class="inspector" aria-label="Harness inspector">
          <Inspector
            {snapshot}
            {selectedTool}
            busy={disabled || staleSession}
            ontrust={trust}
          />
        </aside>
      {/if}
    </div>
  </div>

  <footer class="footer">
    <span>{section ? 'Workbench and conversation' : 'Conversation and harness inspector'}</span>
    <span>{connection === 'connected' ? 'Connected to local pi' : 'Waiting for local pi'}{dirty ? ' · Unsaved draft' : ''}</span>
  </footer>
</div>
