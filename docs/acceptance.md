# First-slice acceptance — September 12, 2026

The integrated app uses Svelte/TypeScript, the local Node server, typed tRPC HTTP calls and an SSE subscription, and `@earendil-works/pi-coding-agent` pinned to 0.85.1. The main implementation ran in visible Herdr agents `pi-runtime`, `pi-ui`, and `pi-workbench`; the lead owned contracts, dependencies, integration and final verification.

## Automated checks

After the pnpm switch and localhost fix, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` (35 tests), and `pnpm build` passed. A production server returned HTTP 200 for both `localhost` and `127.0.0.1` on loopback. The original first-slice checks below remain historical evidence.

- `npm run check`: zero errors and zero warnings.
- `npm test`: 34 tests passed across config preservation/conflicts, runtime lifecycle/trust/dialogs/redaction, tool result presentation, and HTTP/SSE access boundaries.
- `npm run build`: production Svelte bundle built successfully.
- Production dependency audit: zero reported vulnerabilities at installation time.

## Real acceptance evidence

| Handoff check | Evidence |
| --- | --- |
| Real conversation and tools | Existing authenticated `openai-codex/gpt-5.6-sol` streamed a real response. The live smoke performed separate successful and failed bash calls, retaining actual arguments, outputs and distinct IDs. |
| Stop, steer and resume | A running `sleep 30` tool was stopped with a steering message accepted, both through the service and through the actual browser controls. The session returned idle. The same saved history resumed without tool execution after replacing the runtime, and the browser resumed it after an actual server process restart. |
| Create, edit and invoke skill | Browser created `SKILL.md`, reviewed a real diff, saved, edited and invoked a new revision. The model returned `BROWSER_REVISION_OK`. Separate final smoke invoked saved revision `fc18ef4fc06291a085cb9e85aba63ed62288cb6b75bef8251556949e468629ce`; pi's expanded skill block was observed in the actual user message and the model returned `SKILL_REVISION_TWO`. Loading evidence is not a general assertion of instruction-following. |
| Scoped defaults | With isolated global High and no per-model override, a project Medium override appeared in a fresh session. Removing it restored High. Global bytes remained identical. Tests also cover per-model precedence, partial provider/model defaults, and unknown-field preservation. |
| Trust | An undecided project using `ask` exposed skipped project resources and the reason. Explicit trust in the temporary agent directory loaded its skill in a fresh session. No trust decision was added to Austin's real agent directory by acceptance tests. |
| Conflicts and recovery | Actual outside edits caused save conflicts and preserved the browser draft. Reload/review/save recovered and produced the invoked revision. Tests cover undo, invalid JSON, stale revisions, and symlink boundaries. |
| Browser experience | Actual Chrome inspected at 1440×1000 and 760×900: empty state, populated conversation, live running tool/steer/stop, tool/schema inspection, editor/diff, saved trial, settings, persistent error, disconnect/reconnect, and a real extension input dialog. Half-window checks found no horizontal overflow. Standard dialog response returned the runtime to idle. No browser JavaScript errors in the completed recovery run. |
| Configuration preservation | Live runs used temporary settings/trust/session directories and injected the existing authenticated model runtime. Austin's actual global settings compared byte-for-byte equal before/after. Auth was used through pi and never copied into the checkout. |

Local evidence is in `/tmp/pi-dashboard-smoke-final.log`, `/tmp/pi-dashboard-recovery.log`, and `/tmp/pi-dashboard-browser/` screenshots. These are local acceptance artifacts, not production fixtures or repository session exports. `scripts/smoke.ts` reruns the live-provider path explicitly. Browser helper scripts require a temporary acceptance project and the documented test-server helper.

## Integration fixes verified

Startup hooks now report running until ready and can surface dialogs without blocking the browser. Resume comparisons canonicalize macOS path aliases. Missing recorded tool outcomes are unknown, not perpetually running. Cancellation requests remain distinct from tool outcomes. Reconnect renews the local session cookie after restart, keeps drafts/history readable, and requires opening/resuming an active session before sending. Failed project-open errors survive the automatic reconnect. Session titles and inspectors have bounded scrolling so expanded skill text does not consume the workspace.

## Intentional limits

One active session; no deferred terminals, attachments, branching, marketplace, or hosted deployment. Custom terminal extension components fail explicitly. Workbench authoring is limited to discovered local resources, and undo lasts only for the server process. Config writes preserve unknown values but normalize JSON formatting; noncooperating simultaneous filesystem writers can race a final rename. Recognized credentials are redacted in displayed evidence. Pi tools retain the launching process's permissions.
