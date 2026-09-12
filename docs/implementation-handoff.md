# Personal pi GUI — implementation handoff

Build Austin's everyday local pi GUI. The first release should let him work in a real project conversation, inspect the harness behind it, edit a skill, and try that revision. Stop there and dogfood.

## Direction and scope

- **Platform:** local browser app, one user, one local process. No hosted service or desktop packaging.
- **Working UI direction:** concept B (chat + inspector), opening concept C's editor/conversation layout for customization. This is our interpretation of Austin's positive review, not a mandate to reproduce every pixel.
- **Reference:** `design/pi-personal-workspace.html`. Its messages, findings, files, and tool activity are examples. Never carry those into the real experience as apparent runtime output.
- **First release:** project selection by local path, new/resumed conversations, streamed text/thinking/tool activity, stop/steer, model/thinking selection, resource provenance, skill editing, and scoped model/thinking defaults.
- **Defer:** multiple simultaneous agents, full IDE/file explorer, embedded terminal, attachments, session branching, general evals, package installation UI, themes/keybinding editors, and forms for all 65 settings. Keep the fuller sidebar as the intended organization; hide unavailable actions or label read-only sections clearly.
- **Personal first:** reuse Austin's installed pi configuration/auth on the server. Start authoring with a project-local skill and project overrides; global edits are deliberate UI choices. Never copy auth or sessions into this repo.

## Implementation defaults

Use React + TypeScript + Vite for the client and a small Node/TypeScript server. Prefer the coding-agent SDK rather than rebuilding pi from `pi-agent-core`. Start by verifying the locally installed `@earendil-works/pi-coding-agent` 0.85.1, pin the working dependency, and reuse its settings/resource/session behavior. These are practical defaults; if the bootstrap finds a concrete SDK blocker, report the evidence and propose RPC before spreading a workaround through the app.

Use same-origin HTTP commands and an event stream, with one active agent session initially. Pi owns conversation persistence; the app only needs small local UI/project preferences. No database or framework for arbitrary providers/plugins. Choose ordinary UI dependencies as needed; the lead owns dependency/lockfile changes.

The server can write local files and run pi tools: bind loopback, validate Host/Origin, protect mutation and event access with a local session mechanism, and never expose credentials to browser responses or logs. Keep file-management endpoints limited to their intended configuration/resource targets. Pi tool execution still has the host process's permissions; project trust, tool selection, and scratch directories are not sandboxes.

## Sequence and ownership

| Thread | Owns | Depends on | Handoff evidence |
| --- | --- | --- | --- |
| **0 — Lead / bootstrap** | Root tooling, dependencies, `src/shared/`, server composition, integration | Nothing | App starts locally, SDK import/session creation works, shared contract is written, ownership is assigned |
| **1 — Pi runtime** | `src/server/runtime/`, session commands/events, runtime tests | 0 | One real conversation streams; cancel, steer, and resume work; failures reach the UI contract |
| **2 — App experience** | Client shell, conversation, inspector, API client; excludes workbench feature files | 0 | B/C layout works against the shared contract; real runtime replaces isolated development fixtures |
| **3 — Harness workbench** | `src/server/config/`, `src/client/features/workbench/`, config/skill tests | 0 | One skill and scoped defaults round-trip without unrelated changes; revision can be used in a fresh session |
| **4 — Integration / dogfood** | Lead integrates 1–3; scoped fixes assigned back to owners | 1–3 | Verified real edit → run → inspect loop, launch instructions, limitations, clean commits |

Threads 1–3 can work in parallel **after** thread 0 commits the scaffold and shared contract. Do not independently create three apps or replace each other's package manifests. Agree boundary changes with the lead before editing another owner's files. Use separate branches/worktrees when the dispatching thread provisions them; if sharing a checkout, maintain strict path ownership and stage only your own files.

## Shared contract to settle during bootstrap

Keep this small and typed; the lead owns the final shape in `src/shared/`:

- **Project/runtime snapshot:** canonical project path, pi version, trust/load status, active session, available models and supported thinking levels, effective selection, resource sources and diagnostics.
- **Session operations:** list/create/resume, send, steer, cancel, select model/thinking. Every request and event identifies its session so a late event cannot update a different conversation.
- **Conversation delivery:** snapshot plus ordered events for messages, thinking, tool start/update/end, idle, cancellation, and errors. Define reconnect/resubscribe behavior without replaying a user prompt. Preserve useful pi tool details; do not pretend all tools return file diffs.
- **Extension interaction:** support basic requested dialogs or return an explicit unsupported/cancel result; never leave a session silently waiting on an invisible terminal UI.
- **Resource/config operations:** list and read, draft preview, scope/destination, save with expected file revision, undo the app's last save, effective/inherited values, and reset a project override. Return actual saved-versus-applied status.
- **Try skill:** save or select a known revision, then open a fresh conversation with explicit invocation. Identify the revision and effective setup; distinguish explicit invocation from observed skill reads and automatic discovery.

Do not import Node-only pi SDK modules into the browser. Do not invent a generic extension configuration schema. Where pi cannot report provenance directly, label app-derived information accurately.

## Completion checks that matter

1. Open a real project, use an existing configured model, and see actual streamed text and tool output. Stop a running turn, send a steering message, and resume the saved conversation after server restart. Loading history must not rerun tools.
2. Edit a project skill, review its diff, save it, and invoke that saved revision in a fresh conversation. Show evidence of the invocation/loading without claiming the model obeyed every instruction.
3. Change a project thinking/model default, then remove the override and see inheritance return. Preserve unknown JSON/frontmatter and unrelated nested keys; detect concurrent file edits before overwriting. A save, undo, or reload failure remains visible and does not erase the user's draft.
4. Report untrusted/ignored project resources honestly. Do not silently trust everything to pass the trial. Inherited global resources and credentials stay intact.
5. Check the actual browser UI at desktop and half-window widths, including streaming, error, empty, disconnected, unsaved-draft, and pending-dialog states. Previous mockups passed syntax checks but browser automation timed out; visual verification is outstanding.

Use targeted tests for config preservation/conflicts, session event ordering/cancel/resume, and local server access boundaries. Keep fake responses in explicit tests or development stories. Verify the real end-to-end path separately; report if auth or provider access blocks it. A passing test suite is not a completed dogfood run.

## Copy/paste thread prompts

Give each thread the same repository/worktree location and `docs/implementation-handoff.md`. These prompts assign implementation only when Austin dispatches them; no agents were launched while preparing this plan.

### Thread 0 — Lead / bootstrap

> Implement the bootstrap in docs/implementation-handoff.md for Austin's personal pi GUI. Establish the small client/server app, verify the installed pi SDK, commit the shared contract, and assign paths before parallel work. Own dependencies and integration. Use B as the everyday layout and C for editing. Keep the first slice to a real conversation plus skill customization; avoid productization. Hand off a working base commit, contract, and exact commands to threads 1–3.

### Thread 1 — Pi runtime

> Implement the pi runtime track in docs/implementation-handoff.md against the lead's base commit and shared contract. Own src/server/runtime/ and its tests. Reuse pi sessions/auth/resources, stream real events, and support send/steer/cancel/resume plus model selection. Handle project trust and extension dialogs explicitly. Do not alter shared dependencies or UI. Return commits, tested behavior, and any blocked real-provider check.

### Thread 2 — App experience

> Implement the client experience in docs/implementation-handoff.md against the agreed contract. Use design/pi-personal-workspace.html as B/C layout reference, not as production code or runtime data. Own shell, conversation, inspector, and client transport; coordinate the workbench mount with thread 3. Make real streaming/tool/error states usable at desktop and half-window widths. Keep fixtures isolated and report visual checks and integration gaps.

### Thread 3 — Harness workbench

> Implement the harness track in docs/implementation-handoff.md. Own src/server/config/, src/client/features/workbench/, and focused tests. Deliver skill discovery/edit/diff/save and scoped model/thinking defaults with source provenance, conflict detection, unknown-field preservation, and undo last save. Wire a known skill revision into the runtime's fresh-session flow. Do not expose secrets or build a package marketplace. Return commits and real round-trip evidence.

### Thread 4 — Integration / dogfood

> Integrate the three tracks and complete the checks in docs/implementation-handoff.md. Prioritize bugs that break Austin's real conversation or skill-editing loop. Verify a real model turn, cancellation/resume, and a saved skill invocation; check the actual UI. Record what is implemented, tested, visually checked, and still blocked. Commit the integrated slice, provide a simple local launch command, and stop for Austin to dogfood before expanding scope.

## Herdr dispatch notes

Herdr skill installed at `/Users/austinbarwick/.agents/skills/herdr/SKILL.md`; CLI 0.9.0 and `HERDR_ENV=1` verified in this planning session. Re-check caller context and current CLI help at dispatch time; do not assume pane IDs or server state from this note.

No Herdr topology or agents have been created. A dispatching thread should read the skill, preserve user focus, use discovered IDs, and start only the assigned tracks. Worktrees/tabs are optional coordination choices requiring the requested topology; the installed skill defaults to sibling panes in the current directory. An agent reporting done is a handoff signal, not integration or acceptance evidence.

## References

- [Configuration inventory](pi-configuration.md) and [installed settings reference](settings-reference.md).
- [Community setups](community-setups.md): inspiration only; no package installation is required for this slice.
- Installed package `docs/sdk.md`, `docs/rpc.md`, `docs/settings.md`, and `docs/skills.md` are the immediate API references. Recheck against the dependency actually used by implementation.
- [Upstream SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) and [RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).
