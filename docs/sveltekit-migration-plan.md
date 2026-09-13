# SvelteKit migration — execution record

Status: implemented and verified locally on September 12, 2026. The starting checkout was clean on `sveltekit-migration` at `7466860`; the original check, 47 tests, and Vite build passed before editing. The current behavior and launch instructions are in [the handoff](implementation-handoff.md), with final verification in [acceptance.md](acceptance.md).

## Result and boundaries

The personal pi workspace is one SSR-enabled SvelteKit application on a loopback Node process. Kit owns HTML rendering, routes, hooks, development serving, static assets, and the built server. The old `src/server/http.ts`, `src/server/index.ts`, root `index.html`, and manual `main.ts` mount are removed.

The existing conversation, inspector, and side-by-side workbench remain. Pi 0.85.1 authentication/configuration, resource loading, trust, and JSONL sessions remain the sources of truth. No database, hosting, accounts, extra pi process, package installation feature, or unrelated hardening was added.

## Stable stack

Immediately before changing the lockfile, npm's stable tags and peer/engine ranges were rechecked:

| Package | Selected version |
| --- | --- |
| @sveltejs/kit | 2.70.3 |
| @sveltejs/adapter-node | 5.5.7 |
| vite | 8.3.0 |
| @sveltejs/vite-plugin-svelte | 7.3.0 |
| svelte | 5.57.0 |
| vitest | 5.0.0 |
| @earendil-works/pi-coding-agent | 0.85.1, unchanged |

Node 22.23.2 meets these ranges. pnpm 9.15.1 and its lockfile remain. Unrelated application dependencies were not upgraded. The official `sv` TypeScript template was generated in a temporary directory as a reference; the repository uses stable Kit configuration with adapter-node defaults.

Production starts with `HOST=127.0.0.1 PORT=4317 node build` via `pnpm start`. Development runs Kit/Vite with an explicit loopback host, strict port, and overridable `PORT`. Both `localhost` and `127.0.0.1` work. Origin, proxy-header, and socket overrides remain unset.

## Blocking SSE gate and selected feed

**Selected: tRPC SSE through the Kit Fetch route, with client link base `/trpc` and subscription request `/trpc/events`.** There is no native event endpoint or second serializer/client.

The isolated probe compared both candidates through actual Kit dev and built adapter-node servers before UI integration and old-server removal:

| Server | tRPC Fetch subscription | Native Response SSE |
| --- | --- | --- |
| Kit dev | Passed | Passed |
| Built Node | Passed | Passed |

Every cell checked an authoritative initial snapshot, ordered `snapshot → text → tool:start → tool:result → text` payloads, stable tool-call identity, abort reducing listeners from one to zero, process rotation/reconnect, and open-stream SIGINT/SIGTERM cleanup.

Review found that the first probe explicitly exited the process after disposing its fake feed. The strengthened rerun removed that shortcut: built shutdown exits naturally through adapter-node, while the dev-only signal helper awaits `server.close()`. That complete matrix passed. Built tRPC SIGTERM/SIGINT took 10/6 ms; native took 7/8 ms. Dev tRPC took 14/21 ms; native took 20/29 ms. Dev SIGTERM's exit code was 143 and SIGINT's was 0; built exits were 0. The fake feed reported zero listeners before shutdown.

Both feeds met the behavior checks. tRPC retained the existing typed client, reconnection handling, and protocol framing, so a custom SSE consumer earned no place in this slice. The temporary native/probe routes and script were omitted from the product tree. Probe source/evidence remains in isolated branch `kit-sse`, commits `e769452` and corrected `9bb2905`, for reproducibility.

## Implemented application shape

```text
src/
  app.html
  hooks.server.ts
  routes/
    +page.server.ts
    +page.svelte
    +error.svelte
    api/bootstrap/+server.ts
    trpc/[...trpc]/+server.ts
  lib/
    server/       runtime, config, router, access policy, service owner
    client/       existing workspace, conversation, inspector, workbench
    shared/       serializable contracts
```

Server load only issues the host-only process cookie and returns the redacted plain snapshot. It never opens or switches projects. A controller per page receives that snapshot directly; JSON tRPC responses retain their existing normalization. Recent-project storage is read after mount, timestamps initially render as ISO text, and SSE connects on mount. SSR stays enabled and prerendering stays disabled.

The server-only owner caches one initialization promise and one disposer. It retains the existing runtime across module hot reload, avoids duplicate signal listeners, and releases the owner when Vite closes. Signals start pi cancellation while adapter-node drains the SSE response; the adapter shutdown event shares the same cleanup. There is no custom HTTP wrapper.

The request hook enforces exact loopback Host/port, matching Origin, Fetch-Site, and RPC/SSE cookies; private responses get no-store, nosniff, no-referrer, and frame protection. Kit's form CSRF checks remain enabled. Static bundle assets bypass hooks, so no private data goes under a static directory. The default finite 512 KiB adapter limit remains: representative 128 KiB prompt and 256 KiB skill requests fit, and an oversized request is rejected as a tRPC body-limit error.

## Integration and acceptance

Three `gpt-5.6-luna` agents at max reasoning used separate worktrees for SSE evidence, UI/SSR work, and browser/script ports. The lead owned shared configuration/contracts, transport selection, server integration, review fixes, and final checks. Agent handoffs were integrated and tested together.

The original server tests were replaced with hook/access, load/bootstrap, Fetch query/mutation/SSE, initialization/disposal, and reload tests. Browser and smoke helpers now launch the real `node build` output with isolated test settings, trust, skills, and sessions. Existing authentication is reused in place only for explicit live tests.

The full verification record includes real successful/failed tools, browser streaming/stop/steer, process restart and JSONL resume, page refresh without creating another session, draft preservation, skill revision conflict/loading, scoped defaults, extension dialogs, shutdown during a running tool, and desktop/half-window Chrome checks. See [acceptance.md](acceptance.md) for commands, evidence, and environment limitations.

References: [Kit structure](https://svelte.dev/docs/kit/project-structure), [adapter-node and lifecycle](https://svelte.dev/docs/kit/adapter-node), [hooks](https://svelte.dev/docs/kit/hooks), [server-only modules](https://svelte.dev/docs/kit/server-only-modules), [tRPC Fetch adapter](https://trpc.io/docs/server/adapters/fetch).
