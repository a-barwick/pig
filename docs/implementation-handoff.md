# Personal pi GUI — implementation handoff

Build Austin's everyday local pi GUI. The first release should let him work in a real project conversation, inspect the harness behind it, edit a skill, and try that revision. Stop there and dogfood.

## Execute as one continuous build

One lead owns the whole release, from bootstrap through integration and real verification. The tracks below divide ownership; they are not separate approval gates or stopping points. Establish the browser/server interfaces, complete the runtime/UI/workbench tracks, integrate them, fix failures, and deliver the running app in the same implementation effort.

Use the documented stack and scope as the starting decisions. Resolve routine implementation details without sending them back to Austin. Raise a blocker only when missing access, a consequential action, or a material scope/architecture change needs his input. Keep working on independent tasks while a blocker is pending. Do not finish at a scaffold, a set of unintegrated branches, or a fixture-driven demo.

**Implementation entry prompt:**

> Implement the complete first release in docs/implementation-handoff.md, end to end. Use Svelte, TypeScript, a local Node server, tRPC/SSE, and the pi SDK. Follow design/pi-personal-workspace.html for the conversation/inspector and skill-workbench experience. Own bootstrap, all implementation tracks, integration, targeted tests, and a real pi smoke run. Make tool definitions and actual calls inspectable. Preserve my existing settings and credentials. Resolve routine choices yourself, report material blockers clearly, and continue until the app launches locally and the completion checks pass, or identify the exact external blocker. Commit the result, give me the launch command and URL, and stop for me to dogfood. Do not add the deferred features.

Implementation and acceptance evidence are recorded in [acceptance.md](acceptance.md). The release uses the pinned installed SDK 0.85.1; live provider and browser checks are separate from unit tests.

## Direction and scope

- **Platform:** local browser app, one user, one local process. No hosted service or desktop packaging.
- **UI:** chat with a harness inspector; opening a skill shows its editor beside the conversation. One sidebar holds projects and customization. No separate Run/Customize modes or recipe builder.
- **Reference:** `design/pi-personal-workspace.html`. Its messages, findings, files, and tool activity are examples. Never carry those into the real experience as apparent runtime output.
- **First release:** project selection by local path, new/resumed conversations, streamed text/thinking/tool activity, available-tool inspection, stop/steer, model/thinking selection, resource provenance, skill creation/editing, and scoped model/thinking defaults.
- **Defer:** multiple simultaneous agents, full IDE/file explorer, embedded terminal, attachments, session branching, general evals, package installation UI, themes/keybinding editors, and forms for all 65 settings. Keep the fuller sidebar as the intended organization; hide unavailable actions or label read-only sections clearly.
- **Personal first:** reuse Austin's installed pi configuration/auth on the server. Start authoring with a project-local skill and project overrides; global edits are deliberate UI choices. Never copy auth or sessions into this repo.

## Implementation defaults

Use **Svelte + TypeScript + Vite** for the client and a small Node/TypeScript server. Svelte is Austin's explicit preference. Prefer the coding-agent SDK rather than rebuilding pi from `pi-agent-core`. Start by verifying the locally installed `@earendil-works/pi-coding-agent` 0.85.1, pin the working dependency, and reuse its settings/resource/session behavior.

Keep one active agent session initially. Pi owns conversation persistence; the app only needs small local UI/project preferences. No database or framework for arbitrary providers/plugins. Choose ordinary UI dependencies as needed; the lead owns dependency/lockfile changes.

### How data moves

RPC describes calling remote functions; HTTP, SSE, and WebSocket describe how requests/events travel. They are not mutually exclusive choices.

| Boundary                            | Recommended approach                                                   | Reason                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Svelte browser → local Node server  | Typed RPC with tRPC's vanilla TypeScript client, over same-origin HTTP | Calls such as `sessions.send` and `skills.save` have checked inputs/outputs without separately handwritten client/server API types |
| Local Node server → browser updates | tRPC subscription over Server-Sent Events (SSE)                        | One ordered feed for response text, tool activity, and session state; no polling. Stop/steer travel as separate RPC calls          |
| Local Node server → pi              | Direct coding-agent SDK calls in the same process                      | Immediate access to sessions, tools, resources, and settings without another serialization layer                                   |

The implementation uses this transport; its HTTP/SSE access and delivery checks are recorded in acceptance.md. Use the vanilla tRPC client from Svelte; no React dependency or React query hooks. Input validation is still required even when TypeScript types agree.

**Alternatives worth distinguishing:** WebSocket supports bidirectional messages over a persistent connection and could fit future terminal/audio interaction. It is not needed solely to stream text and send cancellation commands. Pi's own `--mode rpc` instead uses JSON lines over a child process's stdin/stdout; it is useful if we want a separately managed pi process or need the installed CLI as the runtime. That is a server-to-pi decision, independent of browser transport. If the SDK proves unsuitable, report the concrete reason before switching this boundary.

SvelteKit remote functions are another typed RPC-style option over generated HTTP endpoints if we choose SvelteKit. They are marked experimental in the docs checked for this plan; do not introduce both that mechanism and tRPC. Sources: [tRPC concepts](https://trpc.io/docs/concepts), [SSE subscriptions](https://trpc.io/docs/client/links/httpSubscriptionLink), [SvelteKit remote functions](https://svelte.dev/docs/kit/remote-functions), [pi RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md), [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).

The server can write local files and run pi tools: bind loopback, validate Host/Origin, protect mutation and event access with a local session mechanism, and never expose credentials to browser responses or logs. Keep file-management endpoints limited to their intended configuration/resource targets. Pi tool execution still has the host process's permissions; project trust, tool selection, and scratch directories are not sandboxes.

## Tool transparency

The GUI should let Austin see what pi can do and what it actually did, with a readable summary and expandable detail.

- **Available tools:** names, descriptions, input schemas, active/inactive status where known, and source (built-in or extension, including its path when available). This comes from the current runtime, not a hardcoded list of expected tools. Mark source information unknown if pi cannot establish it.
- **Each tool call:** tool name and call ID, actual arguments, running/completed/failed/cancelled state, elapsed time, streamed output where available, and final results/errors. Keep repeated calls distinguishable. Display a requested cancellation separately from a confirmed cancellation.
- **Useful output views:** show shell commands and exit status, file paths and edit diffs when provided, plus expandable raw structured arguments/results. Do not replace original evidence with an AI summary or imply every tool returns a diff. Explicitly label missing, redacted, truncated, or unavailable output.
- **Link the two:** clicking a call opens its tool definition/source. Tools & extensions opens the available-tool inventory even before any call runs. Tool availability is separate from permissions and project trust.

This is part of the first usable conversation experience, not a later observability dashboard. Keep raw views local and omit known credentials; do not add automatic exports or telemetry.

## Sequence and ownership

| Thread                        | Owns                                                                                                         | Depends on | Handoff evidence                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **0 — Lead / bootstrap**      | Root tooling, dependencies, shared event/data types, RPC router composition, server composition, integration | Nothing    | App starts locally, SDK import/session creation works, browser/server interfaces below are defined, ownership is assigned |
| **1 — Pi runtime**            | `src/server/runtime/`, session commands/events, tool inventory and call data, runtime tests                  | 0          | One real conversation streams; tools are inspectable; cancel, steer, and resume work; failures reach the browser          |
| **2 — App experience**        | Client shell, conversation, inspector, API client; excludes workbench feature files                          | 0          | Conversation and workbench layouts work against the shared contract; real runtime replaces isolated development fixtures  |
| **3 — Harness workbench**     | `src/server/config/`, `src/client/features/workbench/`, config/skill tests                                   | 0          | One skill and scoped defaults round-trip without unrelated changes; revision can be used in a fresh session               |
| **4 — Integration / dogfood** | Lead integrates 1–3; scoped fixes assigned back to owners                                                    | 1–3        | Verified real edit → run → inspect loop, launch instructions, limitations, clean commits                                  |

Threads 1–3 can work in parallel **after** thread 0 commits the scaffold and browser/server interfaces below. Do not independently create three apps or replace each other's package manifests. Agree boundary changes with the lead before editing another owner's files. Use separate branches/worktrees when the dispatching thread provisions them; if sharing a checkout, maintain strict path ownership and stage only your own files.

## Interfaces shared by the browser and local server

“Shared contract” means the data and behavior that the Svelte UI and Node server agree on for a particular operation. It exists so the runtime, UI, and workbench threads can connect their work without guessing different request shapes or meanings. It is not a separate platform or a generic contract for all pi integrations.

| Interface for                                | Shared between                                | What must agree                                                                                                                            | Why it matters                                                                                                   |
| -------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Opening a project and inspecting the harness | Runtime/config services and browser inspector | Project path, active session, model/thinking, loaded or skipped resources and reasons, configuration sources                               | The UI must show what pi actually loaded, not merely what files exist                                            |
| Sending, stopping, steering, and resuming    | Runtime service and conversation UI           | Inputs, session/request IDs, accepted/rejected response, subsequent completion/error events                                                | “Message accepted” must not appear as “agent finished”; late events must not update another conversation         |
| Streaming messages and tool execution        | Runtime service and conversation/tool views   | Ordered event kinds and payloads, stable message/tool-call IDs, reconnect snapshot/cursor                                                  | The UI must assemble partial output correctly and distinguish repeated calls without rerunning work on reconnect |
| Inspecting available tools                   | Runtime registry and Tools & extensions view  | Tool names, descriptions, schemas, active state, and available source metadata                                                             | Austin can see the capabilities offered to the model and connect a call to its definition                        |
| Editing skills and settings                  | Config service and workbench UI               | Read result with file revision, draft/save input with destination/scope and expected revision, conflict/error result, saved/applied status | The UI must save the intended file without losing an outside edit or claiming the running agent already uses it  |
| Trying a saved skill                         | Config service, runtime service, workbench UI | Saved revision, target project/session, explicit invocation, actual load evidence                                                          | Austin can tell which version was tried and distinguish invocation from successful instruction-following         |
| Answering an extension dialog                | Runtime service and browser dialog UI         | Request ID, supported fields, response/cancel result                                                                                       | An extension must not leave the agent waiting on a terminal dialog that the browser cannot show                  |

For example, `sessions.send({ sessionId, requestId, text })` returning “accepted” means the runtime queued or began handling the prompt; later events describe progress and completion. `skills.save({ resourceId, expectedRevision, content })` either returns the new saved revision or a conflict/error; it never silently overwrites a newer file. These are app-level examples, not native pi SDK signatures.

Bootstrap defines the small tRPC router and input validators, infers client request/response types from it, and puts reusable serializable event/data types in `src/shared/`. Do not duplicate the entire router in a separate schema package. Include one example serialized tool lifecycle and one save-conflict result so the other threads can exercise the same meanings. Runtime SDK objects, credential state, and Node-only imports stay on the server.

Do not import Node-only pi SDK modules into the browser. Do not invent a generic extension configuration schema. Where pi cannot report provenance directly, label app-derived information accurately.

## Completion checks that matter

1. Open a real project, use an existing configured model, and see actual streamed text and tool output. Stop a running turn, send a steering message, and resume the saved conversation after server restart. Loading history must not rerun tools.
2. Create a project skill with a name, description, and instructions; save it as a real `SKILL.md`. Edit it, review the diff, save, and invoke that saved revision in a fresh conversation. Show evidence of the invocation/loading without claiming the model obeyed every instruction.
3. **A project setting can differ from your usual default without changing it.** Start with a global thinking default of High and no per-model override for the selected model. Set this project to Medium. The UI must show Medium for this project while the global file still says High. Choose “Use my default”; the project entry is removed and the UI shows High again. Verify in a fresh session so a running session's temporary choice does not obscure the result.
4. **Show when pi has not loaded a project's skills or extensions, and why.** Open a test project with no saved trust decision, using pi's `ask` fallback. The GUI must say its project-local skills/extensions are not loaded and show the reason, rather than marking them active. If Austin explicitly chooses to trust that folder, reload or start a fresh session as required and verify the resources are now loaded. Do not grant trust automatically or change his trust policy for other projects. Do not describe this as denying all project file access.
5. Check the actual browser UI at desktop and half-window widths, including streaming, error, empty, disconnected, unsaved-draft, and pending-dialog states. The current mockup has only static validation; visual verification is outstanding.
6. **Saving changes preserves everything else.** Change one setting and confirm unrelated settings/metadata remain unchanged. Edit the same file outside the app before saving; the app must show a conflict and keep the draft. Failed save/undo/reload must leave an understandable error and a recoverable draft.
7. **Tool behavior is inspectable.** From an actual tool call, inspect its definition, arguments, output, status, and file diff or exit status when applicable. Exercise a successful and a failed call. Confirm the tool inventory matches the active runtime and that partial or unavailable output is labeled accurately.

Use targeted tests for config preservation/conflicts, session event ordering/cancel/resume, and local server access boundaries. Keep fake responses in explicit tests or development stories. Verify the real end-to-end path separately; report if auth or provider access blocks it. A passing test suite is not a completed dogfood run.

## Copy/paste thread prompts

The implementation entry prompt above is sufficient for one lead to build everything. The prompts below are optional assignments when work is split among threads. Give each thread the same repository/worktree location and `docs/implementation-handoff.md`; the lead remains responsible for integration and does not stop after handing off the bootstrap. The integrated build used the visible Herdr tracks pi-runtime, pi-ui, and pi-workbench.

### Thread 0 — Lead / bootstrap

> Implement the bootstrap in docs/implementation-handoff.md for Austin's personal pi GUI. Establish the Svelte/TypeScript client and Node server, verify pi SDK access and the proposed tRPC/SSE transport, and define the browser/server operation and event interfaces before parallel work. Own dependencies and integration. Use chat with an inspector and a side-by-side workbench when editing. Keep the first slice to a real conversation, transparent tool activity, and skill customization. Hand off a working base commit, typed interfaces with example payloads, and exact commands to threads 1–3.

### Thread 1 — Pi runtime

> Implement the pi runtime track in docs/implementation-handoff.md against the lead's base commit and browser/server interfaces. Own src/server/runtime/ and its tests. Reuse pi sessions/auth/resources; expose the actual tool registry and call arguments/results; stream events; support send/steer/cancel/resume and model selection. Handle project trust and extension dialogs explicitly. Do not alter shared dependencies or UI. Return commits, tested behavior, and any blocked real-provider check.

### Thread 2 — App experience

> Implement the Svelte client experience in docs/implementation-handoff.md against the browser/server interfaces. Use design/pi-personal-workspace.html as the layout reference, not as production code or runtime data. Own shell, conversation, inspector, tool inventory/detail views, and client transport; coordinate the workbench mount with thread 3. Make actual tool arguments/results and streaming/error states inspectable at desktop and half-window widths. Keep fixtures isolated and report visual checks and integration gaps.

### Thread 3 — Harness workbench

> Implement the harness track in docs/implementation-handoff.md. Own src/server/config/, src/client/features/workbench/, and focused tests. Deliver skill discovery/create/edit/diff/save and scoped model/thinking defaults with source provenance, conflict detection, unknown-field preservation, and undo last save. Wire a known skill revision into the runtime's fresh-session flow. Do not expose secrets or build a package marketplace. Return commits and real round-trip evidence.

### Thread 4 — Integration / dogfood

> Integrate the three tracks and complete the checks in docs/implementation-handoff.md. Prioritize bugs that break Austin's real conversation or skill-editing loop. Verify a real model turn, cancellation/resume, and a saved skill invocation; check the actual UI. Record what is implemented, tested, visually checked, and still blocked. Commit the integrated slice, provide a simple local launch command, and stop for Austin to dogfood before expanding scope.

## Herdr dispatch notes

Read the installed Herdr skill at `/Users/austinbarwick/.agents/skills/herdr/SKILL.md` when dispatching through Herdr. Verify caller context and current CLI help at dispatch time; never assume pane IDs or server state from this document.

Future dispatching threads should read the skill, preserve user focus, use discovered IDs, and start only the assigned tracks. Worktrees/tabs are optional coordination choices requiring the requested topology; the installed skill defaults to sibling panes in the current directory. An agent reporting done is a handoff signal, not integration or acceptance evidence.

## References

- [Deferred idea: skill evals](future.md) — recorded for later; no implementation in this slice.
- [Configuration inventory](pi-configuration.md) and [installed settings reference](settings-reference.md).
- [Community setups](community-setups.md): inspiration only; no package installation is required for this slice.
- Installed package `docs/sdk.md`, `docs/rpc.md`, `docs/settings.md`, and `docs/skills.md` are the immediate API references. Recheck against the dependency actually used by implementation.
- [Upstream SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) and [RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).
