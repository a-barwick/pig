import { api, normalizeSnapshot } from "../api";
import type { SessionInfo, Snapshot, Thinking } from "../../shared/contracts";

export type WorkspaceConnection = "connecting" | "connected" | "disconnected";

export interface WorkspaceControllerOptions {
  /**
   * Refactor follow-up: keep unsolicited session replacement guarded here
   * until draft ownership and navigation policy have a settled home.
   */
  hasUnsavedWork?: () => boolean;
}

export interface WorkspaceController {
  readonly snapshot: Snapshot | null;
  readonly sessions: SessionInfo[];
  readonly recent: string[];
  readonly error: string;
  readonly notice: string;
  readonly busy: boolean;
  readonly staleSession: boolean;
  readonly connection: WorkspaceConnection;
  readonly running: boolean;
  readonly disabled: boolean;

  connect(preserveError?: boolean): Promise<void>;
  dispose(): void;
  refreshSessions(path?: string): Promise<void>;
  openProject(path: string, sessionPath?: string): Promise<boolean>;
  submit(text: string): Promise<boolean>;
  stop(): Promise<boolean>;
  selectModel(value: string): Promise<boolean>;
  selectThinking(value: string): Promise<boolean>;
  answerDialog(
    dialogId: string,
    value?: string | boolean,
    cancelled?: boolean,
  ): Promise<boolean>;
  trust(): Promise<boolean>;
  adoptTrial(next: Snapshot): void;
  clearError(): void;
  clearNotice(): void;
}

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Create the runtime/session model for one App instance.
 *
 * This is deliberately a factory rather than a module singleton: an App owns
 * one connection generation and one SSE subscription, and can dispose both
 * without affecting another mounted instance.
 */
export function createWorkspaceController(
  options: WorkspaceControllerOptions = {},
): WorkspaceController {
  let snapshot = $state<Snapshot | null>(null);
  let sessions = $state<SessionInfo[]>([]);
  let recent = $state<string[]>(readRecentProjects());
  let error = $state("");
  let notice = $state("");
  let busy = $state(false);
  let staleSession = $state(false);
  let connection = $state<WorkspaceConnection>("connecting");

  let unsubscribe: (() => void) | undefined;
  let connectionGeneration = 0;
  let navigating = false;

  let running = $derived(
    !staleSession &&
      (snapshot?.status === "running" || snapshot?.status === "stopping"),
  );
  let disabled = $derived(busy || connection !== "connected");

  function readRecentProjects(): string[] {
    try {
      if (typeof localStorage === "undefined") return [];
      const stored: unknown = JSON.parse(
        localStorage.getItem("pi.recentProjects") ?? "[]",
      );
      return Array.isArray(stored)
        ? stored
            .filter((item): item is string => typeof item === "string")
            .slice(0, 10)
        : [];
    } catch {
      // Browser storage is optional and may contain invalid old data.
      return [];
    }
  }

  function remember(path: string) {
    recent = [path, ...recent.filter((item) => item !== path)].slice(0, 10);
    try {
      localStorage.setItem("pi.recentProjects", JSON.stringify(recent));
    } catch {
      // Browser storage is optional.
    }
  }

  async function refreshSessions(path = snapshot?.projectPath): Promise<void> {
    if (!path) return;
    try {
      const rows = await api.sessions.query({ projectPath: path });
      if (snapshot?.projectPath === path) sessions = rows;
    } catch (cause) {
      error = `Could not load sessions: ${message(cause)}`;
    }
  }

  function receive(
    value: Parameters<typeof normalizeSnapshot>[0],
    allowSwitch = false,
    // Explicit mutations have already passed the UI guard before the server
    // changes sessions; only unsolicited replacements need this protection.
    explicitSwitch = false,
  ): boolean {
    const next = normalizeSnapshot(value);

    // Incremental events from another session cannot replace the active
    // conversation, and a reconnect must not move the cursor backwards.
    if (!allowSwitch && snapshot && next.sessionId !== snapshot.sessionId)
      return false;
    if (!allowSwitch && snapshot && next.cursor < snapshot.cursor) return false;

    const changedSession = snapshot?.sessionId !== next.sessionId;
    if (
      allowSwitch &&
      !explicitSwitch &&
      !navigating &&
      snapshot &&
      (next.sessionId !== snapshot.sessionId ||
        next.projectPath !== snapshot.projectPath) &&
      options.hasUnsavedWork?.()
    ) {
      staleSession = true;
      error =
        "The server switched conversations. Your unsaved draft is preserved. Save or discard it before reconnecting.";
      return false;
    }

    staleSession = false;
    snapshot = next;
    if (changedSession) {
      remember(next.projectPath);
      void refreshSessions(next.projectPath);
    }
    return true;
  }

  async function connect(preserveError = false): Promise<void> {
    unsubscribe?.();
    unsubscribe = undefined;
    const generation = ++connectionGeneration;
    connection = "connecting";
    staleSession = snapshot !== null;

    try {
      // A server restart rotates the HttpOnly local-access cookie.
      const response = await fetch("/", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok)
        throw new Error(`Local workspace returned HTTP ${response.status}`);
      if (generation !== connectionGeneration) return;

      const state = await api.state.query();
      if (generation !== connectionGeneration) return;
      if (!preserveError) error = "";
      if (state) receive(state, true);
      if (snapshot) await refreshSessions(snapshot.projectPath);
    } catch (cause) {
      if (generation === connectionGeneration) {
        connection = "disconnected";
        error = `Could not reconnect: ${message(cause)}`;
      }
      return;
    }

    if (generation !== connectionGeneration) return;
    let first = true;
    const subscription = api.events.subscribe(undefined, {
      onStarted() {
        if (generation === connectionGeneration) connection = "connected";
      },
      onConnectionStateChange(state) {
        if (generation !== connectionGeneration) return;
        connection =
          state.state === "pending"
            ? "connected"
            : state.state === "connecting"
              ? "connecting"
              : "disconnected";
        if (state.state === "connecting") {
          first = true;
          staleSession = snapshot !== null;
        }
      },
      onData(event) {
        if (generation !== connectionGeneration || navigating) return;
        connection = "connected";
        if (event.snapshot) {
          const wasRunning =
            snapshot?.status === "running" || snapshot?.status === "stopping";
          // The first snapshot is authoritative after a reconnect, including
          // server restarts; later snapshots remain session/cursor guarded.
          receive(event.snapshot, first);
          first = false;
          if (wasRunning && event.snapshot.status === "idle")
            void refreshSessions(event.snapshot.projectPath);
        }
        if (event.sessionId === snapshot?.sessionId && event.kind === "error")
          error = event.message ?? "Runtime error";
      },
      onError(cause) {
        if (generation === connectionGeneration) {
          connection = "disconnected";
          error = `Connection lost: ${message(cause)}`;
        }
      },
      onComplete() {
        if (generation === connectionGeneration) connection = "disconnected";
      },
    });
    unsubscribe = () => subscription.unsubscribe();
  }

  async function perform(action: () => Promise<void>): Promise<boolean> {
    if (busy) return false;
    busy = true;
    error = "";
    try {
      await action();
      return true;
    } catch (cause) {
      error = message(cause);
      return false;
    } finally {
      busy = false;
    }
  }

  async function openProject(
    path: string,
    sessionPath?: string,
  ): Promise<boolean> {
    const projectPath = path.trim();
    if (!projectPath) return false;

    return perform(async () => {
      navigating = true;
      try {
        const next = await api.open.mutate({ projectPath, sessionPath });
        receive(next, true, true);
        notice = "";
        remember(next.projectPath);
        await refreshSessions(next.projectPath);
      } finally {
        navigating = false;
        void connect(true);
      }
    });
  }

  async function submit(text: string): Promise<boolean> {
    const active = snapshot;
    const submitted = text.trim();
    if (!active || !submitted || staleSession || disabled) return false;

    const steering = running;
    return perform(async () => {
      const input = {
        sessionId: active.sessionId,
        requestId: crypto.randomUUID(),
        text: submitted,
      };
      if (steering) await api.steer.mutate(input);
      else await api.send.mutate(input);
      notice = steering
        ? "Steering message accepted; waiting for runtime progress."
        : "Message accepted; waiting for runtime progress.";
    });
  }

  async function stop(): Promise<boolean> {
    const active = snapshot;
    if (
      !active ||
      staleSession ||
      disabled ||
      !running ||
      active.status === "stopping"
    )
      return false;

    return perform(async () => {
      await api.stop.mutate({ sessionId: active.sessionId });
      notice = "Cancellation requested; waiting for runtime confirmation.";
    });
  }

  async function selectThinking(value: string): Promise<boolean> {
    if (!snapshot || staleSession || disabled) return false;
    const sessionId = snapshot.sessionId;
    return perform(async () => {
      receive(
        await api.select.mutate({ sessionId, thinking: value as Thinking }),
      );
    });
  }

  async function selectModel(value: string): Promise<boolean> {
    const model = snapshot?.models.find(
      (item) => `${item.provider}/${item.id}` === value,
    );
    if (!snapshot || !model || staleSession || disabled) return false;
    const sessionId = snapshot.sessionId;
    return perform(async () => {
      receive(
        await api.select.mutate({
          sessionId,
          model: { id: model.id, provider: model.provider },
        }),
      );
    });
  }

  async function answerDialog(
    dialogId: string,
    value?: string | boolean,
    cancelled?: boolean,
  ): Promise<boolean> {
    return perform(async () => {
      await api.answer.mutate({ dialogId, value, cancelled });
    });
  }

  async function trust(): Promise<boolean> {
    const projectPath = snapshot?.projectPath;
    if (!projectPath || staleSession || disabled) return false;
    return perform(async () => {
      receive(await api.trust.mutate({ projectPath }), true, true);
    });
  }

  function adoptTrial(next: Snapshot): void {
    receive(next, true, true);
    notice =
      "Fresh skill trial opened. Inspect resource loading evidence in the harness.";
    void refreshSessions(next.projectPath);
  }

  function dispose(): void {
    connectionGeneration++;
    unsubscribe?.();
    unsubscribe = undefined;
  }

  return {
    get snapshot() {
      return snapshot;
    },
    get sessions() {
      return sessions;
    },
    get recent() {
      return recent;
    },
    get error() {
      return error;
    },
    get notice() {
      return notice;
    },
    get busy() {
      return busy;
    },
    get staleSession() {
      return staleSession;
    },
    get connection() {
      return connection;
    },
    get running() {
      return running;
    },
    get disabled() {
      return disabled;
    },
    connect,
    dispose,
    refreshSessions,
    openProject,
    submit,
    stop,
    selectModel,
    selectThinking,
    answerDialog,
    trust,
    adoptTrial,
    clearError() {
      error = "";
    },
    clearNotice() {
      notice = "";
    },
  };
}
