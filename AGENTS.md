# Pi Dashboard guidance

This is Austin's personal project. Build a useful native macOS Pi experience without speculative infrastructure or a web version.

- The former SvelteKit implementation was intentionally removed. Do not restore it, add Electron, or wrap a web UI in a desktop shell.
- GPUI is the leading UI direction. Favor a small bundle, fast launch, responsive interaction, and low idle overhead. Do not turn framework selection into a throwaway proof of concept.
- Mirror Pi's transparency and simplicity: make available tools, actual calls, arguments, results, and configuration sources inspectable.
- Verify Pi behavior against the version actually used by the app. The current configuration research baseline is 0.85.1 under `@earendil-works`.
- Keep Pi configuration files and JSONL sessions as the source of truth. Distinguish Pi-native settings, extension-owned configuration, and app-only preferences. Use [the configuration inventory](docs/pi-configuration.md) and [the installed settings reference](docs/settings-reference.md) when working on configuration; they describe capabilities, not product scope.
- Preserve existing settings and unrelated files. Never commit credentials, session contents, or copies of Austin's global configuration.
- Do not install community packages or alter live Pi settings as part of research.
- Update current documents in place when decisions change. Remove superseded alternatives; Git history retains the exploration.

Pi owns agent execution and persistence. Opening, resuming, and trusting a project are explicit actions. Saving a skill or setting does not apply it to an already-running agent. Preserve the distinction between a cancellation request and a confirmed tool outcome.

Stop at a genuinely useful point for Austin to use the app before expanding scope.
