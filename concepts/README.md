# UI studies

Open `index.html` in a browser, or serve this directory at `http://127.0.0.1:4327/` with `python3 -m http.server 4327 --bind 127.0.0.1`.

These are static studies with sample conversations. Links and native disclosure rows work; buttons that would save or run Pi are disabled. No file reads, settings writes, or Pi calls occur.

The current UI has a real conversation, tool details, inspector, and skill editor. The friction under examination is the movement between prompt flow and configuration/inspection flow. These four studies try different degrees of separation without adding a second source of truth:

| Study | Flow | Principal tradeoff |
| --- | --- | --- |
| Transcript | Prompt and reply with tool evidence folded into each turn | Fastest daily path; configuration remains elsewhere |
| Desk | Conversation and Pi config source visible together | Precise editing, but wider screen and heavier layout |
| Command | Open config/navigation from the prompt with a keyboard-sized menu | Stays in flow, but less discoverable |
| Journal | File changes and fresh trials appear in the conversation chronology | Strongest provenance, but can make a long transcript denser |

The screen copy is deliberately limited to things needed to orient, act, or verify. Concepts do not imply that a saved setting applies to an already-running agent or that a loaded skill was followed. Verify any chosen behavior against the pinned Pi SDK before implementation.
