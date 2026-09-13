<script lang="ts">
  import type { Snapshot, Thinking } from '../../shared/contracts';
  import type { ConversationDraft } from '../features/conversation/conversationDraft.svelte';
  import type { InspectorState } from '../workspace/inspectorState.svelte';
  import type { WorkspaceController } from '../workspace/workspaceController.svelte';
  import type { WorkspaceNavigation } from '../workspace/workspaceNavigation.svelte';
  import ConversationPanel from './ConversationPanel.svelte';
  import InspectorPane from './InspectorPane.svelte';
  import ProjectRail from './ProjectRail.svelte';
  import WorkbenchPane from '../features/workbench/WorkbenchPane.svelte';
  import WorkspaceAlerts from './WorkspaceAlerts.svelte';
  import WorkspaceFooter from './WorkspaceFooter.svelte';
  import WorkspaceHeader from './WorkspaceHeader.svelte';

  let {
    workspace,
    navigation,
    draft,
    inspector,
  }: {
    workspace: WorkspaceController;
    navigation: WorkspaceNavigation;
    draft: ConversationDraft;
    inspector: InspectorState;
  } = $props();

  let snapshot = $derived(workspace.snapshot);
  let section = $derived(navigation.section);

  const conversationActions = {
    stop: () => workspace.stop(),
    selectModel: (value: string) => workspace.selectModel(value),
    selectThinking: (value: Thinking) => workspace.selectThinking(value),
    answerDialog: (dialogId: string, value?: string | boolean, cancelled?: boolean) =>
      workspace.answerDialog(dialogId, value, cancelled),
    trust: () => navigation.trust(),
  };

  // TODO(refactor): This is the composition seam after moving behavior out of
  // App. Revisit which feature owns each cross-panel connection after dogfooding.
</script>

<div class="app">
  <WorkspaceHeader
    {snapshot}
    connection={workspace.connection}
    staleSession={workspace.staleSession}
    onreconnect={() => workspace.connect()}
  />
  <WorkspaceAlerts
    error={workspace.error}
    staleSession={workspace.staleSession}
    onclearerror={() => workspace.clearError()}
  />

  <div class="shell">
    <ProjectRail
      {snapshot}
      sessions={workspace.sessions}
      recent={workspace.recent}
      disabled={workspace.disabled}
      running={workspace.running}
      busy={workspace.busy}
      {section}
      dirty={navigation.workbenchDirty}
      inspector={inspector.visible}
      onopenproject={async (path, sessionPath) => {
        await navigation.openProject(path, sessionPath);
      }}
      onrefreshsessions={(path) => workspace.refreshSessions(path)}
      onshowsection={(next) => navigation.showSection(next)}
      ontoggleinspector={() => inspector.toggle(true)}
    />

    <div class="workspace" class:studio={section !== null} class:inspected={inspector.visible && !section}>
      {#if section && snapshot}
        <WorkbenchPane
          projectPath={snapshot.projectPath}
          {section}
          dirty={navigation.workbenchDirty}
          ontrial={(next: Snapshot) => workspace.adoptTrial(next)}
          ondirty={(value: boolean) => navigation.setWorkbenchDirty(value)}
          onclose={() => navigation.showSection(null)}
        />
      {/if}

      <ConversationPanel
        {snapshot}
        {draft}
        disabled={workspace.disabled}
        staleSession={workspace.staleSession}
        running={workspace.running}
        notice={workspace.notice}
        {section}
        actions={conversationActions}
        {inspector}
      />

      {#if snapshot && inspector.visible && !section}
        <aside class="inspector" aria-label="Harness inspector">
          <InspectorPane
            {snapshot}
            selectedTool={inspector.selectedTool}
            busy={workspace.disabled || workspace.staleSession}
            ontrust={() => void navigation.trust()}
          />
        </aside>
      {/if}
    </div>
  </div>

  <WorkspaceFooter
    {section}
    connection={workspace.connection}
    dirty={navigation.workbenchDirty}
  />
</div>
