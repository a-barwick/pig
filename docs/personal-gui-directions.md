# Personal pi GUI — second concept round

Austin selected the workbench direction, asked to expand it toward an everyday pi GUI, and confirmed that this is for his own use first. Platform remains a local browser app. This broadens the proposed product direction, not authorization to start runtime implementation.

## A — Two spaces

Run holds projects, conversations, tool activity, and the composer. Customize holds Skills, Instructions, Prompt templates, Models & providers, Tools & extensions, Packages, Trials, and Settings. The project stays selected when changing spaces.

Best for a quiet everyday chat experience with a focused workshop a click away. The skill's trial action can open a conversation beside the editor when needed.

## B — Chat + inspector

One sidebar holds projects and customization. Conversations occupy the center. A right inspector shows the active model, thinking, skill, and context sources. Open the relevant skill directly from a response or inspector.

Best default for Austin: makes the agent's setup visible during real work without keeping a full editor open. Selecting a skill opens its editor with the conversation beside it.

## C — Integrated studio

The expanded workbench and conversation are visible together. Land on a skill editor, with a conversation from the saved revision beside it. A draft trial starts a distinct conversation so the revision in use is clear.

Best for intensive harness authoring. More screen density than A or B, especially in a compact window.

## Shared boundaries

- All example messages, file names, findings, and tool events are illustrative.
- Model defaults reuse the non-secret values observed during the first research pass; options shown are design examples, not a freshly loaded model catalog.
- Changes are temporary in the mockup. There are no model calls, installations, or config writes.
- No teams, roles, onboarding funnel, marketplace, cloud sync, or general-purpose profile system is proposed for the first slice.
- The first useful implementation should connect one real project conversation, tool events, stop/resume, and one editable skill to the same pi runtime. Broader UI remains a proposal.

The interactive source is `design/pi-personal-workspace.html`. A/B/C switches the layout. Run/Customize, sidebar navigation, tool details, example diff, draft review, and trial preview are interactive. Draft edits reset when changing screens; persistence is outside the design prototype.
