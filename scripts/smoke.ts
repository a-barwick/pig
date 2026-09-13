/**
 * Explicit live-provider acceptance run.
 *
 * This intentionally talks to the built adapter-node process over its public
 * same-origin boundary. It uses temporary settings, trust, skills and JSONL
 * sessions, while `PI_DASHBOARD_USE_EXISTING_AUTH=1` opts into pi's already
 * configured authentication without copying it into the temporary directory.
 */
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import type { Snapshot } from '../src/lib/shared/contracts';
import {
  LocalRpcClient,
  readSseFrame,
  startBuiltServer,
  type StartedServer,
} from "./helpers/server";

const root = await mkdtemp(join(tmpdir(), "pi-dashboard-smoke-"));
const agentDir = join(root, "agent");
const projectPath = join(root, "project");
await mkdir(agentDir, { recursive: true });
await mkdir(projectPath, { recursive: true });

const globalPath = join(homedir(), ".pi/agent/settings.json");
const actualGlobal = await readFile(globalPath);
const actual = JSON.parse(actualGlobal.toString()) as Record<string, unknown>;
const model = {
  provider:
    typeof actual.defaultProvider === "string"
      ? actual.defaultProvider
      : "openai-codex",
  id:
    typeof actual.defaultModel === "string"
      ? actual.defaultModel
      : "gpt-5.6-sol",
};
const baseline = JSON.stringify({
  defaultProvider: model.provider,
  defaultModel: model.id,
  defaultThinkingLevel: "high",
  defaultProjectTrust: "ask",
  customMetadata: { keep: true },
});
await writeFile(join(agentDir, "settings.json"), baseline);

const port = Number(process.env.PORT ?? 4320);
let server: StartedServer | undefined;
let client: LocalRpcClient | undefined;
const report: Record<string, unknown> = {
  root,
  model,
  transport: "built adapter-node via tRPC RPC",
};
console.log(JSON.stringify({phase:'starting isolated live acceptance',root,model}));

const snapshots = (value: unknown) => value as Snapshot;
const calls = (snapshot: Snapshot) =>
  snapshot.messages.flatMap((message) => message.toolCalls ?? []);
async function waitFor(
  predicate: (snapshot: Snapshot) => boolean,
  timeoutMs = 180_000,
) {
  assert(client);
  const deadline = Date.now() + timeoutMs;
  let snapshot = snapshots(await client.state<Snapshot | null>());
  while (
    (!snapshot || !predicate(snapshot)) && Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    snapshot = snapshots(await client.state<Snapshot | null>());
  }
  assert(snapshot, "Runtime state did not become available");
  assert(predicate(snapshot), "Timed out waiting for expected runtime state");
  return snapshot;
}
async function waitIdle(timeoutMs = 180_000) {
  return waitFor((snapshot) => snapshot.status !== "running" && snapshot.status !== "stopping", timeoutMs);
}
async function rpc<T = unknown>(procedure: string, input?: unknown, method: "GET" | "POST" = "GET") {
  assert(client);
  return client.rpc<T>(procedure, input, method);
}
async function openEventProbe() {
  assert(client);
  const response = await client.events();
  const frame = await readSseFrame(response, 15_000);
  assert(frame, "Selected event feed did not produce an initial frame");
  report.eventFeed = {
    path: client.eventsPath,
    contentType: response.headers.get("content-type"),
    firstEvent: frame.event,
    firstDataBytes: frame.data.length,
  };
}

try {
  server = await startBuiltServer({
    root,
    port,
    useExistingAuth: true,
    timeoutMs: 90_000,
  });
  client = new LocalRpcClient(server.origin);
  await client.openPage();

  const content =
    "---\nname: dashboard-smoke\ndescription: Explicit dashboard acceptance skill.\n---\nReply with SKILL_REVISION_ONE.\n";
  const saved = await rpc<any>(
    "saveSkill",
    {
      projectPath,
      name: "dashboard-smoke",
      scope: "project",
      expectedRevision: null,
      content,
    },
    "POST",
  );
  assert(saved.ok);
  const resourceId = saved.path as string;

  let state = snapshots(
    await rpc("open", { projectPath }, "POST"),
  );
  state = await waitIdle();
  assert.equal(state.trust.trusted, false);
  assert(
    state.resources.some((resource) => !resource.loaded && resource.reason),
    "Untrusted project resources should expose a skip reason",
  );
  report.untrustedResources = true;

  await rpc("trust", { projectPath }, "POST");
  state = await waitIdle();
  state = snapshots(await rpc("open", { projectPath }, "POST"));
  state = await waitIdle();
  assert(state.resources.some((resource) => resource.loaded));

  let settings = await rpc<any>("settings", { projectPath, scope: "project" });
  let settingSave = await rpc<any>(
    "saveSettings",
    {
      projectPath,
      scope: "project",
      expectedRevision: settings.revision,
      thinking: "medium",
    },
    "POST",
  );
  assert(settingSave.ok);
  state = snapshots(await rpc("open", { projectPath }, "POST"));
  state = await waitIdle();
  assert.equal(state.thinking, "medium", `Project thinking with model ${JSON.stringify(state.model)}: ${state.error ?? 'no runtime error'}`);
  assert.equal(await readFile(join(agentDir, "settings.json"), "utf8"), baseline);
  settings = await rpc<any>("settings", { projectPath, scope: "project" });
  settingSave = await rpc<any>(
    "saveSettings",
    {
      projectPath,
      scope: "project",
      expectedRevision: settings.revision,
      thinking: null,
    },
    "POST",
  );
  assert(settingSave.ok);
  state = snapshots(await rpc("open", { projectPath }, "POST"));
  state = await waitIdle();
  assert.equal(state.thinking, "high");
  report.scopedDefaults = true;

  await openEventProbe();
  await rpc(
    "select",
    { sessionId: state.sessionId, thinking: "low" },
    "POST",
  );
  const toolsRequest = {
    sessionId: state.sessionId,
    requestId: "tools",
    text: "Use bash twice: first run printf PI_TOOL_OK; then run a separate bash command that prints PI_EXPECTED_FAILURE to stderr and exits 7. Report their results briefly. Do not modify files.",
  };
  await rpc("send", toolsRequest, "POST");
  state = await waitIdle();
  assert(calls(state).some((call) => call.status === "completed"));
  assert(calls(state).some((call) => call.status === "failed"));
  assert(calls(state).every((call) => state.tools.some((tool) => tool.name === call.name)));
  report.tools = calls(state).map((call) => ({
    name: call.name,
    status: call.status,
    args: call.args !== undefined,
    result: call.result !== undefined,
  }));

  await rpc(
    "send",
    {
      sessionId: state.sessionId,
      requestId: "cancel",
      text: "Run bash sleep 30 now, then say SLEEP_DONE.",
    },
    "POST",
  );
  const running = await waitFor(
    (snapshot) => calls(snapshot).some((call) => call.status === "running"),
    60_000,
  );
  await rpc(
    "steer",
    {
      sessionId: running.sessionId,
      requestId: "steer",
      text: "After cancellation, acknowledge STEERING_RECEIVED and do not run another sleep.",
    },
    "POST",
  );
  await rpc("stop", { sessionId: running.sessionId }, "POST");
  state = await waitIdle(60_000);
  report.cancellation = { status: state.status, steerAccepted: true };

  const sessionPath = state.sessionFile;
  assert(sessionPath, "Expected a persisted session path after a live turn");
  const count = state.messages.length;
  await server.stop();
  server = undefined;

  server = await startBuiltServer({
    root,
    port,
    useExistingAuth: true,
    timeoutMs: 90_000,
  });
  client = new LocalRpcClient(server.origin);
  await client.bootstrap();
  state = snapshots(
    await rpc("open", { projectPath, sessionPath }, "POST"),
  );
  state = await waitIdle();
  assert.equal(state.messages.length, count);
  report.resumeAfterServerRestart = true;

  let skill = await rpc<any>("readSkill", { projectPath, resourceId });
  await writeFile(resourceId, `${content}\nExternal change\n`);
  const conflict = await rpc<any>(
    "saveSkill",
    {
      projectPath,
      resourceId,
      name: skill.name,
      scope: "project",
      expectedRevision: skill.revision,
      content: `${content}Draft`,
    },
    "POST",
  );
  assert(!conflict.ok && conflict.conflict);
  report.conflict = true;
  skill = await rpc<any>("readSkill", { projectPath, resourceId });
  const revised = await rpc<any>(
    "saveSkill",
    {
      projectPath,
      resourceId,
      name: skill.name,
      scope: "project",
      expectedRevision: skill.revision,
      content: content.replace("ONE", "TWO"),
    },
    "POST",
  );
  assert(revised.ok);
  state = snapshots(
    await rpc(
      "trial",
      {
        projectPath,
        resourceId,
        revision: revised.revision,
        prompt: "Follow the saved skill now.",
      },
      "POST",
    ),
  );
  state = await waitIdle();
  assert(state.trial?.loaded);
  assert.equal(state.trial?.revision, revised.revision);
  assert(
    state.messages.some(
      (message) => message.role === "assistant" && message.text.includes("SKILL_REVISION_TWO"),
    ),
  );
  report.savedRevisionTrial = state.trial;

  assert.deepEqual(await readFile(globalPath), actualGlobal);
  report.actualGlobalSettingsPreserved = true;
  report.globalSettingsHash = createHash("sha256")
    .update(actualGlobal)
    .digest("hex");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await server?.stop().catch(() => {});
  assert.deepEqual(await readFile(globalPath), actualGlobal, 'Actual global settings changed during acceptance');
}
