# Pi Dashboard

A personal macOS app for everyday Pi conversations and inspecting the harness behind them.

This repository is between implementations. The former SvelteKit app and its Node/web tooling have been removed. There is currently no runnable application or build command.

## Direction

- Build a small, fast native macOS app. GPUI is the leading UI direction; no Electron, webview, or browser-hosted version.
- Keep Pi responsible for agent behavior, configuration, authentication, and JSONL sessions. A native client can communicate with Pi through its documented stdio RPC protocol.
- Make the conversation primary. Show the actual loaded resources, available tools, calls, arguments, results, and configuration sources when inspection is useful.
- Use Pi's files as the source of truth. Saving a skill or setting must not imply that a running session applied it.
- Build the real app rather than a disposable proof of concept. Keep bundle size, launch speed, and idle resource use visible as the app develops.

These are the current project constraints, not a claim that the replacement has been implemented.

## Project references

- [Product ethos](docs/ethos.md)
- [Pi configuration inventory](docs/pi-configuration.md)
- [Installed settings reference for Pi 0.85.1](docs/settings-reference.md)
- [Deferred ideas](docs/future.md)

The `concepts/` directory contains historical static layout studies. It is not the application.

Do not commit credentials, session contents, or copies of personal Pi configuration.
