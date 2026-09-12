# Pi Dashboard

A local browser GUI for Austin's everyday pi conversations and harness customization. Chat with an inspector is the default; opening a skill brings up its editor beside the conversation.

Frontend: Svelte. Tool definitions, actual calls, arguments, and results should be inspectable; the UI follows pi's transparency and simplicity.

**Stage: implementation handoff ready.** The repository contains the current plan, one interactive mockup, and pi reference material. No application runtime or live pi configuration changes have been implemented.

## Start here

- **[Implementation handoff](docs/implementation-handoff.md)** — start with its single implementation entry prompt. It covers the complete build, ownership, and completion checks; separate thread prompts are optional.
- **Current mockup:** `design/pi-personal-workspace.html`. Open Skills or “Edit the review skill” to move from conversation to the workbench. Sidebar navigation, draft review, tool details, and trial previews are interactive.

## Reference material

These describe pi's capabilities and ecosystem, not additional implementation requirements.

- [Pi configuration inventory](docs/pi-configuration.md)
- [Complete installed settings reference](docs/settings-reference.md)
- [Community setups and UI precedents](docs/community-setups.md)
- Machine-readable settings snapshot: `research/settings-0.85.1.json`.
- [Deferred ideas](docs/future.md): skill evals, explicitly outside the current slice.

Research baseline: locally installed `@earendil-works/pi-coding-agent` **0.85.1**, checked September 12, 2026. Older articles often refer to `@mariozechner/pi-coding-agent` and `badlogic/pi-mono`; the current upstream is [earendil-works/pi](https://github.com/earendil-works/pi).

## Validation status

The mockup uses illustrative messages, files, skill content, and local-only interactions. It does not read or write pi settings, install extensions, or call a model. Drafts reset when navigating between screens.

JavaScript syntax, static element references, and documentation links are checked. Browser automation could not connect during preview checks, so rendered layout and live click behavior remain unverified. Implementation and real-provider dogfooding have not started.

Local Git repository only. No GitHub remote or deployment has been created.
