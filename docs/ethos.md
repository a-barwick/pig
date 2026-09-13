# Pi Dashboard ethos

Pi is a small, user-shaped agent harness. The dashboard should make that harness easier to use and understand while leaving Pi in charge of the agent, configuration, and sessions. This is a personal local app for Austin, not a general platform.

## The promise

Have an ordinary conversation with Pi. When something surprising happens, answer four questions without guesswork:

1. What did Pi see? Show the project, model, thinking setting, loaded instructions and resources, and their sources.
2. What could Pi do? Show the tools actually available in this runtime, with definitions and provenance.
3. What did Pi do? Show real calls, arguments, results, errors, and unresolved outcomes in the session timeline.
4. What can I change? Lead to the Pi-owned file or setting, show the proposed diff, and make a fresh trial easy to inspect.

These are evidence questions. Do not imply a skill was followed merely because it loaded, a tool succeeded merely because cancellation was requested, or a new setting affected an agent that was already running.

## Product principles

- **Conversation first.** The normal path is open a project, resume or start a Pi session, talk, and see tools work. Inspection belongs close to the relevant turn and can stay quiet until wanted.
- **Let behavior carry the idea.** The interface should feel direct and capable through its flow, speed, typography, and honest state. Do not put the product philosophy into headings, slogans, badges, or explanatory copy. Every visible word must help Austin act, orient, or verify something.
- **Make the invisible visible.** Explain behavior with the actual context, tool definition, call, result, and configuration source. Keep evidence folded into the relevant conversation turn until Austin asks to inspect it.
- **User-shaped, file-backed.** Pi's configuration files and JSONL sessions remain authoritative. A GUI edit is an edit to a clearly named source; dashboard preferences are identified separately. Never silently invent a second source of truth.
- **Change, try, learn.** For a customization, show the disk diff, save explicitly, then start a fresh session to test the saved revision. Carry the revision and load evidence into the trial. Let Austin judge whether it helped.
- **Small and honest.** Add a surface when it helps Austin use the core loop, explains an observed surprise, or cheaply reuses a Pi capability. Mark unsupported or deferred capabilities plainly. Sample data and mock UI must identify themselves as such.
- **Preserve agency.** Pi's model choice, tools, extensions, and session format make it adaptable. The dashboard should expose that choice without prescribing plans, subagents, package catalogs, permission rituals, or other workflows Austin has not asked for.

## Design test

For any new screen or control, ask: Does it help Austin converse with Pi now, understand a real action, or modify and test a Pi-owned input? Can the evidence be traced to the runtime or a file? Is it clear when the change takes effect? If not, defer it.

## Boundaries

This document sets a product direction, not an implementation backlog. The current local app already has a conversation, a harness inspector, skill editing and fresh trials. Dogfood that loop before turning session branching, package installation, multi-agent controls, or broad configuration into commitments. Keep the loopback browser boundary, redaction, explicit project trust and session resume, and Pi's native persistence.

## Sources

- [Pi overview](https://pi.dev/) — minimal harness, user-owned workflows, extensions, model choice, sessions, and context.
- [Mario Zechner's design account](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) — motivation for inspectable context, predictable tools, and a small core.
- [Pi contribution philosophy](https://github.com/earendil-works/pi/blob/main/CONTRIBUTING.md) — extensibility and understanding changes over core expansion.
- [User account: Pi as a workshop](https://www.coraliedelpha.fr/blog/pi-coding-agent-harness/) and [user account: owning a workflow](https://jayshah.dev/posts/stop-renting-your-workflow/) — firsthand reports, not a representative survey.
- [New-user criticism](https://github.com/earendil-works/pi/discussions/3735) — configuration and extension discovery can be hard; the GUI should clarify them without hiding their source.

Pi's published documentation may describe a newer release than the dashboard's pinned SDK. Verify behavior against the installed version before implementing a concept.
