<script lang="ts">
  import type { WorkspaceConnection } from '../workspace/workspaceController.svelte';

  export type WorkspaceSection = 'skills' | 'settings' | null;

  export interface WorkspaceFooterProps {
    section: WorkspaceSection;
    connection: WorkspaceConnection;
    dirty: boolean;
  }

  let { section, connection, dirty }: WorkspaceFooterProps = $props();
</script>

<footer class="footer">
  <span
    >{section
      ? 'Workbench and conversation'
      : 'Conversation and harness inspector'}</span
  >
  <span
    >{connection === 'connected'
      ? 'Connected to local pi'
      : 'Waiting for local pi'}{dirty ? ' · Unsaved draft' : ''}</span
  >
</footer>
