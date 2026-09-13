# Pi Dashboard guidance

This is Austin's personal project. Prioritize a useful end-to-end loop and avoid speculative infrastructure.

Austin explicitly confirmed this is for his own use first. Current design direction combines everyday pi conversations with a customization workbench in a local browser app. Do not expand scope for teams, broad onboarding, a marketplace, or general-purpose productization.

Current stage: first slice implemented for local dogfooding. `docs/implementation-handoff.md` defines the bounded scope; `docs/acceptance.md` records verification. Configuration and community reference documents describe capabilities, not additional scope.

- Plans in this repo are proposals, not automatically adopted requirements.
- Use Svelte for the frontend. Do not substitute React unless Austin explicitly requests it.
- Mirror pi's transparency and simplicity: make available tools, actual calls, arguments, results, and configuration sources inspectable.
- Verify pi behavior against the installed version; current research baseline is 0.85.1 under `@earendil-works`.
- Keep pi configuration files as the source of truth. Distinguish pi-native settings, extension-owned configuration, and dashboard-only preferences.
- Preserve existing settings and unrelated files. Never commit credentials, session contents, or copies of Austin's global config.
- Clearly label mock content and distinguish saving configuration from applying it to a running agent.
- Do not install community packages or alter live pi settings as part of research.
- Use the current mockup in `design/pi-personal-workspace.html`: everyday conversation with an inspector, side-by-side workbench when editing. Stop at a useful learning point for Austin to dogfood.
- Update current documents in place when decisions change. Remove superseded alternatives; Git history retains the exploration.

## Svelte authoring tools

The app is SvelteKit 2 with Svelte 5, Vite 8, and adapter-node. SSR stays enabled. Keep privileged code under `src/lib/server`, browser code under `src/lib/client`, and serializable contracts under `src/lib/shared`. The only event feed is the tRPC Fetch subscription at `/trpc/events`.

For Svelte component or rune-module work, use the project-local Svelte MCP server: discover relevant documentation with `list-sections`, read it with `get-documentation`, and run `svelte-autofixer` on changed `.svelte` or `.svelte.ts` files before finishing. Keep `pnpm check` as the project type check.
