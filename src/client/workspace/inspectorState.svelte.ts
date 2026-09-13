export interface InspectorState {
  readonly visible: boolean;
  readonly selectedTool: string | null;
  toggle(clearSelection?: boolean): void;
  select(name: string | null): void;
  reset(): void;
}

/**
 * Owns the small amount of UI state shared by the rail, conversation, and
 * inspector. The workspace root still decides when this state is created and
 * reset; this module only keeps the inspector interactions together.
 */
export function createInspectorState(initialVisible = true): InspectorState {
  let visible = $state(initialVisible);
  let selectedTool = $state<string | null>(null);

  return {
    get visible() {
      return visible;
    },
    get selectedTool() {
      return selectedTool;
    },
    toggle(clearSelection = false) {
      visible = !visible;
      if (clearSelection) selectedTool = null;
    },
    select(name) {
      selectedTool = name;
      if (name) visible = true;
    },
    reset() {
      // A project switch clears the selection but preserves the user's
      // current inspector visibility preference.
      selectedTool = null;
    },
  };
}

// TODO(refactor): Revisit this state boundary after dogfooding; inspector state
// may belong with the workspace shell once the interaction patterns settle.
