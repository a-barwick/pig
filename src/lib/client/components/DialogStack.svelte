<script lang="ts">
  import type { Dialog } from '../../shared/contracts';
  import ExtensionDialog from './ExtensionDialog.svelte';

  type DialogAnswer = (
    dialogId: string,
    value?: string | boolean,
    cancelled?: boolean,
  ) => void;

  type Props = {
    dialogs: Dialog[];
    busy: boolean;
    onanswer: DialogAnswer;
  };

  let { dialogs, busy, onanswer }: Props = $props();
</script>

{#each dialogs as dialog (dialog.id)}<ExtensionDialog
    {dialog}
    {busy}
    onanswer={(value, cancelled) =>
      onanswer(dialog.id, value, cancelled)}
  />{/each}
