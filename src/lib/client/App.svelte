<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Snapshot } from '../shared/contracts';
  import { createConversationDraft } from './features/conversation/conversationDraft.svelte';
  import { createInspectorState } from './workspace/inspectorState.svelte';
  import { createWorkspaceController } from './workspace/workspaceController.svelte';
  import { createWorkspaceNavigation, type WorkspaceNavigation } from './workspace/workspaceNavigation.svelte';
  import WorkspaceLayout from './components/WorkspaceLayout.svelte';
  import './styles.css';

  let { initialSnapshot = null }: { initialSnapshot: Snapshot | null } = $props();

  const inspector = createInspectorState();
  // Keep the controller's guard available while the navigation factory is
  // being created; it is also used when reconnecting around unsaved drafts.
  const navigationRef: { current?: WorkspaceNavigation } = {};
  const workspace = createWorkspaceController({
    initialSnapshot: untrack(() => initialSnapshot),
    hasUnsavedWork: () => navigationRef.current?.hasUnsavedWork ?? false,
  });
  const draft = createConversationDraft((text) => workspace.submit(text));
  const navigation = createWorkspaceNavigation({ workspace, draft, inspector });
  navigationRef.current = navigation;

  // TODO(refactor): This composition root is the migration landing point.
  // Revisit the ownership of these cross-feature connections after dogfooding.
  onMount(() => {
    void workspace.connect();
    return () => workspace.dispose();
  });
</script>

<svelte:window onbeforeunload={navigation.beforeUnload} />
<WorkspaceLayout {workspace} {navigation} {draft} {inspector} />
