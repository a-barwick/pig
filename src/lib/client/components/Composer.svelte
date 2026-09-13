<script lang="ts">
  import type { Snapshot, Thinking } from '../../shared/contracts';

  const thinkingLevels: Thinking[] = [
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max',
  ];

  type Props = {
    snapshot: Snapshot;
    text?: string;
    disabled: boolean;
    staleSession: boolean;
    running: boolean;
    notice: string;
    onsubmit: () => void | Promise<void>;
    onstop: () => void;
    onselectmodel: (value: string) => void;
    onselectthinking: (value: Thinking) => void;
  };

  let {
    snapshot,
    text = $bindable(''),
    disabled,
    staleSession,
    running,
    notice,
    onsubmit,
    onstop,
    onselectmodel,
    onselectthinking,
  }: Props = $props();

  async function submit() {
    await onsubmit();
  }

  function selectModel(event: Event) {
    onselectmodel((event.currentTarget as HTMLSelectElement).value);
  }

  function selectThinking(event: Event) {
    onselectthinking(
      (event.currentTarget as HTMLSelectElement).value as Thinking,
    );
  }
</script>

<form
  class="composer"
  onsubmit={(event) => {
    event.preventDefault();
    void submit();
  }}
>
  <textarea
    aria-label="Message to pi"
    bind:value={text}
    placeholder={running
      ? 'Steer pi while it works…'
      : 'Ask pi to work in this project…'}
    onkeydown={(event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!disabled && text.trim()) void submit();
      }
    }}
  ></textarea>
  <div class="composer-foot">
    <div class="inline model-controls">
      <label class="tiny"
        >Model<select
          aria-label="Current model"
          value={snapshot.model
            ? `${snapshot.model.provider}/${snapshot.model.id}`
            : ''}
          disabled={disabled || staleSession || running}
          onchange={selectModel}
          ><option value="" disabled>Select model</option
          >{#each snapshot.models as model}<option
              value={`${model.provider}/${model.id}`}
              >{model.name} · {model.provider}</option
            >{/each}</select
        ></label
      ><label class="tiny"
        >Thinking<select
          value={snapshot.thinking}
          disabled={disabled || staleSession || running}
          onchange={selectThinking}
          >{#each thinkingLevels as level}<option value={level}
              >{level}</option
            >{/each}</select
        ></label
      >
    </div>
    <div class="inline">
      {#if running}<button
          type="button"
          disabled={disabled || staleSession || snapshot.status === 'stopping'}
          onclick={onstop}>Stop</button
        >{/if}<button
        class="primary"
        disabled={disabled || staleSession || !text.trim() || snapshot.status === 'stopping'}
        >{running ? 'Steer' : 'Send'}</button
      >
    </div>
  </div>
  <p class="tiny">
    Current conversation choices · ⌘/Ctrl + Enter to {running ? 'steer' : 'send'}
  </p>
  {#if notice}<p class="live-note" role="status">{notice}</p>{/if}
</form>
