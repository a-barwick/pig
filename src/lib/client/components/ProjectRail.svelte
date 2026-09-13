<script lang="ts">
  import { onMount } from 'svelte';
  import type { SessionInfo, Snapshot } from '../../shared/contracts';

  export type WorkspaceSection = 'skills' | 'settings' | null;

  export interface ProjectRailProps {
    snapshot: Snapshot | null;
    sessions: SessionInfo[];
    recent: string[];
    disabled: boolean;
    running: boolean;
    busy: boolean;
    section: WorkspaceSection;
    dirty: boolean;
    inspector: boolean;
    onopenproject: (
      projectPath: string,
      sessionPath?: string,
    ) => void | Promise<void>;
    onrefreshsessions: (projectPath: string) => void | Promise<void>;
    onshowsection: (section: WorkspaceSection) => void;
    ontoggleinspector: () => void;
  }

  let {
    snapshot,
    sessions,
    recent,
    disabled,
    running,
    busy,
    section,
    dirty,
    inspector,
    onopenproject,
    onrefreshsessions,
    onshowsection,
    ontoggleinspector,
  }: ProjectRailProps = $props();

  let projectInput = $state('');
  let syncedProjectPath: string | null | undefined;
  // Keep the server-rendered label stable for hydration, then opt into the
  // browser's familiar local representation once the DOM is mounted.
  let hydrated = $state(false);

  onMount(() => {
    hydrated = true;
  });

  // Keep an in-progress path entry intact while snapshots stream for the same project.
  $effect(() => {
    const activeProjectPath = snapshot?.projectPath ?? null;
    if (activeProjectPath === syncedProjectPath) return;
    syncedProjectPath = activeProjectPath;
    projectInput = activeProjectPath ?? '';
  });

  const shortPath = (path: string) =>
    path.split('/').filter(Boolean).at(-1) ?? path;

  function openProject(path: string, sessionPath?: string) {
    void onopenproject(path, sessionPath);
  }
</script>

<nav class="rail" aria-label="Workspace navigation">
  <button
    disabled={!snapshot || disabled || running}
    onclick={() => snapshot && openProject(snapshot.projectPath)}
    >＋ New conversation</button
  >
  <span class="eyebrow">PROJECTS</span>
  <form
    class="project-form"
    onsubmit={(event) => {
      event.preventDefault();
      openProject(projectInput);
    }}
  >
    <label for="project-path" class="tiny">Local project path</label><input
      id="project-path"
      bind:value={projectInput}
      placeholder="/absolute/project/path"
      required
    /><button class="primary" disabled={disabled || running}
      >Open project</button
    >
  </form>
  {#each recent as path (path)}
    <button
      class="recent"
      title={path}
      aria-current={snapshot?.projectPath === path ? 'page' : undefined}
      disabled={disabled || running}
      onclick={() => openProject(path)}
      >{shortPath(path)}<span class="path">{path}</span></button
    >
  {/each}
  {#if snapshot}
    <span class="eyebrow">CONVERSATIONS</span>
    <button
      class="link-button"
      disabled={busy}
      onclick={() => onrefreshsessions(snapshot.projectPath)}
      >Refresh sessions</button
    >
    <div class="session-list" role="group" aria-label="Saved conversations">
      {#each sessions as session (session.path)}
        <button
          class="recent"
          title={`${session.name || 'Untitled conversation'}
${session.path}`}
          aria-label={session.name || 'Untitled conversation'}
          aria-pressed={snapshot.sessionFile === session.path}
          disabled={disabled || running}
          onclick={() => openProject(snapshot.projectPath, session.path)}
          ><span class="session-title"
            >{session.name || 'Untitled conversation'}</span
          ><span class="tiny"
            ><time datetime={session.updatedAt}
              >{hydrated
                ? new Date(session.updatedAt).toLocaleString()
                : session.updatedAt}</time
            ></span
          ></button
        >
      {:else}
        <p class="tiny">No saved conversations.</p>
      {/each}
    </div>
  {/if}
  <span class="eyebrow">CUSTOMIZE</span>
  <button
    disabled={!snapshot}
    aria-pressed={section === null}
    onclick={() => onshowsection(null)}>Conversation</button
  >
  <button
    disabled={!snapshot}
    aria-pressed={section === 'skills'}
    onclick={() => onshowsection('skills')}
    >Skills {section === 'skills' && dirty ? '•' : ''}</button
  >
  <button
    disabled={!snapshot}
    aria-pressed={section === 'settings'}
    onclick={() => onshowsection('settings')}
    >Settings {section === 'settings' && dirty ? '•' : ''}</button
  >
  <button
    disabled={!snapshot}
    aria-pressed={inspector}
    onclick={ontoggleinspector}>Tools & resources</button
  >
  <p class="tiny rail-end">
    Local pi configuration remains the source of truth.
  </p>
</nav>
