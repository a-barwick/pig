# Client workspace split

Keep `App.svelte` as the parent that composes the workspace and coordinates navigation guards. Extract the current sections without changing the local pi workflow, transport, configuration ownership, or visual layout.

| Owner | Files | Responsibility |
| --- | --- | --- |
| Workspace controller | `src/client/workspace/workspaceController.svelte.ts` | Own the runtime snapshot, connection/SSE lifecycle, session list, recent projects, busy/error/notice state, and API commands. Instantiate once per `App`, not as a module singleton. Keep the current session/cursor, reconnect, and project-switch guards. |
| Project rail | `src/client/components/ProjectRail.svelte` | Render project input, recent projects, saved conversations, section selection, and inspector toggle. Own only the path input; receive data and callbacks from `App`. |
| Conversation | `src/client/components/ConversationPanel.svelte` and focused children | Render the empty state, transcript/tool calls, dialogs, and composer. Keep scroll-follow local to the transcript. The unsent message draft remains visible to `App` so navigation and unload guards work. |
| Existing sections | `Inspector.svelte`, `Workbench.svelte` | Keep their present responsibilities. The workbench continues to own skill/settings editing and reports dirty/trial events to `App`. |
| Integration | `App.svelte` | Create/dispose the controller; compose rail, conversation, inspector, and workbench; coordinate unsaved-draft confirmations and shell layout. Remove duplicated markup and API orchestration. |

The controller exposes reactive snapshot/connection/session/feedback values and commands for connect, open/resume, refresh sessions, send/steer/stop, model/thinking selection, dialog answers, trust, and adopting a skill trial. `App` decides whether navigation may discard a workbench or message draft before calling open/resume. Component interfaces should pass typed values and callbacks rather than importing a global controller.

Preserve current CSS classes, accessibility labels, visible states, tool inspection, and the distinction between accepted commands and completed runtime work. Keep workbench configuration actions in `Workbench`; do not move them into the runtime controller. After integration, run `pnpm check`, `pnpm test`, and `pnpm build`, then review the desktop and half-window browser layouts if the local UI is available.
