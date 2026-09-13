<script lang="ts">
  import type { Snapshot } from '../../shared/contracts';
  import Inspector from './Inspector.svelte';

  export interface InspectorPaneProps {
    snapshot: Snapshot;
    selectedTool: string | null;
    busy: boolean;
    ontrust: () => void;
  }

  let { snapshot, selectedTool, busy, ontrust }: InspectorPaneProps = $props();
</script>

<!--
  TODO(refactor): This wrapper is a migration seam. Revisit its final home
  after dogfooding rather than baking the inspector's layout into this feature.
-->
<Inspector {snapshot} {selectedTool} {busy} {ontrust} />
