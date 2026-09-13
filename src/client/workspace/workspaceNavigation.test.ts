import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceNavigation,
  type WorkspaceNavigationOptions,
} from "./workspaceNavigation.svelte";

function makeNavigation(overrides: Partial<WorkspaceNavigationOptions> = {}) {
  let unsent = false;
  const draft = {
    get hasUnsentMessage() {
      return unsent;
    },
    clear: vi.fn(() => {
      unsent = false;
    }),
  };
  const workspace = {
    openProject: vi.fn(async () => true),
    trust: vi.fn(async () => true),
  };
  const inspector = { reset: vi.fn() };
  const confirm = vi.fn(() => true);
  const navigation = createWorkspaceNavigation({
    workspace,
    draft,
    inspector,
    confirm,
    ...overrides,
  });

  return {
    navigation,
    draft,
    workspace,
    inspector,
    confirm,
    setUnsent(value: boolean) {
      unsent = value;
    },
  };
}

describe("workspace navigation", () => {
  it("combines workbench and conversation drafts for unload and controller guards", () => {
    const state = makeNavigation();
    expect(state.navigation.hasUnsavedWork).toBe(false);

    state.setUnsent(true);
    expect(state.navigation.hasUnsavedWork).toBe(true);

    let prevented = false;
    state.navigation.beforeUnload({
      preventDefault: () => {
        prevented = true;
      },
      returnValue: "",
    } as BeforeUnloadEvent);
    expect(prevented).toBe(true);

    state.navigation.setWorkbenchDirty(true);
    state.setUnsent(false);
    expect(state.navigation.hasUnsavedWork).toBe(true);
  });

  it("guards workbench section changes and clears dirty state after confirmation", () => {
    const state = makeNavigation();
    state.navigation.setWorkbenchDirty(true);
    state.confirm.mockReturnValueOnce(false);

    expect(state.navigation.showSection("skills")).toBe(false);
    expect(state.navigation.section).toBe(null);
    expect(state.navigation.workbenchDirty).toBe(true);
    expect(state.confirm).toHaveBeenCalledWith(
      "Discard the unsaved workbench draft?",
    );

    expect(state.navigation.showSection("skills")).toBe(true);
    expect(state.navigation.section).toBe("skills");
    expect(state.navigation.workbenchDirty).toBe(false);
  });

  it("clears feature state only after an explicit project/session open succeeds", async () => {
    const state = makeNavigation();
    state.navigation.showSection("settings");
    state.navigation.setWorkbenchDirty(true);
    state.setUnsent(true);

    state.workspace.openProject.mockResolvedValueOnce(false);
    expect(await state.navigation.openProject(" /project-two ")).toBe(false);
    expect(state.navigation.section).toBe("settings");
    expect(state.navigation.workbenchDirty).toBe(true);
    expect(state.draft.clear).not.toHaveBeenCalled();
    expect(state.inspector.reset).not.toHaveBeenCalled();

    expect(
      await state.navigation.openProject(" /project-two ", "/session.json"),
    ).toBe(true);
    expect(state.workspace.openProject).toHaveBeenLastCalledWith(
      " /project-two ",
      "/session.json",
    );
    expect(state.navigation.section).toBe(null);
    expect(state.navigation.workbenchDirty).toBe(false);
    expect(state.draft.clear).toHaveBeenCalledOnce();
    expect(state.inspector.reset).toHaveBeenCalledOnce();
  });

  it("guards trust reload with the same combined draft policy and preserves drafts", async () => {
    const state = makeNavigation();
    state.navigation.setWorkbenchDirty(true);
    state.setUnsent(true);
    state.confirm.mockReturnValueOnce(false);

    expect(await state.navigation.trust()).toBe(false);
    expect(state.workspace.trust).not.toHaveBeenCalled();

    expect(await state.navigation.trust()).toBe(true);
    expect(state.workspace.trust).toHaveBeenCalledOnce();
    expect(state.draft.clear).not.toHaveBeenCalled();
    expect(state.navigation.workbenchDirty).toBe(true);
  });
});
