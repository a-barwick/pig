# Community setups worth reviewing

Reference material only. These projects are sources of examples and compatibility information; they do not add features or packages to the [implementation scope](implementation-handoff.md).

Checked September 12, 2026 against repository READMEs and the public GitHub API. Stars are an imperfect, changing signal of visibility, not evidence of quality or compatibility. This is a researched shortlist, not an exhaustive ranking. No package has been installed or executed.

| Setup | Stars at check | Pattern to learn from | Fit for this project |
| --- | ---: | --- | --- |
| [Armin Ronacher's agent-stuff / mitsupi](https://github.com/mitsuhiko/agent-stuff) | 3,078 | A personal package combining skills, prompts, extensions, and themes; review, GitHub, browser, notifications, and session tools | Closest inspiration for growing an opinionated personal harness. Select individual capabilities; some assume Armin's environment and some UI is terminal-specific |
| [Mario Zechner's pi-skills](https://github.com/badlogic/pi-skills) | 2,516 | Small skill directories for search, browser use, Google tools, transcription, and editor integration | Good authoring examples and evidence that a useful capability can be mostly Markdown plus a script. Some README package names are older; check current dependencies before reuse |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | 3,550 | Focused scout/researcher/worker/reviewer/oracle roles, foreground and background delegation, saved workflows | Useful if real work calls for delegation. Agent profiles and its configuration belong to this extension, not stock pi settings. UI compatibility needs an actual trial |
| [Oh My Pi](https://github.com/can1357/oh-my-pi) | 30,844 | A batteries-included pi fork with LSP, debugging, additional tools, and model-specific behavior | Product inspiration, not a settings bundle. Adopting it changes the runtime and compatibility target; do not silently substitute it for installed pi |
| [Picot, formerly pi-studio](https://github.com/shixin-guo/picot) | 282 | Local desktop GUI, bundled pi runtime, project windows, streamed chat and tool diffs | A useful UI precedent for conversations, project navigation, and visible tool activity |
| [awesome-pi-agent](https://github.com/qualisero/awesome-pi-agent) | 1,097 | Historical directory of extensions and setups | Archived June 3, 2026; its README explicitly retires the list as outdated. Use for discovery only |

Other search hits include [harms-haus/pi-extensions](https://github.com/harms-haus/pi-extensions), with Git status, quality checks, and workflow tools. The repository had zero stars at this check, so it is not presented as a popular setup.

Metadata source: `https://api.github.com/repos/<owner>/<repo>` for each linked repository; README content from each repository's default branch. Compatibility is untested unless explicitly stated otherwise.
