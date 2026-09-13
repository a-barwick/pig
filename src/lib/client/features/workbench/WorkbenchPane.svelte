<script lang="ts">
  import type { Snapshot } from '../../../shared/contracts';
  import Workbench from './Workbench.svelte';

  export type WorkbenchSection = 'skills' | 'settings';

  export interface WorkbenchPaneProps {
    projectPath: string;
    section: WorkbenchSection;
    dirty: boolean;
    ontrial: (snapshot: Snapshot) => void;
    ondirty: (dirty: boolean) => void;
    onclose: () => void;
  }

  let {
    projectPath,
    section,
    dirty,
    ontrial,
    ondirty,
    onclose,
  }: WorkbenchPaneProps = $props();
</script>

<!--
  TODO(refactor): This wrapper is a migration seam. Revisit its final home
  after dogfooding clarifies whether the shell or workbench should own it.
-->
<section class="workbench-panel" aria-label="Customization workbench">
  <div class="panel-heading">
    <span class="tiny">{dirty ? 'Unsaved draft' : 'Harness workbench'}</span>
    <button onclick={onclose}>Close editor</button>
  </div>
  {#key `${projectPath}:${section}`}
    <Workbench {projectPath} {section} {ontrial} {ondirty} />
  {/key}
</section>
