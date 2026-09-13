# Personal pi workspace — implementation handoff

Status: local SvelteKit dogfood slice implemented. See [acceptance.md](acceptance.md) for verification.

## Product and scope

Austin's everyday local pi GUI combines one real project conversation, a harness inspector, and a side-by-side skill/settings workbench. The reference remains [the personal workspace mockup](../design/pi-personal-workspace.html). Its example content is not runtime output.

This is one person's loopback workspace. Keep one active pi session, native configuration and JSONL persistence. There is no database, hosted deployment, account system, package marketplace, terminal, attachment flow, branching, or multi-agent workspace. Reference inventories and future proposals do not expand this slice. Stop for dogfooding before adding layers.

## Current architecture

- SvelteKit 2 with Svelte 5 and TypeScript; Vite 8 for development and adapter-node for the built server.
- Kit owns HTML rendering, routes, static assets, request hooks, and the Node listener. SSR is enabled and the workspace is not prerendered.
- One page at `/` renders a redacted initial snapshot and creates a controller per rendered workspace. Browser storage and SSE start after mount. Recent projects initially render empty and session timestamps initially use ISO text, then localize after hydration.
- The validated tRPC router serves queries, mutations, and the single SSE subscription through Kit's Fetch route at `/trpc/[...trpc]`. The client link base is `/trpc`; its subscription request is `/trpc/events`. There is no native SSE route.
- `GET /api/bootstrap` renews the process cookie after a restart without opening a project. Page load is a read boundary; project open, resume, trust, and model commands remain explicit.
- `src/lib/server` owns runtime, config, router, access policy, and one process service owner. `src/lib/client` owns the existing conversation/inspector/workbench modules. `src/lib/shared` contains serializable contracts; client router imports are type-only.
- The pinned `@earendil-works/pi-coding-agent` 0.85.1 SDK runs in the same process. Pi's installed auth, settings, resource loading, trust, and JSONL sessions remain authoritative.
- SIGINT/SIGTERM initiate one runtime disposal while HTTP drains. Adapter shutdown shares that disposal; Vite awaits it when its server closes. Ordinary module hot reload retains the existing runtime and signal handlers. Restart development to apply runtime/config implementation changes.

Launch with `pnpm build && pnpm start`; use `pnpm dev` for development. Both bind `127.0.0.1:4317` and allow `localhost:4317` browser access. `PORT=4320` works with either command. Direct built startup is `HOST=127.0.0.1 PORT=4317 node build`.

The app requires exact loopback Host/port, a matching Origin when supplied, and non-cross-site Fetch-Site. RPC and SSE also require the process's HttpOnly, SameSite=Strict cookie. There is no proxy: adapter origin/forwarded-header/socket overrides stay unset. Private responses are not cached; Kit's static assets bypass hooks and must contain only public application assets. Keep private data out of `static/`. The built adapter's 512 KiB request limit remains enabled.

## Behavior to preserve

Commands report acceptance separately from turn completion. Ordered snapshots preserve streamed text/thinking, actual tool-call IDs, arguments, results, and states. Keep cancellation requests distinct from confirmed tool outcomes; unavailable results stay labeled unknown. Inventory entries expose actual tool schemas and provenance where pi provides it.

A page refresh retains the active process session. A server restart rotates the cookie and leaves an open tab's history and drafts readable but stale until an explicit open/resume. Resuming history never reruns tools. Project switching and closing workbench views guard unsent/unsaved drafts.

Skill creation/editing saves a real local `SKILL.md`, previews an actual diff, checks the expected revision, and preserves drafts on conflict. Saving is not applying to the current session. A fresh trial records the revision and pi loading/invocation evidence without claiming universal instruction-following.

Settings distinguish pi-native fields from extension-owned configuration and dashboard preferences. Project overrides can differ from global defaults; removing an override restores the default. Preserve unknown fields and unrelated files. Config writes may normalize JSON formatting; undo is process-local. No credential or session copies belong in the checkout.

Trust governs project resource loading, not general file access. Skipped resources show reasons, and trusting a project remains an explicit command. Standard extension dialogs work; custom terminal components report unsupported behavior. Pi tools retain the launching process's permissions.

## Acceptance and maintenance

Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`, and `pnpm exec tsx scripts/kit-boundary-check.ts`. The latter starts both real Kit dev and built servers with temporary pi directories and no provider calls.

The explicit `pnpm exec tsx scripts/smoke.ts` uses the built server, temporary settings/trust/skills/sessions, and existing authentication in place. It checks real successful/failed tool calls, stop/steer, restart/resume, scoped defaults, conflict recovery, saved-revision loading, and unchanged actual global settings. It prints the temporary root for follow-up browser checks.

Run `scripts/browser-flow.ts <root>` and `scripts/browser-recovery.ts <root>` with `pnpm exec tsx` using that acceptance root. They inspect the skill workbench, real tools, restart/draft recovery, dialogs, SSR/hydration, and desktop/half-window layouts. `scripts/browser-check.ts` checks the shell; set `PI_DASHBOARD_ORIGIN` to inspect an already-running server. The acceptance helper launches `node build`; it is not another app server.

For Svelte component/rune edits, use the project Svelte MCP documentation and autofixer and keep `pnpm check` as the type check. The current release is ready to learn from local use; do not turn this handoff into a production-readiness program.
