<script lang="ts">
  import { untrack } from 'svelte';
  import type { Dialog } from '../../shared/contracts';
  let { dialog, onanswer, busy }: { dialog: Dialog; onanswer: (value?: string | boolean, cancelled?: boolean) => void; busy: boolean } = $props();
  let value = $state(untrack(() => dialog.initialValue ?? ''));
</script>
<section class="extension-dialog" aria-label="Extension request">
  <span class="eyebrow">EXTENSION REQUEST</span><h3>{dialog.title}</h3>
  {#if dialog.message}<p class="message-text">{dialog.message}</p>{/if}
  {#if dialog.kind === 'select'}
    <div class="actions">{#each dialog.options ?? [] as option}<button disabled={busy} onclick={() => onanswer(option)}>{option}</button>{/each}</div>
  {:else if dialog.kind === 'confirm'}
    <div class="actions"><button class="primary" disabled={busy} onclick={() => onanswer(true)}>Confirm</button><button disabled={busy} onclick={() => onanswer(false)}>No</button></div>
  {:else if dialog.kind === 'input' || dialog.kind === 'editor'}
    <label class="field">Response<textarea bind:value rows={dialog.kind === 'editor' ? 8 : 2}></textarea></label>
    <button class="primary" disabled={busy} onclick={() => onanswer(value)}>Submit response</button>
  {:else}<p>This extension requested a dialog the browser cannot display. Cancel to release the request.</p>{/if}
  <button class="link-button" disabled={busy} onclick={() => onanswer(undefined, true)}>Cancel request</button>
</section>
