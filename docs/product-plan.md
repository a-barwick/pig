# Product proposal

Status: for discussion, not an approved implementation specification.

## The useful loop

Open a project → see which skills and settings pi actually uses → change a skill or setting → review the file change → run a real trial → inspect whether the skill loaded and what it did → revise.

The central product is a **harness workshop**. A skill editor and an explanation of effective configuration should be first-class. A full chat client can come later if the trial pane proves useful enough to grow into one.

## First experience

1. Select a project folder and identify pi version/config root.
2. Show global and project resources, their paths, and whether project trust allows them to load. Reading a file is distinct from executing its extensions.
3. Create or edit one skill: name, description, instructions, supporting files, and automatic discovery versus explicit invocation. Show Markdown alongside a human-readable preview.
4. Choose the write scope. Review a small diff, save to a real `SKILL.md`, and report the destination. Preserve an undo copy and detect a concurrent edit before overwriting.
5. Select an existing available provider/model and a supported thinking level. Inherited values should have an explicit “Override here” action and a way to remove that override.
6. Start a fresh trial against an explicitly chosen working directory, with the selected skill invoked directly. Render real responses and tool events; allow cancellation. A successful trial means evidence of behavior, not merely that the API returned text.
7. Record a lightweight local trial note: prompt, skill revision, effective model/settings, actual skill read/invocation evidence, and Austin's assessment. Avoid building an evaluation platform.

An isolated config directory can separate trial configuration using `PI_CODING_AGENT_DIR`; it is **not** a filesystem sandbox. A scratch working directory likewise does not constrain shell access. Do not label either as a sandbox.

## Suggested first scope

| Include in the first usable slice | Defer until observed need |
| --- | --- |
| Skill list, source path, Markdown editor, basic frontmatter feedback | AI-generated skill marketplace and automated quality scoring |
| Global/project model and thinking settings, effective value and override removal | Dedicated forms for every advanced pi setting |
| Review diff, save, reload/fresh-trial status, undo last save | General version-control client and elaborate migrations |
| One real trial, streaming tool events, stop button | Fleet management, workflow graphs, scheduling |
| Reuse existing pi auth without exposing credentials | Multi-user accounts, cloud sync, billing |
| Unknown JSON fields preserved; advanced raw view | Forking pi or rebuilding its agent loop |

Skill validation should follow pi's actual leniency: warn about portability where appropriate, avoid rejecting files pi supports. An `allowed-tools` declaration in a skill is not an OS permission boundary.

## Architecture choices for Austin

| Option | Benefit | Cost / consequence |
| --- | --- | --- |
| Local browser UI + small Node/TypeScript process | Shortest route to local file editing and a real pi trial; no packaging step | Requires launching a local process; keep service on loopback with origin/session protections because it can write files and launch tools |
| Electron desktop app + Node runtime | Desktop window, file pickers, app lifecycle; straightforward pi SDK integration | Packaging and runtime size; more work before the core loop |
| SwiftUI Mac app + pi subprocess | Strongest native Mac experience | Separate Swift/TypeScript boundaries and more work for rich editors/transcripts |
| Tauri desktop shell + pi sidecar | Desktop shell with web-based editor | Sidecar packaging and lifecycle across two runtimes |
| VS Code extension | Existing editor, diff, project picker | Couples the workshop to the IDE; less suitable if pi is used outside VS Code |

**Selected platform:** Austin chose a local browser app during ideation. Proposed host: a small TypeScript process using the pi SDK. Framework and SDK-versus-RPC choice remain proposals; no application dependencies have been installed.

### pi integration

- **SDK (`createAgentSession`, `SettingsManager`, resource loader):** recommended for a TypeScript host that will deeply edit and inspect harness resources. Reuse pi's loader/merging behavior where possible. Settings setters default to global writes, so the adapter must make the intended scope explicit and surface I/O errors.
- **RPC subprocess (`pi --mode rpc`):** attractive when using the installed pi or a native host. Provides streamed events, session/model commands, and extension dialog messages. Implement pending dialog responses/cancel behavior so extensions cannot leave trials waiting indefinitely.
- **Lower-level `pi-agent-core` / `pi-ai`:** useful for an entirely custom agent, but rebuilding skill/config/session loading does not earn its place in this MVP.

Both approaches require explicit treatment of project trust. In 0.85.1 an untrusted project can have local resources ignored in non-interactive mode. Do not silently pass `--approve` to make a broken demo look functional. Surface whether the selected trial will load project resources.

Terminal extension UI does not automatically become graphical UI: RPC's `custom()` and terminal footer/editor APIs are unsupported or degraded. Inspect selected extensions individually and expose compatibility as “not checked” until exercised. SDK use alone does not solve TUI rendering.

Sources: [SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), [RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md), [project trust](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md#project-trust).

## Proposed delivery after ideation

1. Confirm UI direction, platform, and whether the first trial should reuse the current global setup or use a separate experimental config root.
2. Build the real skill edit/save/invoke loop plus model/thinking overrides. Verify round-trip preservation and a real trial with Austin's selected model.
3. Dogfood on one skill Austin actually wants. Stop and assess what made authoring or diagnosing it difficult.
4. Add the next configuration family or package workflow based on that experience.

Acceptance evidence: edit one skill through the GUI; see the exact file change; invoke that revision in pi; inspect real response/tool activity; remove a project override and observe inheritance return. A canned response or UI-only save does not satisfy this.

## Decisions still open

- Platform decided: local browser app.
- Workbench, compact settings, or recipe builder as the main navigation?
- Manage the everyday harness directly, or start with a separately named experiment?
- What is the first useful skill to author? Suggested starting point: a project-aware review or research workflow Austin already performs.

No live pi changes, inference runs, package installation, remote publication, or application implementation are part of this stage.
