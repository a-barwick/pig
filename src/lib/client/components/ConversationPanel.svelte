<script lang="ts">
  import type { Snapshot, Thinking } from '../../shared/contracts';
  import type { ConversationDraft } from '../features/conversation/conversationDraft.svelte';
  import InspectorPane from './InspectorPane.svelte';
  import Composer from './Composer.svelte';
  import DialogStack from './DialogStack.svelte';
  import Transcript from './Transcript.svelte';

  type Section = 'skills' | 'settings' | null;

  type DialogAnswer = (
    dialogId: string,
    value?: string | boolean,
    cancelled?: boolean,
  ) => void;

  type ConversationActions = {
    stop: () => void | Promise<unknown>;
    selectModel: (value: string) => void | Promise<unknown>;
    selectThinking: (value: Thinking) => void | Promise<unknown>;
    answerDialog: DialogAnswer;
    trust: () => void | Promise<unknown>;
  };

  type ConversationInspector = {
    visible: boolean;
    selectedTool: string | null;
    select: (name: string) => void;
    toggle: () => void;
    reset: () => void;
  };

  type Props = {
    snapshot: Snapshot | null;
    draft: ConversationDraft;
    disabled: boolean;
    staleSession: boolean;
    running: boolean;
    notice: string;
    section: Section;
    actions: ConversationActions;
    inspector: ConversationInspector;
  };

  let {
    snapshot,
    draft,
    disabled,
    staleSession,
    running,
    notice,
    section,
    actions,
    inspector,
  }: Props = $props();

  // The token keeps follow state inside Transcript while preserving the
  // existing behavior that a successful send/steer follows new output.
  let followLatestRequest = $state(0);

  async function submit() {
    if (await draft.submit()) followLatestRequest += 1;
  }

  // TODO(refactor): Keep the inline inspector here provisionally; revisit its
  // component boundary after the workspace shell and inspector migration land.
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
      oninspect={inspector.select}
    />
    <DialogStack
      dialogs={snapshot.dialogs}
      busy={disabled || staleSession}
      onanswer={actions.answerDialog}
    />
    <Composer
      {snapshot}
      bind:text={draft.text}
      {disabled}
      {staleSession}
      {running}
      {notice}
      onsubmit={submit}
      onstop={actions.stop}
      onselectmodel={actions.selectModel}
      onselectthinking={actions.selectThinking}
    />
    {#if section}<button class="link-button" onclick={inspector.toggle}
        >{inspector.visible ? 'Hide' : 'Show'} harness inspector</button
      >{/if}
    {#if section && inspector.visible}<aside
        class="inline-inspector"
        aria-label="Harness inspector"
      >
        <InspectorPane
          {snapshot}
          selectedTool={inspector.selectedTool}
          busy={disabled || staleSession}
          ontrust={actions.trust}
        />
      </aside>{/if}
  {/if}
</main>
