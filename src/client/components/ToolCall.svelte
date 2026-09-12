<script lang="ts">
  import { toolEvidence } from './toolEvidence';
  import type { ToolCall } from '../../shared/contracts';
  let { call, oninspect }: { call: ToolCall; oninspect: (name: string) => void } = $props();
  const pretty = (value: unknown) => value === undefined ? 'Unavailable (not supplied by runtime).' : JSON.stringify(value, null, 2);
  let args = $derived(call.args && typeof call.args === 'object' ? call.args as Record<string, unknown> : {});
  let evidence = $derived(toolEvidence(call));
</script>
<details class="trace">
  <summary><strong>{call.name}</strong> <span class:failure={call.status === 'failed'} class="chip">{call.status === 'unknown' ? 'Outcome unavailable' : call.status}</span> <span class="tiny">{call.endedAt ? `${((call.endedAt - call.startedAt) / 1000).toFixed(1)}s` : call.status === 'running' ? 'In progress' : 'Duration unavailable'}</span></summary>
  <div class="detail">
    <button class="link-button" onclick={() => oninspect(call.name)}>Inspect tool definition →</button>
    <p class="path">Call {call.id}</p>
    {#if typeof args.command === 'string'}<h4>Command</h4><pre>{args.command}</pre>{/if}
    {#if typeof args.path === 'string'}<h4>Path</h4><p class="path">{args.path}</p>{/if}
    {#if evidence.exitCode !== undefined}<p>Exit status (structured result): {String(evidence.exitCode)}</p>
    {:else if evidence.textStatus}<h4>Exit status reported in result text</h4><pre>{evidence.textStatus}</pre>
    {:else if call.name === 'bash'}<p class="tiny">Exit status unavailable (not supplied by runtime).</p>{/if}
    {#if evidence.diff !== undefined}<h4>Diff</h4><pre>{evidence.diff}</pre>{/if}
    <h4>Actual arguments</h4><pre>{pretty(call.args)}</pre>
    <h4>{call.status === 'running' ? 'Output so far' : 'Result / error'}</h4>
    {#if call.outputNote}<p class="notice">{call.outputNote}</p>{/if}
    <pre>{pretty(call.result)}</pre>
  </div>
</details>
