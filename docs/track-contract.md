# Active implementation contract

Lead owns root tooling/dependencies, src/shared/, src/server/router.ts, src/server/http.ts, src/server/index.ts, integration tests and final verification. Shared types are in src/shared/contracts.ts; router is the actual browser API. Request contract adjustments from lead; do not edit shared files.

Runtime owns only src/server/runtime/**. Export async createRuntimeService(): Promise<RuntimeService> from index.ts. Config owns only src/server/config/** and src/client/features/workbench/**. Export createConfigService(): ConfigService from server index.ts. UI owns src/client/** excluding features/workbench/\*\*. All use the shared checkout and stage only owned files. Do not edit dependencies or lockfile. Keep tests inside owned directories.

Workbench mount: default export Workbench.svelte with props { projectPath: string; section: 'skills'|'settings'; ontrial: (snapshot: Snapshot)=>void; ondirty?: (dirty: boolean)=>void }. Imports API from src/client/api.ts, which UI owns and exports `api` (vanilla typed tRPC client). Workbench may exist alongside conversation. UI warns before navigation that would discard drafts.

Streaming contract: events sends complete authoritative snapshots on meaningful SDK deltas (can coalesce briefly); cursor monotonic across runtime life, sessionId gates late events. A new subscription immediately sends current snapshot for reconnect. No turn replay. `accepted` acknowledges only submission. `cancel_requested`/stopping is distinct from confirmed completion. Snapshot retains actual call arguments/results and definitions. Server routes use inferred tRPC types.

Skill resourceId is its canonical absolute SKILL.md path, constrained by config service to discovered/allowed resources. Revision is SHA256 of bytes. ExpectedRevision null means create only. Trial must verify revision and actual loaded resource, start fresh session, and explicitly invoke /skill:name with the provided prompt. It must not bypass trust.

Run pnpm check, pnpm test, pnpm build. Lead owns installing packages. pi pinned 0.85.1; inspect node_modules/@earendil-works/pi-coding-agent/docs/sdk.md and declarations for installed behavior. Never print credentials or copy global settings/sessions into checkout. Do not modify live config in smoke tests; use temporary agent dirs for destructive cases.
