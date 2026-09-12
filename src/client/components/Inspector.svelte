<script lang="ts">
  import { tick } from 'svelte';
  import type { Snapshot } from '../../shared/contracts';
  let { snapshot, selectedTool, ontrust, busy }: { snapshot: Snapshot; selectedTool: string | null; ontrust: () => void; busy: boolean } = $props();
  $effect(() => {
    const name = selectedTool;
    if (name) void tick().then(() => document.getElementById(`tool-${encodeURIComponent(name)}`)?.scrollIntoView({ block: 'nearest' }));
  });
</script>
<section class="small-section">
  <h3>This conversation</h3><span class="tiny">Project</span><p class="path">{snapshot.projectPath}</p>
  <span class="tiny">Session</span><p class="path">{snapshot.sessionFile ?? snapshot.sessionId}</p>
  <p>{snapshot.model?.name ?? 'No model selected'} · {snapshot.thinking} thinking</p>
</section>
<section class="small-section">
  <h3>Project trust</h3><span class="chip">{snapshot.trust.trusted ? 'Trusted' : 'Not trusted'}</span>
  <p>{snapshot.trust.reason}</p>
  {#if !snapshot.trust.trusted}<button class="primary" disabled={busy || snapshot.status === 'running' || snapshot.status === 'stopping'} onclick={ontrust}>Trust this folder & reload</button>{/if}
  <p class="tiny">Trust controls project resource loading. It does not sandbox file access or tool execution.</p>
</section>
{#if snapshot.trial}<section class="small-section"><h3>Skill trial evidence</h3><p class="path">{snapshot.trial.path}</p><p class="path">Revision {snapshot.trial.revision}</p><pre>{snapshot.trial.invocation}</pre><p>{snapshot.trial.loaded ? 'Runtime reports this resource loaded.' : 'Resource not loaded.'} Loading does not establish instruction-following.</p></section>{/if}
<section class="small-section">
  <h3>Tools & extensions <span class="tiny">{snapshot.tools.length} tools</span></h3>
  <p class="tiny">Availability is separate from project trust and permissions.</p>
  {#each snapshot.tools as tool (tool.name)}
    <details class="trace" id={`tool-${encodeURIComponent(tool.name)}`} open={selectedTool === tool.name}>
      <summary>{tool.name} <span class="tiny">{tool.active ? 'Active' : 'Inactive'}</span></summary>
      <div class="detail"><p>{tool.description}</p><p class="tiny">Source: {tool.source || 'Unknown'}</p>{#if tool.path}<p class="path">{tool.path}</p>{/if}<h4>Input schema</h4><pre>{tool.parameters === undefined ? 'Input schema unavailable.' : JSON.stringify(tool.parameters, null, 2)}</pre></div>
    </details>
  {:else}<p class="tiny">The runtime reports no tools.</p>{/each}
  {#if selectedTool && !snapshot.tools.some(tool => tool.name === selectedTool)}<p class="notice">Definition unavailable for {selectedTool} in the current runtime inventory.</p>{/if}
</section>
<section class="small-section"><h3>Resources & provenance</h3>
  {#each snapshot.resources as resource}
    <div class="resource"><strong>{resource.name}</strong> <span class="chip">{resource.loaded ? 'Loaded' : 'Not loaded'}</span><div class="tiny">{resource.kind} · {resource.source || 'Source unknown'}</div><p class="path">{resource.path}</p>{#if resource.reason}<p>{resource.reason}</p>{/if}</div>
  {:else}<p class="tiny">No resources reported by the runtime.</p>{/each}
</section>
