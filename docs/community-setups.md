# Community setups worth reviewing

Checked September 12, 2026 against repository READMEs and the public GitHub API. Stars are an imperfect, changing signal of visibility, not evidence of quality or compatibility. This is a researched shortlist, not an exhaustive ranking. No package has been installed or executed.

| Setup | Stars at check | Pattern to learn from | Fit for this project |
| --- | ---: | --- | --- |
| [Armin Ronacher's agent-stuff / mitsupi](https://github.com/mitsuhiko/agent-stuff) | 3,078 | A personal package combining skills, prompts, extensions, and themes; review, GitHub, browser, notifications, and session tools | Closest inspiration for growing an opinionated personal harness. Select individual capabilities; some assume Armin's environment and some UI is terminal-specific |
| [Mario Zechner's pi-skills](https://github.com/badlogic/pi-skills) | 2,516 | Small skill directories for search, browser use, Google tools, transcription, and editor integration | Good authoring examples and evidence that a useful capability can be mostly Markdown plus a script. Some README package names are older; check current dependencies before reuse |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | 3,550 | Focused scout/researcher/worker/reviewer/oracle roles, foreground and background delegation, saved workflows | Useful if real work calls for delegation. Agent profiles and its configuration belong to this extension, not stock pi settings. UI compatibility needs an actual trial |
| [Oh My Pi](https://github.com/can1357/oh-my-pi) | 30,844 | A batteries-included pi fork with LSP, debugging, additional tools, and model-specific behavior | Product inspiration, not a settings bundle. Adopting it changes the runtime and compatibility target; do not silently substitute it for installed pi |
| [Picot, formerly pi-studio](https://github.com/shixin-guo/picot) | 282 | Local desktop GUI, bundled pi runtime, project windows, streamed chat and tool diffs | A useful smaller UI precedent. Inspect what can be reused before building a general chat client; our proposed focus is authoring/configuration |
| [awesome-pi-agent](https://github.com/qualisero/awesome-pi-agent) | 1,097 | Historical directory of extensions and setups | Archived June 3, 2026; its README explicitly retires the list as outdated. Use for discovery only |

Other search hits include [harms-haus/pi-extensions](https://github.com/harms-haus/pi-extensions), with Git status, quality checks, and workflow tools. The repository had zero stars at this check, so it is not presented as a popular setup.

## Candidate compositions (our proposals)

| Composition | Start with | Optional addition after use |
| --- | --- | --- |
| Minimal daily driver | Existing model/auth, one personal skill, one review prompt, stock tools | Notification extension |
| Research bench | Search/browser skills plus source-citation instructions | Researcher/reviewer subagents after a single-agent trial is useful |
| Coding workshop | Project AGENTS.md, code-review skill, a small set of useful prompt commands | LSP or review extension when missing code intelligence is an observed problem |
| Local-model experiment | Existing local server via models.json, explicit capabilities and thinking map | Per-model sampling parameters once provider support is verified |

These are not claimed to be community-standard presets. They synthesize useful patterns from the projects above. Preserve the option to pick one skill instead of installing an entire author's collection.

## What a future package screen should show

Repository/package source, pinned version or ref, which resources it adds, requirements, scope, and known trial result. Label runtime forks separately from installable pi packages. The first implementation can start with existing local resources and a plain source link; a registry/marketplace is unnecessary.

Metadata source: `https://api.github.com/repos/<owner>/<repo>` for each linked repository; README content from each repository's default branch. Compatibility is untested unless explicitly stated otherwise.
