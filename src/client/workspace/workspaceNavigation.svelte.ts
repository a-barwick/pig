import type { ConversationDraft } from "../features/conversation/conversationDraft.svelte";
import type { InspectorState } from "./inspectorState.svelte";
import type { WorkspaceController } from "./workspaceController.svelte";

export type WorkspaceSection = "skills" | "settings" | null;

export interface WorkspaceNavigationOptions {
  workspace: Pick<WorkspaceController, "openProject" | "trust">;
  draft: Pick<ConversationDraft, "hasUnsentMessage" | "clear">;
  inspector?: Pick<InspectorState, "reset">;
  /** Injectable for focused tests; the browser confirm dialog is the default. */
  confirm?: (message: string) => boolean;
}

export interface WorkspaceNavigation {
  readonly section: WorkspaceSection;
  readonly workbenchDirty: boolean;
  readonly hasUnsavedWork: boolean;

  setWorkbenchDirty(value: boolean): void;
  showSection(next: WorkspaceSection): boolean;
  openProject(path: string, sessionPath?: string): Promise<boolean>;
  trust(): Promise<boolean>;
  beforeUnload(event: BeforeUnloadEvent): void;
}

const UNSAVED_NAVIGATION_MESSAGE =
  "Discard the unsaved skill/settings draft or unsent message and continue?";
const UNSAVED_WORKBENCH_MESSAGE = "Discard the unsaved workbench draft?";

function browserConfirm(message: string): boolean {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

/**
 * Coordinates navigation that can discard feature-local drafts.
 *
 * Runtime state remains in the workspace controller; this factory owns only
 * the shell's section and discard policy. The controller can call
 * `hasUnsavedWork` while handling an unsolicited replacement so a reconnect
 * cannot silently move a protected draft to another session.
 */
export function createWorkspaceNavigation(
  options: WorkspaceNavigationOptions,
): WorkspaceNavigation {
  let section = $state<WorkspaceSection>(null);
  let workbenchDirty = $state(false);
  const confirmDiscard = options.confirm ?? browserConfirm;

  const hasUnsavedWork = $derived(
    workbenchDirty || options.draft.hasUnsentMessage,
  );

  function canDiscardAll(): boolean {
    return !hasUnsavedWork || confirmDiscard(UNSAVED_NAVIGATION_MESSAGE);
  }

  function canDiscardWorkbench(): boolean {
    return !workbenchDirty || confirmDiscard(UNSAVED_WORKBENCH_MESSAGE);
  }

  function setWorkbenchDirty(value: boolean): void {
    workbenchDirty = value;
  }

  function showSection(next: WorkspaceSection): boolean {
    if (next === section) return true;
    if (!canDiscardWorkbench()) return false;

    section = next;
    workbenchDirty = false;
    return true;
  }

  async function openProject(
    path: string,
    sessionPath?: string,
  ): Promise<boolean> {
    if (!path.trim() || !canDiscardAll()) return false;

    const opened = await options.workspace.openProject(path, sessionPath);
    if (!opened) return false;

    // TODO(refactor): This is a provisional cross-feature reset boundary;
    // revisit its placement after dogfooding clarifies the shell ownership.
    section = null;
    workbenchDirty = false;
    options.draft.clear();
    options.inspector?.reset();
    return true;
  }

  async function trust(): Promise<boolean> {
    if (!canDiscardAll()) return false;

    // Trust reloads the current project/session. Keep both drafts intact after
    // the explicit confirmation, matching the current App behavior.
    return options.workspace.trust();
  }

  function beforeUnload(event: BeforeUnloadEvent): void {
    if (!hasUnsavedWork) return;
    event.preventDefault();
    event.returnValue = "";
  }

  return {
    get section() {
      return section;
    },
    get workbenchDirty() {
      return workbenchDirty;
    },
    get hasUnsavedWork() {
      return hasUnsavedWork;
    },
    setWorkbenchDirty,
    showSection,
    openProject,
    trust,
    beforeUnload,
  };
}
