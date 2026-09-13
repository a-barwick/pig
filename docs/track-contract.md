# Active implementation contract

Lead owns root tooling/dependencies, `src/lib/shared/`, the server router/service owner, Kit hooks/routes, integration tests and final verification. Shared types are in `src/lib/shared/contracts.ts`; the router is the actual browser API. Agree cross-boundary changes with the lead before editing shared files.

When work is delegated, runtime owns `src/lib/server/runtime/`, config owns `src/lib/server/config/` and the agreed workbench files, and UI owns `src/lib/client/` outside that assignment. Keep the testable `createRuntimeService()` and `createConfigService()` factories. Use isolated worktrees with disjoint ownership and stage explicit paths. The lead owns dependency/lockfile edits and integration; tests remain with their owned modules.

Workbench mount: default export Workbench.svelte with props { projectPath: string; section: 'skills'|'settings'; ontrial: (snapshot: Snapshot)=>void; ondirty?: (dirty: boolean)=>void }. Imports API from `src/lib/client/api.ts`, which exports `api` (vanilla typed tRPC client). Workbench may exist alongside conversation. UI warns before navigation that would discard drafts. Kit's page passes its initial redacted snapshot to a controller per workspace; browser storage and SSE start after mount.

Streaming contract: events sends complete authoritative snapshots on meaningful SDK deltas (can coalesce briefly); cursor monotonic across runtime life, sessionId gates late events. A new subscription immediately sends current snapshot for reconnect. No turn replay. `accepted` acknowledges only submission. `cancel_requested`/stopping is distinct from confirmed completion. Snapshot retains actual call arguments/results and definitions. Server routes use inferred tRPC types.

Skill resourceId is its canonical absolute SKILL.md path, constrained by config service to discovered/allowed resources. Revision is SHA256 of bytes. ExpectedRevision null means create only. Trial must verify revision and actual loaded resource, start fresh session, and explicitly invoke /skill:name with the provided prompt. It must not bypass trust.

Run pnpm check, pnpm test, pnpm build. Lead owns installing packages. pi pinned 0.85.1; inspect node_modules/@earendil-works/pi-coding-agent/docs/sdk.md and declarations for installed behavior. Never print credentials or copy global settings/sessions into checkout. Do not modify live config in smoke tests; use temporary agent dirs for destructive cases.
