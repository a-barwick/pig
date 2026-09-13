import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeEvent, Snapshot } from '../../shared/contracts';
import { createWorkspaceController } from './workspaceController.svelte';

const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  sessions: vi.fn(),
  send: vi.fn(),
  steer: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../api', () => ({
  normalizeSnapshot: (value: Snapshot) => value,
  api: {
    state: { query: mocks.state },
    sessions: { query: mocks.sessions },
    send: { mutate: mocks.send },
    steer: { mutate: mocks.steer },
    events: { subscribe: mocks.subscribe },
  },
}));

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    sessionId: 'session-one',
    projectPath: '/project-one',
    status: 'idle',
    messages: [],
    tools: [],
    resources: [],
    thinking: 'medium',
    models: [],
    dialogs: [],
    cursor: 1,
    trust: { trusted: true, reason: 'test' },
    ...overrides,
  };
}

type EventHandlers = {
  onStarted: () => void;
  onData: (event: RuntimeEvent) => void;
};

let handlers: EventHandlers;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  mocks.state.mockResolvedValue(snapshot());
  mocks.sessions.mockResolvedValue([]);
  mocks.send.mockResolvedValue({ accepted: true });
  mocks.steer.mockResolvedValue({ accepted: true });
  mocks.subscribe.mockImplementation((_input: unknown, callbacks: EventHandlers) => {
    handlers = callbacks;
    callbacks.onStarted();
    return { unsubscribe: mocks.unsubscribe };
  });
});

describe('workspace controller', () => {
  it('routes accepted messages to send or steer using live session status', async () => {
    const workspace = createWorkspaceController();
    await workspace.connect();

    expect(workspace.connection).toBe('connected');
    expect(await workspace.submit(' first message ')).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-one', text: 'first message' }),
    );

    handlers.onData({
      cursor: 2,
      sessionId: 'session-one',
      kind: 'snapshot',
      snapshot: snapshot({ cursor: 2, status: 'running' }),
    });
    expect(await workspace.submit('steer this')).toBe(true);
    expect(mocks.steer).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-one', text: 'steer this' }),
    );

    handlers.onData({
      cursor: 1,
      sessionId: 'session-one',
      kind: 'snapshot',
      snapshot: snapshot({ cursor: 1, status: 'idle' }),
    });
    expect(workspace.snapshot?.status).toBe('running');
    workspace.dispose();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('keeps an unsaved workbench draft on an unsolicited project switch', async () => {
    const workspace = createWorkspaceController({
      hasUnsavedWorkbenchDraft: () => true,
    });
    await workspace.connect();

    handlers.onData({
      cursor: 2,
      sessionId: 'session-two',
      kind: 'snapshot',
      snapshot: snapshot({
        sessionId: 'session-two',
        projectPath: '/project-two',
        cursor: 2,
      }),
    });

    expect(workspace.snapshot?.projectPath).toBe('/project-one');
    expect(workspace.staleSession).toBe(true);
    expect(workspace.error).toContain('unsaved workbench draft');
    expect(await workspace.submit('should not send')).toBe(false);
    workspace.dispose();
  });
});
