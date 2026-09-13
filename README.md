# Pi Dashboard

Austin’s local pi workspace: real project conversations, a harness inspector, and a skill editor beside the conversation. Built with SvelteKit 2, Svelte 5, TypeScript, adapter-node, tRPC over HTTP/SSE, and the pinned pi coding-agent SDK **0.85.1**.

## Run locally

```sh
cd /Users/austinbarwick/Documents/dev/agents/pi-dashboard
pnpm install
pnpm build
pnpm start
```

Open **http://localhost:4317** or **http://127.0.0.1:4317**. Keep the terminal running; Ctrl+C stops it. Restart with `pnpm start`. `pnpm dev` runs Kit with Vite hot reload. `PORT=4320 pnpm start` or `PORT=4320 pnpm dev` chooses another strict loopback port. The built entry point is `HOST=127.0.0.1 PORT=4317 node build`.

The server uses your existing pi authentication and configuration, and pi owns session persistence in its normal agent directory. Browser local storage holds recent project paths. No credentials or session copies belong in this repository. The process binds loopback and validates Host/Origin; RPC and SSE require a same-origin, HttpOnly session cookie. Pi tools run with the server process’s permissions.

Kit owns HTML rendering, routing, static assets, and the Node listener. A server load supplies a redacted snapshot; a controller per page hydrates it and connects to the single tRPC SSE feed on mount. Server-only services retain one pi runtime across requests and ordinary hot reloads. Restart the dev server to apply changes to runtime/config service implementations. A page refresh keeps the active session; a process restart requires explicit resume from pi’s JSONL history.

This is a direct local server, with no proxy: leave `ORIGIN`, forwarded-header adapter settings, and `SOCKET_PATH` unset. Private page/API responses are not cached. Static assets bypass the request hook and contain only the public app bundle. The built server retains adapter-node’s 512 KiB request limit; an oversized tRPC request returns a body-limit error.

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
pnpm exec tsx scripts/kit-boundary-check.ts
```

See [acceptance evidence](docs/acceptance.md) for live-provider and browser checks. `pnpm exec tsx scripts/smoke.ts` is an **explicit real-provider test**: it creates temporary settings, trust, skills and sessions, uses existing authentication, and performs model/tool turns. It does not modify your global settings. The other `scripts/browser-*` and test-server helpers are manual acceptance tooling, not app startup requirements.

## Svelte AI authoring tools

Codex loads the official Svelte MCP server from [the project configuration](.codex/config.toml) after the project is trusted and a new Codex session starts. The repo's [agent instructions](AGENTS.md) require its documentation and autofixer for component/rune work. This setup uses `npx` on demand; it adds no app dependency. Use SvelteKit and Svelte 5 guidance. See [Svelte's local setup](https://svelte.dev/docs/ai/local-setup).

## Current limits

- One active runtime session. Multi-agent conversations, attachments, branching, terminals, package installation and broad settings forms are deferred.
- Standard extension select/confirm/input/editor dialogs work. Custom terminal components fail explicitly; terminal-only cosmetic APIs are reported unsupported.
- The workbench edits discovered local skills. Package/glob-only and ancestor resources remain read-only in the inspector. Symlinked resource targets are not editable.
- Undo retains the last save per file only until server restart. Settings saves preserve unknown values but normalize JSON formatting. Revision checks detect outside changes; a simultaneous noncooperating filesystem writer can still race the final rename.
- Raw evidence masks recognized credential fields/patterns with `[REDACTED]`. Missing tool outcomes are unknown; a cancellation request is not proof that every side effect was undone.

The bounded release follows [the handoff](docs/implementation-handoff.md) and [visual reference](design/pi-personal-workspace.html). Reference inventories and [deferred ideas](docs/future.md) do not expand the release scope. No hosted deployment or package installation UI is included.
