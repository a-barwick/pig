<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api, normalizeSnapshot } from './api';
  import type { Snapshot, SessionInfo, Thinking } from '../shared/contracts';
  import Workbench from './features/workbench/Workbench.svelte';
  import Inspector from './components/Inspector.svelte';
  import ToolCallView from './components/ToolCall.svelte';
  import ExtensionDialog from './components/ExtensionDialog.svelte';
  import './styles.css';

  let snapshot = $state<Snapshot | null>(null);
  let sessions = $state<SessionInfo[]>([]);
  let recent = $state<string[]>([]);
  let projectInput = $state('');
  let text = $state('');
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);
  let staleSession = $state(false);
  let connection = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
  let section = $state<'skills' | 'settings' | null>(null);
  let dirty = $state(false);
  let inspector = $state(true);
  let selectedTool = $state<string | null>(null);
  let transcript = $state<HTMLDivElement>();
  let follow = $state(true);
  let unsubscribe: (() => void) | undefined;
  let connectionGeneration = 0;
  let navigating = false;
  const thinkingLevels: Thinking[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
  let running = $derived(!staleSession && (snapshot?.status === 'running' || snapshot?.status === 'stopping'));
  let disabled = $derived(busy || connection !== 'connected');
  const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
  const shortPath = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path;
  function remember(path: string) {
    recent = [path, ...recent.filter(item => item !== path)].slice(0, 10);
    try { localStorage.setItem('pi.recentProjects', JSON.stringify(recent)); } catch { /* Browser storage is optional. */ }
  }
  async function refreshSessions(path: string) {
    try { const rows = await api.sessions.query({ projectPath: path }); if (snapshot?.projectPath === path) sessions = rows; }
    catch (cause) { error = `Could not load sessions: ${message(cause)}`; }
  }
  function receive(value: Parameters<typeof normalizeSnapshot>[0], allowSwitch = false) {
    const next = normalizeSnapshot(value);
    if (!allowSwitch && snapshot && next.sessionId !== snapshot.sessionId) return;
    if (!allowSwitch && snapshot && next.cursor < snapshot.cursor) return;
    const changedSession = snapshot?.sessionId !== next.sessionId;
    if (allowSwitch && !navigating && snapshot && snapshot.projectPath !== next.projectPath && dirty) {
      error = 'The server switched projects. Your unsaved workbench draft is preserved. Save or discard it before reconnecting.';
      return;
    }
    staleSession = false;
    snapshot = next;
    if (changedSession) { remember(next.projectPath); void refreshSessions(next.projectPath); }
    projectInput = next.projectPath;
    if (follow) void tick().then(() => transcript?.scrollTo({ top: transcript?.scrollHeight }));
  }
  async function connect(preserveError = false) {
    unsubscribe?.();
    const generation = ++connectionGeneration;
    connection = 'connecting';
    staleSession = snapshot !== null;
    try {
      // A server restart rotates the HttpOnly local-access cookie.
      const response = await fetch('/', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Local workspace returned HTTP ${response.status}`);
      if (generation !== connectionGeneration) return;
      const state = await api.state.query();
      if (generation !== connectionGeneration) return;
      if (!preserveError) error = '';
      if (state) receive(state, true);
      if (snapshot) await refreshSessions(snapshot.projectPath);
    } catch (cause) {
      if (generation === connectionGeneration) { connection = 'disconnected'; error = `Could not reconnect: ${message(cause)}`; }
      return;
    }
    if (generation !== connectionGeneration) return;
    let first = true;
    const subscription = api.events.subscribe(undefined, {
      onStarted() { if (generation === connectionGeneration) connection = 'connected'; },
      onConnectionStateChange(state) {
        if (generation !== connectionGeneration) return;
        connection = state.state === 'pending' ? 'connected' : state.state === 'connecting' ? 'connecting' : 'disconnected';
        if (state.state === 'connecting') { first = true; staleSession = snapshot !== null; }
      },
      onData(event) {
        if (generation !== connectionGeneration || navigating) return;
        connection = 'connected';
        if (event.snapshot) {
          const wasRunning = snapshot?.status === 'running' || snapshot?.status === 'stopping';
          // The first snapshot is authoritative after a reconnect, including server restarts.
          receive(event.snapshot, first);
          first = false;
          if (wasRunning && event.snapshot.status === 'idle') void refreshSessions(event.snapshot.projectPath);
        }
        if (event.sessionId === snapshot?.sessionId && event.kind === 'error') error = event.message ?? 'Runtime error';
      },
      onError(cause) { if (generation === connectionGeneration) { connection = 'disconnected'; error = `Connection lost: ${message(cause)}`; } },
      onComplete() { if (generation === connectionGeneration) connection = 'disconnected'; },
    });
    unsubscribe = () => subscription.unsubscribe();
  }
  function canDiscard() {
    return !(dirty || text.trim()) || window.confirm('Discard the unsaved skill/settings draft or unsent message and continue?');
  }
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    busy = true; error = '';
    try { await action(); } catch (cause) { error = message(cause); } finally { busy = false; }
  }
  async function openProject(path: string, sessionPath?: string) {
    if (!path.trim() || !canDiscard()) return;
    await perform(async () => {
      navigating = true;
      try {
        const next = await api.open.mutate({ projectPath: path.trim(), sessionPath });
        receive(next, true); section = null; dirty = false; text = ''; notice = ''; selectedTool = null; follow = true;
        remember(next.projectPath); await refreshSessions(next.projectPath);
      } finally { navigating = false; void connect(true); }
    });
  }
  function showSection(next: 'skills' | 'settings' | null) {
    if (next === section) return;
    if (dirty && !window.confirm('Discard the unsaved workbench draft?')) return;
    dirty = false; section = next;
  }
  async function submit() {
    const active = snapshot; const submitted = text.trim();
    if (!active || !submitted || staleSession || disabled) return;
    await perform(async () => {
      const input = { sessionId: active.sessionId, requestId: crypto.randomUUID(), text: submitted };
      if (running) await api.steer.mutate(input); else await api.send.mutate(input);
      if (text.trim() === submitted) text = '';
      notice = running ? 'Steering message accepted; waiting for runtime progress.' : 'Message accepted; waiting for runtime progress.';
      follow = true;
    });
  }
  function selectThinking(value: string) {
    if (!snapshot || staleSession || disabled) return;
    const sessionId = snapshot.sessionId;
    void perform(async () => receive(await api.select.mutate({ sessionId, thinking: value as Thinking })));
  }
  function selectModel(value: string) {
    const model = snapshot?.models.find(item => `${item.provider}/${item.id}` === value);
    if (!snapshot || !model || staleSession || disabled) return;
    const sessionId = snapshot.sessionId;
    void perform(async () => receive(await api.select.mutate({ sessionId, model: { id: model.id, provider: model.provider } })));
  }
  function inspectTool(name: string) { selectedTool = name; inspector = true; }
  function trial(next: Snapshot) { receive(next, true); notice = 'Fresh skill trial opened. Inspect resource loading evidence in the harness.'; void refreshSessions(next.projectPath); }
  function beforeUnload(event: BeforeUnloadEvent) { if (dirty || text.trim()) { event.preventDefault(); event.returnValue = ''; } }
  onMount(() => {
    try { const stored: unknown = JSON.parse(localStorage.getItem('pi.recentProjects') ?? '[]'); if (Array.isArray(stored)) recent = stored.filter((item): item is string => typeof item === 'string').slice(0, 10); } catch { /* Ignore invalid browser preferences. */ }
    connect();
    return () => { connectionGeneration++; unsubscribe?.(); };
  });
</script>

<svelte:window onbeforeunload={beforeUnload} />
<div class="app">
  <header class="chrome"><div class="brand"><span class="mark" aria-hidden="true">π</span> Austin's pi <span class="tiny">{snapshot ? shortPath(snapshot.projectPath) : 'Personal workspace'}</span></div><div class="inline"><span class="status-dot" class:online={connection === 'connected'}></span><span class="tiny">{connection}</span>{#if connection !== 'connected' || staleSession}<button onclick={() => void connect()}>Reconnect</button>{/if}</div></header>
  {#if error}<div class="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onclick={() => error = ''}>Dismiss</button></div>{/if}
  {#if staleSession}<div class="notice" role="status">This conversation is retained for reference; its active session is not confirmed. Reconnect, then open a project or resume a saved conversation before sending. Your drafts are preserved.</div>{/if}
  <div class="shell">
    <nav class="rail" aria-label="Workspace navigation">
      <button disabled={!snapshot || disabled || running} onclick={() => snapshot && openProject(snapshot.projectPath)}>＋ New conversation</button>
      <span class="eyebrow">PROJECTS</span>
      <form class="project-form" onsubmit={(event) => { event.preventDefault(); void openProject(projectInput); }}><label for="project-path" class="tiny">Local project path</label><input id="project-path" bind:value={projectInput} placeholder="/absolute/project/path" required /><button class="primary" disabled={disabled || running}>Open project</button></form>
      {#each recent as path}<button class="recent" title={path} aria-current={snapshot?.projectPath === path ? 'page' : undefined} disabled={disabled || running} onclick={() => openProject(path)}>{shortPath(path)}<span class="path">{path}</span></button>{/each}
      {#if snapshot}<span class="eyebrow">CONVERSATIONS</span><button class="link-button" disabled={busy} onclick={() => snapshot && refreshSessions(snapshot.projectPath)}>Refresh sessions</button>
        <div class="session-list" role="group" aria-label="Saved conversations">
          {#each sessions as session}<button class="recent" title={`${session.name || 'Untitled conversation'}
${session.path}`} aria-label={session.name || 'Untitled conversation'} aria-pressed={snapshot.sessionFile === session.path} disabled={disabled || running} onclick={() => snapshot && openProject(snapshot.projectPath, session.path)}><span class="session-title">{session.name || 'Untitled conversation'}</span><span class="tiny">{new Date(session.updatedAt).toLocaleString()}</span></button>{:else}<p class="tiny">No saved conversations.</p>{/each}
        </div>
      {/if}
      <span class="eyebrow">CUSTOMIZE</span>
      <button disabled={!snapshot} aria-pressed={section === null} onclick={() => showSection(null)}>Conversation</button>
      <button disabled={!snapshot} aria-pressed={section === 'skills'} onclick={() => showSection('skills')}>Skills {section === 'skills' && dirty ? '•' : ''}</button>
      <button disabled={!snapshot} aria-pressed={section === 'settings'} onclick={() => showSection('settings')}>Settings {section === 'settings' && dirty ? '•' : ''}</button>
      <button disabled={!snapshot} aria-pressed={inspector} onclick={() => { inspector = !inspector; selectedTool = null; }}>Tools & resources</button>
      <p class="tiny rail-end">Local pi configuration remains the source of truth.</p>
    </nav>
    <div class="workspace" class:studio={section !== null} class:inspected={inspector && !section}>
      {#if section && snapshot}<section class="workbench-panel" aria-label="Customization workbench"><div class="panel-heading"><span class="tiny">{dirty ? 'Unsaved draft' : 'Harness workbench'}</span><button onclick={() => showSection(null)}>Close editor</button></div>{#key snapshot.projectPath + section}<Workbench projectPath={snapshot.projectPath} {section} ontrial={trial} ondirty={(value: boolean) => dirty = value} />{/key}</section>{/if}
      <main class="center">
        <div class="page-title"><div><span class="eyebrow">{snapshot ? `${shortPath(snapshot.projectPath)} / CONVERSATION` : 'YOUR PI WORKSPACE'}</span><h1>{snapshot ? 'What are we working on?' : 'Open a project to begin'}</h1></div>{#if snapshot}<span class="chip">{snapshot.status === 'stopping' ? 'Cancellation requested' : snapshot.status}</span>{/if}</div>
        {#if !snapshot}<div class="empty"><span class="mark">π</span><p>Open a local folder to start a real conversation with your configured pi model.</p><p class="tiny">Your saved conversations, tools, and loaded resources will appear here.</p></div>
        {:else}
          <div class="transcript" bind:this={transcript} onscroll={(event) => { const element = event.currentTarget; follow = element.scrollHeight - element.scrollTop - element.clientHeight < 100; }} aria-label="Conversation messages">
            {#each snapshot.messages as item (item.id)}
              <article class:user-message={item.role === 'user'} class:tool-message={item.role === 'toolResult'}>
                <div class="author">{item.role === 'assistant' ? 'π  pi' : item.role === 'user' ? 'You' : item.role === 'toolResult' ? 'Tool result' : 'System'}</div>
                {#if item.thinking}<details class="trace"><summary>Thinking</summary><div class="detail message-text">{item.thinking}</div></details>{/if}
                {#if item.text}<div class="message-text">{item.text}</div>{/if}
                {#each item.toolCalls ?? [] as call (call.id)}<ToolCallView {call} oninspect={inspectTool} />{/each}
                {#if item.error}<p class="notice failure">{item.error}</p>{/if}
              </article>
            {:else}<p class="tiny">No messages yet. Send a prompt to start this conversation.</p>{/each}
            {#if snapshot.error}<p class="notice failure" role="alert">{snapshot.error}</p>{/if}
          </div>
          {#if !follow}<button class="link-button" onclick={() => { follow = true; transcript?.scrollTo({ top: transcript?.scrollHeight }); }}>Jump to latest ↓</button>{/if}
          {#each snapshot.dialogs as dialog (dialog.id)}<ExtensionDialog {dialog} busy={disabled || staleSession} onanswer={(value, cancelled) => perform(async () => { await api.answer.mutate({ dialogId: dialog.id, value, cancelled }); })} />{/each}
          <form class="composer" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
            <textarea aria-label="Message to pi" bind:value={text} placeholder={running ? 'Steer pi while it works…' : 'Ask pi to work in this project…'} onkeydown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); if (!disabled && text.trim()) void submit(); } }}></textarea>
            <div class="composer-foot"><div class="inline model-controls"><label class="tiny">Model<select aria-label="Current model" value={snapshot.model ? `${snapshot.model.provider}/${snapshot.model.id}` : ''} disabled={disabled || staleSession || running} onchange={(event) => selectModel(event.currentTarget.value)}><option value="" disabled>Select model</option>{#each snapshot.models as model}<option value={`${model.provider}/${model.id}`}>{model.name} · {model.provider}</option>{/each}</select></label><label class="tiny">Thinking<select value={snapshot.thinking} disabled={disabled || staleSession || running} onchange={(event) => selectThinking(event.currentTarget.value)}>{#each thinkingLevels as level}<option value={level}>{level}</option>{/each}</select></label></div>
              <div class="inline">{#if running}<button type="button" disabled={disabled || staleSession || snapshot.status === 'stopping'} onclick={() => perform(async () => { if (snapshot) { await api.stop.mutate({ sessionId: snapshot.sessionId }); notice = 'Cancellation requested; waiting for runtime confirmation.'; } })}>Stop</button>{/if}<button class="primary" disabled={disabled || staleSession || !text.trim() || snapshot.status === 'stopping'}>{running ? 'Steer' : 'Send'}</button></div>
            </div><p class="tiny">Current conversation choices · ⌘/Ctrl + Enter to {running ? 'steer' : 'send'}</p>
            {#if notice}<p class="live-note" role="status">{notice}</p>{/if}
          </form>
          {#if section}<button class="link-button" onclick={() => inspector = !inspector}>{inspector ? 'Hide' : 'Show'} harness inspector</button>{/if}
          {#if section && inspector}<aside class="inline-inspector" aria-label="Harness inspector"><Inspector {snapshot} {selectedTool} busy={disabled || staleSession} ontrust={() => { if (!canDiscard()) return; void perform(async () => { if (snapshot) receive(await api.trust.mutate({ projectPath: snapshot.projectPath }), true); }); }} /></aside>{/if}
        {/if}
      </main>
      {#if snapshot && inspector && !section}<aside class="inspector" aria-label="Harness inspector"><Inspector {snapshot} {selectedTool} busy={disabled || staleSession} ontrust={() => { if (!canDiscard()) return; void perform(async () => { if (snapshot) receive(await api.trust.mutate({ projectPath: snapshot.projectPath }), true); }); }} /></aside>{/if}
    </div>
  </div>
  <footer class="footer"><span>{section ? 'Workbench and conversation' : 'Conversation and harness inspector'}</span><span>{connection === 'connected' ? 'Connected to local pi' : 'Waiting for local pi'}{dirty ? ' · Unsaved draft' : ''}</span></footer>
</div>
