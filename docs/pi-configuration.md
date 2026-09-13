# Pi configuration inventory

Baseline: installed `@earendil-works/pi-coding-agent` **0.85.1**, inspected September 12, 2026. The installed package's docs are the version-specific reference; links below point to current upstream and can change.

This is a capability reference. The [implementation handoff](implementation-handoff.md) defines which capabilities belong in the first release.

## Configuration surfaces

| Surface                      | Where pi reads it                                                                                                                      | What the GUI could change                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| General settings             | `~/.pi/agent/settings.json`, trusted `<project>/.pi/settings.json`                                                                     | Model defaults, thinking, context, retries, tools, resource paths, terminal/display preferences; [complete table](settings-reference.md) |
| Skills                       | `~/.pi/agent/skills/`, `~/.agents/skills/`, trusted project `.pi/skills/` and ancestor `.agents/skills/`, package/settings/CLI sources | Frontmatter, instructions, scripts, references, enablement, source path                                                                  |
| Prompt templates             | Global/project `prompts/` under the pi config directories; packages and explicit sources                                               | Command name from filename, description, argument hints, Markdown, positional/default arguments                                          |
| Context instructions         | Global `AGENTS.md`; ancestor/current `AGENTS.md` or `CLAUDE.md`; `AGENTS.override.md` replaces same-directory alternatives             | Edit exact source, explain ordered concatenation; this is not one merged JSON object                                                     |
| System prompt                | Global/project `SYSTEM.md`; append via `APPEND_SYSTEM.md`; CLI equivalents                                                             | Replace or append instructions, with clear precedence and preview of assembled context                                                   |
| Extensions                   | Global/project `extensions/`; package/settings sources; explicit `-e`                                                                  | Add/remove source references, inspect code and registered tools/commands/events; extension-specific editors only where schemas exist     |
| Packages                     | `packages` entries in global/project settings and `pi` manifest in package.json                                                        | npm/git/local sources, version/ref, per-resource filters and autoload behavior                                                           |
| Custom models/providers      | `~/.pi/agent/models.json`                                                                                                              | Endpoints, models, capabilities, provider compatibility, sampling, thinking maps, costs, auth references                                 |
| Authentication               | `~/.pi/agent/auth.json`, provider environment variables, pi login                                                                      | Show configured/unavailable state without rendering secrets; prefer existing pi auth flow                                                |
| Keybindings                  | `~/.pi/agent/keybindings.json`                                                                                                         | Namespaced action → key or key array; binding collisions; `/reload` applies changes                                                      |
| Themes                       | Global/project `themes/`, package/settings/CLI sources                                                                                 | Theme JSON palette/tokens; preview terminal theme separately from GUI appearance                                                         |
| Project trust                | `~/.pi/agent/trust.json`; global `defaultProjectTrust`; one-run flags                                                                  | Explain trusted/ignored resources; explicit trust action. Trust changes need restart                                                     |
| Session storage              | `sessionDir`, environment, CLI; pi-managed JSONL                                                                                       | Storage destination and trial/session selection. Session content is runtime data, not a settings form                                    |
| Launch environment/arguments | Parent process and CLI                                                                                                                 | Config root, startup networking, tool selection, ephemeral trials, provider-specific environment references                              |

`models-store.json`, sessions, and trust records are runtime-managed data. Do not treat every JSON file under `~/.pi/agent` as freely editable configuration.

Sources: [settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md), [skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md), [prompts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md), [README/context](https://github.com/earendil-works/pi/tree/main/packages/coding-agent), [packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

## Settings families

| Family                              | Principal controls                                                                   | Suggested placement                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Model and thinking                  | Provider/model default, per-model thinking, supported levels, budgets, model cycling | Primary configuration and trial header              |
| Skills, prompts, extensions, themes | Source paths, filters, packages, skill slash commands                                | Resource library                                    |
| Tools                               | Initial built-ins; separate CLI allowlist/exclusions                                 | Trial setup and advanced configuration              |
| Context                             | Automatic compaction, response reserve, recent-context retention, branch summaries   | Advanced model settings                             |
| Reliability/transport               | Retry layers, timeout, stream transport, proxy                                       | Advanced connection settings                        |
| Shell                               | Shell path, command prefix, npm invocation                                           | Advanced execution settings                         |
| Terminal/editor                     | TUI/fullscreen, keybindings, theme, image protocol, Markdown, padding                | Terminal preferences, separate from GUI preferences |
| Privacy/trust                       | Project loading decisions, startup telemetry/analytics, image blocking               | Clear dedicated section                             |
| Sessions                            | Storage location, launch persistence/resume                                          | Project/trial setup                                 |

The full table is intentionally broader than MVP forms. Unknown fields must survive edits; pi metadata such as `lastChangelogVersion` should not become a normal user control.

## Precedence and save behavior

- Trusted project settings override global settings. Nested objects merge; a project `defaultTools` array replaces its global counterpart.
- Resource loading has its own rules. Do not assume every array is replaced or simply concatenated. Packages deduplicate by source identity; the project package entry wins, except `autoload: false` can apply a delta to the global entry.
- Paths in global settings resolve relative to the global agent directory; project settings paths resolve relative to `.pi`. Removing an override is different from setting an empty array.
- CLI arguments can override startup settings. Session model/thinking may differ from saved defaults. In pi, saving startup defaults is distinct from changing the active model.
- The GUI should display **effective value**, **source**, **write destination**, and **application status**. “Saved” must not imply an existing agent has reloaded.
- `/reload` refreshes skills, extensions, prompts, themes, keybindings, and context files. Custom models are reread when `/model` opens. Trust decisions require restart. Other settings need per-control application behavior verified in the chosen SDK/RPC integration; do not invent a universal live-reload button.

## Skill authoring fields

`name` and `description` are required. Pi supports `license`, `compatibility`, `metadata`, experimental `allowed-tools`, and `disable-model-invocation` as optional frontmatter. Names use lowercase letters/digits/hyphens, max 64 characters; descriptions max 1,024; compatibility max 500. Pi permits a name that differs from the containing folder, unlike the portability standard.

The editor should make the description/trigger prominent, preserve unknown metadata, support Markdown and relative references, and distinguish authoring feedback from runtime proof. `disable-model-invocation: true` hides the skill from automatic system-prompt discovery while retaining explicit `/skill:name` invocation. It does not disable the skill completely.

Skill descriptions are available at startup; full content is loaded on demand. Automatic matching is model-dependent. A direct `/skill:name` trial is more deterministic than assuming a skill was used because the answer looks plausible.

## Custom model controls

Provider fields: `baseUrl`, `api`, `apiKey`, `oauth`, `headers`, `authHeader`, `models`, `modelOverrides`, provider-level `compat`.

Model fields: `id`, `name`, `api`, `reasoning`, `thinkingLevelMap`, `input`, `contextWindow`, `maxTokens`, `samplingParams`, `cost`, `compat`. Cost data includes input/output/cache rates and optional `tiers` keyed by `inputTokensAbove`.

Supported API families documented for custom models: `openai-completions`, `openai-responses`, `anthropic-messages`, `google-generative-ai`. Compatibility fields are API-specific: preserve them in the raw view and link to the version's [model reference](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md), rather than offering one universal provider form.

`samplingParams` allows provider-specific request values such as temperature/top_p/top_k/min_p on supported OpenAI-compatible APIs; other API types ignore it. It is not a top-level settings.json temperature option. `thinkingLevelMap` can hide unsupported levels or map pi levels to provider values; don't offer every thinking level for every model.

Auth/header config values can be literals, `$ENV_VAR` interpolation, or `!command` resolvers. A configuration preview must not execute resolver commands. Display references and redact literal secrets. A configured credential does not prove a paid model call will succeed.

## Launch controls

| Controls                                                                                          | Use                                                                                                      |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `PI_CODING_AGENT_DIR`                                                                             | Choose a separate harness config root; defaults to `~/.pi/agent`                                         |
| `--session-dir`, `PI_CODING_AGENT_SESSION_DIR`, `sessionDir`                                      | Session location, highest-to-lowest precedence                                                           |
| `--provider`, `--model`, `--thinking`, `--models`                                                 | Run-specific model selection                                                                             |
| `--tools`, `--exclude-tools`, `--no-tools`, `--no-builtin-tools`                                  | Tool exposure; `defaultTools` only governs initial built-ins and does not disable extension/custom tools |
| `--skill`, `-e`, `--prompt-template`, `--theme`                                                   | Explicit resource sources                                                                                |
| `--no-skills`, `--no-extensions`, `--no-prompt-templates`, `--no-themes`, `--no-context-files`    | Discovery controls; explicit skill paths remain additive                                                 |
| `--system-prompt`, `--append-system-prompt`                                                       | Run-specific instructions                                                                                |
| `--approve`, `--no-approve`                                                                       | Per-run project resource trust; not per-tool authorization                                               |
| `--no-session`, `--continue`, `--resume`, `--session`, `--fork`, `--name`                         | Trial/session lifecycle                                                                                  |
| `PI_OFFLINE`, `--offline`                                                                         | Suppress startup network operations; not a general network sandbox or guarantee of local inference       |
| `PI_SKIP_VERSION_CHECK`, `PI_TELEMETRY`, `PI_CACHE_RETENTION`                                     | Version requests, install telemetry override, supported extended caching                                 |
| `VISUAL`, `EDITOR`, `HTTP_PROXY`, `HTTPS_PROXY`                                                   | Editor/proxy fallbacks                                                                                   |
| `PI_PACKAGE_DIR`, `PI_SHARE_VIEWER_URL`                                                           | Package-root and share-viewer customization                                                              |
| `PI_HARDWARE_CURSOR`, `PI_HYPERLINKS`, `PI_IMAGE_PROTOCOL`, `PI_TRUE_COLOR`, `PI_TUI_ESC_TIMEOUT` | Advanced terminal detection/input                                                                        |

Provider credential/cloud environment variables are provider-specific; use the [provider reference](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md). `AI_AGENT`, `PI_CODING_AGENT`, and the `PI_SESSION_*`/`PI_MODEL`/`PI_PROVIDER`/`PI_REASONING_LEVEL` shell metadata are runtime outputs, not user preferences. Source: [environment variables](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/environment-variables.md).

## What is not a stock pi setting

- MCP servers: require an extension/integration; no universal native `mcpServers` config promised.
- Subagent roles, workflow chains, LSP, memory automation: extension-owned or custom harness behavior.
- Filesystem/network permissions and per-action approval: no built-in permission policy to configure. Tool allowlists and project trust are not OS isolation.
- GUI appearance, panel sizes, draft history: dashboard preferences, stored separately from pi's settings.

Source: [upstream customization and philosophy](https://github.com/earendil-works/pi/tree/main/packages/coding-agent), [containerization](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md).
