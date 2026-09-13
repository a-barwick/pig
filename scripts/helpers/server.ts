import {
  spawn,
  type ChildProcessByStdio,
} from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import type { Readable } from "node:stream";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultTimeout = 60_000;
type AcceptanceChild = ChildProcessByStdio<null, Readable, Readable>;

export interface StartedServer {
  readonly origin: string;
  readonly port: number;
  readonly root: string;
  readonly agentDir: string;
  readonly child: AcceptanceChild;
  stop(): Promise<void>;
}

export interface StartServerOptions {
  /** Root containing the isolated `agent` and `project` directories. */
  root?: string;
  port?: number;
  /** The explicit opt-in used by live acceptance to use pi's existing auth. */
  useExistingAuth?: boolean;
  timeoutMs?: number;
  /** Used by tests that build outside the repository's default `build/`. */
  buildDir?: string;
}

const tail = (value: string, length = 12_000) =>
  value.length > length ? value.slice(-length) : value;

async function waitForHttp(
  child: AcceptanceChild,
  url: string,
  output: () => string,
  timeoutMs: number,
) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(
        `Built Kit server exited before becoming ready (code ${child.exitCode}).\n${output()}`,
      );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok && output().includes(`Listening on ${new URL(url).origin}`)) {
        await response.arrayBuffer();
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for built Kit server at ${url} (${lastError}).\n${output()}`,
  );
}

/**
 * Start the actual adapter-node output. This helper deliberately does not
 * import the app or its services, so these acceptance scripts exercise the
 * same process that Austin starts with `HOST=127.0.0.1 PORT=4317 node build`.
 */
export async function startBuiltServer(
  options: StartServerOptions = {},
): Promise<StartedServer> {
  const port = options.port ?? Number(process.env.PORT ?? 4317);
  const ownedRoot = !options.root;
  const root = resolve(
    options.root ?? (await mkdtemp(join(tmpdir(), "pi-dashboard-acceptance-"))),
  );
  const agentDir = join(root, "agent");
  await mkdir(agentDir, { recursive: true });
  await mkdir(join(root, "project"), { recursive: true });

  const buildDir = resolve(repoRoot, options.buildDir ?? "build");
  const child = spawn(process.execPath, [buildDir], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PI_DASHBOARD_AGENT_DIR: agentDir,
      ...(options.useExistingAuth
        ? { PI_DASHBOARD_USE_EXISTING_AUTH: "1" }
        : { PI_DASHBOARD_USE_EXISTING_AUTH: "" }),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output = tail(output + String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    output = tail(output + String(chunk));
  });

  const origin = `http://127.0.0.1:${port}`;
  try {
    await waitForHttp(
      child,
      `${origin}/`,
      () => output,
      options.timeoutMs ?? defaultTimeout,
    );
  } catch (error) {
    child.kill("SIGTERM");
    if (ownedRoot) await rm(root, { recursive: true, force: true });
    throw error;
  }

  let stopping: Promise<void> | undefined;
  let removeSignalHandlers = () => {};
  const stop = async () => {
    if (stopping) return stopping;
    stopping = (async () => {
      removeSignalHandlers();
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      await new Promise<void>((resolve, reject) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
          return;
        }
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`Timed out stopping built Kit server.\n${output}`));
        }, 20_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      if (ownedRoot) await rm(root, { recursive: true, force: true });
    })();
    return stopping;
  };
  const onSigint = () => {
    void stop().finally(() => process.exit(130));
  };
  const onSigterm = () => {
    void stop().finally(() => process.exit(143));
  };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  removeSignalHandlers = () => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };

  return { origin, port, root, agentDir, child, stop };
}

export async function withBuiltServer<T>(
  options: StartServerOptions,
  run: (server: StartedServer) => Promise<T>,
): Promise<T> {
  const server = await startBuiltServer(options);
  try {
    return await run(server);
  } finally {
    await server.stop();
  }
}

export type SseFrame = { event?: string; id?: string; data: string };

/** Read one complete SSE frame, preserving arbitrary multiline data. */
export async function readSseFrame(
  response: Response,
  timeoutMs = 10_000,
): Promise<SseFrame | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([
          reader.read(),
          new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("Timed out waiting for SSE data")),
              remaining,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      if (result.done) return null;
      buffer += decoder.decode(result.value, { stream: true });
      const match = buffer.match(/\r?\n\r?\n/);
      if (!match || match.index === undefined) continue;
      const block = buffer.slice(0, match.index);
      const lines = block.split(/\r?\n/);
      buffer = buffer.slice(match.index + match[0].length);
      let event: string | undefined;
      let id: string | undefined;
      const data: string[] = [];
      for (const line of lines) {
        if (!line || line.startsWith(":")) continue;
        const separator = line.indexOf(":");
        const field = separator < 0 ? line : line.slice(0, separator);
        const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "id") id = value;
        else if (field === "data") data.push(value);
      }
      return { event, id, data: data.join("\n") };
    }
    throw new Error("Timed out waiting for SSE data");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const cookieValue = (header: string) => header.split(";", 1)[0];

/** Small same-origin fetch/tRPC client for acceptance scripts. */
export class LocalRpcClient {
  readonly baseUrl: string;
  readonly eventsPath: string;
  #cookie = "";

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.eventsPath = "/trpc/events";
  }

  private recordCookies(response: Response) {
    const values =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie")!]
          : [];
    if (values.length) this.#cookie = cookieValue(values.at(-1)!);
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Origin", this.baseUrl);
    headers.set("Sec-Fetch-Site", "same-origin");
    if (this.#cookie) headers.set("Cookie", this.#cookie);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    this.recordCookies(response);
    return response;
  }

  async openPage() {
    const response = await this.request("/");
    if (!response.ok) throw new Error(`Workspace page failed: HTTP ${response.status}`);
    await response.arrayBuffer();
    return response;
  }

  async bootstrap() {
    const response = await this.request("/api/bootstrap");
    if (!response.ok) throw new Error(`Bootstrap failed: HTTP ${response.status}`);
    await response.arrayBuffer();
    return response;
  }

  async rpc<T = unknown>(procedure: string, input?: unknown, method: "GET" | "POST" = "GET"): Promise<T> {
    const init: RequestInit = { method };
    let path = `/trpc/${procedure}`;
    if (method === "GET") {
      // Match tRPC's `httpLink`: unbatched calls send the input directly and
      // omit the query string entirely when a procedure has no input.
      if (input !== undefined)
        path += `?input=${encodeURIComponent(JSON.stringify(input))}`;
    } else {
      init.headers = { "content-type": "application/json" };
      init.body = input === undefined ? undefined : JSON.stringify(input);
    }
    const response = await this.request(path, init);
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      throw new Error(`RPC ${procedure} failed: HTTP ${response.status} ${JSON.stringify(body)}`);
    const envelope = Array.isArray(body) ? body[0] : body?.["0"] ?? body;
    if (envelope?.error)
      throw new Error(`RPC ${procedure} failed: ${JSON.stringify(envelope.error)}`);
    const data =
      envelope && typeof envelope === "object" && "result" in envelope
        ? (envelope.result as { data?: unknown }).data
        : envelope && typeof envelope === "object" && "data" in envelope
          ? envelope.data
          : envelope;
    return data && typeof data === "object" && Object.keys(data).length === 1 && "json" in data
      ? (data.json as T)
      : (data as T);
  }

  async open(input: { projectPath: string; sessionPath?: string }) {
    return this.rpc("open", input, "POST") as Promise<any>;
  }
  async state<T = any>() {
    return this.rpc<T>("state");
  }
  async sessions<T = any>(projectPath: string) {
    return this.rpc<T>("sessions", { projectPath });
  }
  async events(): Promise<Response> {
    let path = this.eventsPath;
    const response = await this.request(path, {
      headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`SSE failed: HTTP ${response.status}`);
    return response;
  }
}
