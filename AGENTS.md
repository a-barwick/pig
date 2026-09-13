# Pi Dashboard guidance

This is Austin's personal project. Prioritize a useful end-to-end loop and avoid speculative infrastructure.

Austin explicitly confirmed this is for his own use first. Current design direction combines everyday pi conversations with a customization workbench in a local browser app. Do not expand scope for teams, broad onboarding, a marketplace, or general-purpose productization.

- Mirror pi's transparency and simplicity: make available tools, actual calls, arguments, results, and configuration sources inspectable.
- Verify pi behavior against the installed version; current research baseline is 0.85.1 under `@earendil-works`.
- Keep pi configuration files as the source of truth. Distinguish pi-native settings, extension-owned configuration, and dashboard-only preferences. Use [the configuration inventory](docs/pi-configuration.md) and [the installed settings reference](docs/settings-reference.md) when working on configuration; they describe capabilities, not additional product scope.
- Preserve existing settings and unrelated files. Never commit credentials, session contents, or copies of Austin's global config.
- Do not install community packages or alter live pi settings as part of research.
- Update current documents in place when decisions change. Remove superseded alternatives; Git history retains the exploration.

The app uses SvelteKit 2, Svelte 5, adapter-node, and SSR. Keep privileged code under `src/lib/server`, browser code under `src/lib/client`, and serializable contracts under `src/lib/shared`. Kit owns the Node listener and routes; `/trpc/events` is the single tRPC Fetch subscription. Keep the local loopback Host/Origin boundary and cookie protection for RPC and SSE.

Pi owns configuration and JSONL sessions. Page load reads state; opening, resuming, and trusting a project are explicit actions. Saving a skill or setting does not apply it to an already-running agent. A server restart requires explicit session resume. Preserve the distinction between a cancellation request and a confirmed tool outcome.

For Svelte component or rune-module changes, use the project-local Svelte MCP server: discover documentation with `list-sections`, read it with `get-documentation`, and run `svelte-autofixer` on changed `.svelte` or `.svelte.ts` files. Use `pnpm check` for types; run `pnpm test` and `pnpm build` when appropriate to the change. Stop at a useful point for Austin to dogfood before expanding scope.
