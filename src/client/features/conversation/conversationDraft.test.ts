import { describe, expect, it, vi } from 'vitest';
import { createConversationDraft } from './conversationDraft.svelte';

describe('conversation draft', () => {
  it('tracks unsent text and submits the trimmed message', async () => {
    const submit = vi.fn(async () => true);
    const draft = createConversationDraft(submit);

    draft.text = '  hello pi  ';
    expect(draft.hasUnsentMessage).toBe(true);

    await expect(draft.submit()).resolves.toBe(true);
    expect(submit).toHaveBeenCalledWith('hello pi');
    expect(draft.text).toBe('');
    expect(draft.hasUnsentMessage).toBe(false);
  });

  it('does not submit whitespace-only text', async () => {
    const submit = vi.fn(async () => true);
    const draft = createConversationDraft(submit);

    draft.text = ' \n\t ';
    await expect(draft.submit()).resolves.toBe(false);

    expect(submit).not.toHaveBeenCalled();
    expect(draft.text).toBe(' \n\t ');
    expect(draft.hasUnsentMessage).toBe(false);
  });

  it('preserves an edit made while an accepted submission is pending', async () => {
    let resolveSubmit!: (accepted: boolean) => void;
    const submit = vi.fn(
      () => new Promise<boolean>((resolve) => (resolveSubmit = resolve)),
    );
    const draft = createConversationDraft(submit);

    draft.text = 'first message';
    const pending = draft.submit();
    draft.text = 'second message';
    resolveSubmit(true);

    await expect(pending).resolves.toBe(true);
    expect(draft.text).toBe('second message');
    expect(draft.hasUnsentMessage).toBe(true);
  });

  it('keeps rejected submissions in the draft', async () => {
    const submit = vi.fn(async () => false);
    const draft = createConversationDraft(submit);

    draft.text = 'try again';
    await expect(draft.submit()).resolves.toBe(false);

    expect(draft.text).toBe('try again');
  });
});
