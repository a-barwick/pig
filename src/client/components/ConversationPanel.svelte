<script lang="ts">
  import type { Snapshot, Thinking } from '../../shared/contracts';
  import Inspector from './Inspector.svelte';
  import Composer from './Composer.svelte';
  import DialogStack from './DialogStack.svelte';
  import Transcript from './Transcript.svelte';

  type Section = 'skills' | 'settings' | null;

  type DialogAnswer = (
    dialogId: string,
    value?: string | boolean,
    cancelled?: boolean,
  ) => void;

  type Props = {
    snapshot: Snapshot | null;
    text?: string;
    disabled: boolean;
    staleSession: boolean;
    running: boolean;
    notice: string;
    section: Section;
    inspector: boolean;
    selectedTool: string | null;
    onsubmit: () => Promise<boolean>;
    onstop: () => void;
    onselectmodel: (value: string) => void;
    onselectthinking: (value: Thinking) => void;
    onanswer: DialogAnswer;
    oninspect: (name: string) => void;
    ontrust: () => void;
    ontoggleinspector: () => void;
  };

  let {
    snapshot,
    text = $bindable(''),
    disabled,
    staleSession,
    running,
    notice,
    section,
    inspector,
    selectedTool,
    onsubmit,
    onstop,
    onselectmodel,
    onselectthinking,
    onanswer,
    oninspect,
    ontrust,
    ontoggleinspector,
  }: Props = $props();

  // The token keeps follow state inside Transcript while preserving the
  // existing behavior that a successful send/steer follows new output.
  let followLatestRequest = $state(0);

  async function submit() {
    if (await onsubmit()) followLatestRequest += 1;
  }
</script>

<main class="center">
  <div class="page-title">
    <div>
      <span class="eyebrow"
        >{snapshot
          ? `${snapshot.projectPath.split('/').filter(Boolean).at(-1) ?? snapshot.projectPath} / CONVERSATION`
          : 'YOUR PI WORKSPACE'}</span
      >
      <h1>{snapshot ? 'What are we working on?' : 'Open a project to begin'}</h1>
    </div>
    {#if snapshot}<span class="chip"
        >{snapshot.status === 'stopping'
          ? 'Cancellation requested'
          : snapshot.status}</span
      >{/if}
  </div>
  {#if !snapshot}<div class="empty">
      <span class="mark">π</span>
      <p>
        Open a local folder to start a real conversation with your configured pi
        model.
      </p>
      <p class="tiny">
        Your saved conversations, tools, and loaded resources will appear here.
      </p>
    </div>
  {:else}
    <Transcript
      {snapshot}
      {followLatestRequest}
      {oninspect}
    />
    <DialogStack
      dialogs={snapshot.dialogs}
      busy={disabled || staleSession}
      {onanswer}
    />
    <Composer
      {snapshot}
      bind:text
      {disabled}
      {staleSession}
      {running}
      {notice}
      onsubmit={submit}
      {onstop}
      {onselectmodel}
      {onselectthinking}
    />
    {#if section}<button class="link-button" onclick={ontoggleinspector}
        >{inspector ? 'Hide' : 'Show'} harness inspector</button
      >{/if}
    {#if section && inspector}<aside
        class="inline-inspector"
        aria-label="Harness inspector"
      >
        <Inspector
          {snapshot}
          {selectedTool}
          busy={disabled || staleSession}
          ontrust={ontrust}
        />
      </aside>{/if}
  {/if}
</main>
