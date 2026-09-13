import { describe, expect, it } from 'vitest';
import { createInspectorState } from './inspectorState.svelte';

describe('inspector state', () => {
  it('keeps visibility while clearing the selected tool on navigation', () => {
    const inspector = createInspectorState();
    inspector.select('read');
    inspector.toggle();
    inspector.reset();

    expect(inspector.visible).toBe(false);
    expect(inspector.selectedTool).toBe(null);
  });
});
