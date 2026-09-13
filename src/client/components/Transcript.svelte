<script lang="ts">
  import { tick } from 'svelte';
  import type { Snapshot } from '../../shared/contracts';
  import ToolCallView from './ToolCall.svelte';

  type Props = {
    snapshot: Snapshot;
    followLatestRequest: number;
    oninspect: (name: string) => void;
  };

  let { snapshot, followLatestRequest, oninspect }: Props = $props();
  let transcript = $state<HTMLDivElement>();
  let follow = $state(true);
  let previousSessionId = $state<string | null>(null);
  let previousFollowLatestRequest = $state<number | null>(null);

  // A new session starts at the bottom, while reconnects preserve the user's
  // current scroll position. The request token lets the composer restore the
  // existing send/steer behavior after the user has scrolled up.
  $effect(() => {
    const sessionId = snapshot.sessionId;
    // Each runtime cursor can add streamed content without changing session.
    void snapshot.cursor;
    const followRequest = followLatestRequest;
    if (sessionId !== previousSessionId) {
      previousSessionId = sessionId;
      follow = true;
    }
    if (followRequest !== previousFollowLatestRequest) {
      previousFollowLatestRequest = followRequest;
      follow = true;
    }
    if (!follow) return;
    void tick().then(() =>
      transcript?.scrollTo({ top: transcript.scrollHeight }),
    );
  });

  function handleScroll(event: Event) {
    const element = event.currentTarget as HTMLDivElement;
    follow =
      element.scrollHeight - element.scrollTop - element.clientHeight < 100;
  }

  function jumpToLatest() {
    follow = true;
    transcript?.scrollTo({ top: transcript.scrollHeight });
  }
</script>

<div
  class="transcript"
  bind:this={transcript}
  onscroll={handleScroll}
  aria-label="Conversation messages"
>
  {#each snapshot.messages as item (item.id)}
    <article
      class:user-message={item.role === 'user'}
      class:tool-message={item.role === 'toolResult'}
    >
      <div class="author">
        {item.role === 'assistant'
          ? 'π  pi'
          : item.role === 'user'
            ? 'You'
            : item.role === 'toolResult'
              ? 'Tool result'
              : 'System'}
      </div>
      {#if item.thinking}<details class="trace">
          <summary>Thinking</summary>
          <div class="detail message-text">{item.thinking}</div>
        </details>{/if}
      {#if item.text}<div class="message-text">{item.text}</div>{/if}
      {#each item.toolCalls ?? [] as call (call.id)}<ToolCallView
          {call}
          {oninspect}
        />{/each}
      {#if item.error}<p class="notice failure">{item.error}</p>{/if}
    </article>
  {:else}<p class="tiny">
      No messages yet. Send a prompt to start this conversation.
    </p>{/each}
  {#if snapshot.error}<p class="notice failure" role="alert">
      {snapshot.error}
    </p>{/if}
</div>
{#if !follow}<button class="link-button" onclick={jumpToLatest}
    >Jump to latest ↓</button
  >{/if}
