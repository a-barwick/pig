<script lang="ts">
  import type { Snapshot } from '../../shared/contracts';
  import type { WorkspaceConnection } from '../workspace/workspaceController.svelte';

  export interface WorkspaceHeaderProps {
    snapshot: Snapshot | null;
    connection: WorkspaceConnection;
    staleSession: boolean;
    onreconnect: () => void | Promise<void>;
  }

  let {
    snapshot,
    connection,
    staleSession,
    onreconnect,
  }: WorkspaceHeaderProps = $props();

  const shortPath = (path: string) =>
    path.split('/').filter(Boolean).at(-1) ?? path;
</script>

<header class="chrome">
  <div class="brand">
    <span class="mark" aria-hidden="true">π</span>
    Austin's pi
    <span class="tiny"
      >{snapshot ? shortPath(snapshot.projectPath) : 'Personal workspace'}</span
    >
  </div>
  <div class="inline">
    <span class="status-dot" class:online={connection === 'connected'}></span>
    <span class="tiny">{connection}</span>
    {#if connection !== 'connected' || staleSession}
      <button onclick={() => void onreconnect()}>Reconnect</button>
    {/if}
  </div>
</header>
