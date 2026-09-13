/**
 * Draft state for one conversation panel.
 *
 * The factory keeps the draft instance scoped to its App rather than sharing
 * message text through a module singleton. That lets each mounted workspace
 * retain its own unsent message and keeps submission policy next to the draft
 * that it mutates.
 */
export interface ConversationDraft {
  text: string;
  readonly hasUnsentMessage: boolean;
  clear(): void;
  submit(): Promise<boolean>;
}

export type SubmitConversation = (text: string) => Promise<boolean>;

class ConversationDraftState implements ConversationDraft {
  text = $state('');
  #submitConversation: SubmitConversation;

  constructor(submitConversation: SubmitConversation) {
    this.#submitConversation = submitConversation;
  }

  get hasUnsentMessage() {
    return this.text.trim().length > 0;
  }

  clear = () => {
    this.text = '';
  };

  submit = async () => {
    const original = this.text;
    const submitted = original.trim();
    if (!submitted) return false;

    const accepted = await this.#submitConversation(submitted);
    // Preserve edits made while the request was in flight. The raw value is
    // compared so even a deliberate whitespace edit is not lost.
    if (accepted && this.text === original) this.text = '';
    return accepted;
  };
}

export function createConversationDraft(
  submitConversation: SubmitConversation,
): ConversationDraft {
  return new ConversationDraftState(submitConversation);
}
