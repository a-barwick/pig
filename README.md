# Pi Dashboard

Austin’s local pi workspace: real project conversations, a harness inspector, and a skill editor beside the conversation. Built with Svelte 5, TypeScript, a local Node server, tRPC over HTTP/SSE, and the pinned pi coding-agent SDK **0.85.1**.

## Run locally

```sh
cd /Users/austinbarwick/Documents/dev/agents/pi-dashboard
pnpm install
pnpm build
pnpm start
```

Open **http://localhost:4317** or the printed **http://127.0.0.1:4317** URL. Keep the terminal running; Ctrl+C stops it. Restart with `pnpm start`. `pnpm dev` serves the client with Vite hot reload. Set `PORT` to choose another port.

The server uses your existing pi authentication and configuration, and pi owns session persistence in its normal agent directory. Browser local storage holds recent project paths. No credentials or session copies belong in this repository. The process binds loopback and validates Host/Origin; RPC and SSE require a same-origin, HttpOnly session cookie. Pi tools run with the server process’s permissions.

## First conversation and skill

1. Open an absolute project path. Resume a conversation from the sidebar or start a new one.
2. Send a message. Thinking and tool activity stream live. Expand calls for arguments/results, and follow “Inspect tool definition” for schemas and sources. Stop requests cancellation; sending while running queues a steering message.
3. Open **Skills**, create a project skill, review its actual diff, and save. A save changes the file; it does not reload the running agent. Use **Start fresh trial** to invoke the saved revision and inspect loading evidence.
4. Use **Settings** for project or deliberately chosen global model/thinking defaults. “Use my default” removes the project override. Per-model thinking takes precedence over ordinary defaults. Conversation model/thinking controls are temporary.

Untrusted project resources are marked not loaded with a reason. “Trust this folder & reload” saves an explicit trust decision. Trust governs resource loading, not general file access.

After a server restart, reconnect and open/resume the saved conversation. Loading history never reruns tools. Outside edits produce a save conflict while keeping the draft.

## Verification

```sh
pnpm check
pnpm test
pnpm build
```

See [acceptance evidence](docs/acceptance.md) for live-provider and browser checks. `pnpm exec tsx scripts/smoke.ts` is an **explicit real-provider test**: it creates temporary settings, trust, skills and sessions, uses existing authentication, and performs model/tool turns. It does not modify your global settings. The other `scripts/browser-*` and test-server helpers are manual acceptance tooling, not app startup requirements.

## Current limits

- One active runtime session. Multi-agent conversations, attachments, branching, terminals, package installation and broad settings forms are deferred.
- Standard extension select/confirm/input/editor dialogs work. Custom terminal components fail explicitly; terminal-only cosmetic APIs are reported unsupported.
- The workbench edits discovered local skills. Package/glob-only and ancestor resources remain read-only in the inspector. Symlinked resource targets are not editable.
- Undo retains the last save per file only until server restart. Settings saves preserve unknown values but normalize JSON formatting. Revision checks detect outside changes; a simultaneous noncooperating filesystem writer can still race the final rename.
- Raw evidence masks recognized credential fields/patterns with `[REDACTED]`. Missing tool outcomes are unknown; a cancellation request is not proof that every side effect was undone.

The bounded release follows [the handoff](docs/implementation-handoff.md) and [visual reference](design/pi-personal-workspace.html). Reference inventories and [deferred ideas](docs/future.md) do not expand the release scope. No hosted deployment or package installation UI is included.
