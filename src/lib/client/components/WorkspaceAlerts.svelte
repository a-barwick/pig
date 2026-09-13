<script lang="ts">
  export interface WorkspaceAlertsProps {
    error: string;
    staleSession: boolean;
    onclearerror: () => void;
  }

  let { error, staleSession, onclearerror }: WorkspaceAlertsProps = $props();
</script>

{#if error}
  <div class="error-banner" role="alert">
    <span>{error}</span>
    <button aria-label="Dismiss error" onclick={onclearerror}>Dismiss</button>
  </div>
{/if}
{#if staleSession}
  <div class="notice" role="status">
    This conversation is retained for reference; its active session is not confirmed.
    Reconnect, then open a project or resume a saved conversation before sending.
    Your drafts are preserved.
  </div>
{/if}
