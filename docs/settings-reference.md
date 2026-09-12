# Installed settings reference

65 documented settings-table fields in pi 0.85.1, checked September 12, 2026. Names, types, and defaults are transcribed from the installed package documentation; unset defaults are shown as `-`. This is a research snapshot, not a validation schema.

Read [configuration inventory](pi-configuration.md) for meanings, scopes, caveats, and non-settings files. Upstream: [versioned settings documentation](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/settings.md). The local installed docs were used directly; the versioned raw source URL was also verified to return successfully.

## Model & Thinking

| Key | Type | Default |
| --- | --- | --- |
| `defaultProvider` | string | - |
| `defaultModel` | string | - |
| `defaultThinkingLevel` | string | - |
| `modelThinkingLevels` | object | - |
| `hideThinkingBlock` | boolean | `false` |
| `showCacheMissNotices` | boolean | `false` |
| `thinkingBudgets` | object | - |

## UI & Display

| Key | Type | Default |
| --- | --- | --- |
| `theme` | string | `"dark"` |
| `externalEditor` | string | `$VISUAL`, then `$EDITOR`, then Notepad on Windows or `nano` elsewhere |
| `quietStartup` | boolean | `false` |
| `defaultProjectTrust` | string | `"ask"` |
| `collapseChangelog` | boolean | `false` |
| `enableInstallTelemetry` | boolean | `true` |
| `enableAnalytics` | boolean | `false` |
| `trackingId` | string | - |
| `doubleEscapeAction` | string | `"tree"` |
| `treeFilterMode` | string | `"default"` |
| `editorPaddingX` | number | `0` |
| `outputPad` | number | `1` |
| `autocompleteMaxVisible` | number | `5` |
| `showHardwareCursor` | boolean | `false` |
| `tuiMode` | string | `"regular"` |
| `fullscreenExitOutput` | string | `"transcript"` |
| `fullscreenScrollbar` | string | `"auto"` |
| `fullscreenCopyOnSelect` | boolean | `true` |

## Network

| Key | Type | Default |
| --- | --- | --- |
| `httpProxy` | string | - |

## Warnings

| Key | Type | Default |
| --- | --- | --- |
| `warnings.anthropicExtraUsage` | boolean | `true` |

## Compaction

| Key | Type | Default |
| --- | --- | --- |
| `compaction.enabled` | boolean | `true` |
| `compaction.reserveTokens` | number | `16384` |
| `compaction.keepRecentTokens` | number | `20000` |

## Branch Summary

| Key | Type | Default |
| --- | --- | --- |
| `branchSummary.reserveTokens` | number | `16384` |
| `branchSummary.skipPrompt` | boolean | `false` |

## Retry

| Key | Type | Default |
| --- | --- | --- |
| `retry.enabled` | boolean | `true` |
| `retry.maxRetries` | number | `3` |
| `retry.baseDelayMs` | number | `2000` |
| `retry.provider.timeoutMs` | number | SDK default |
| `retry.provider.maxRetries` | number | `0` |
| `retry.provider.maxRetryDelayMs` | number | `60000` |

## Message Delivery

| Key | Type | Default |
| --- | --- | --- |
| `steeringMode` | string | `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` |
| `transport` | string | `"auto"` |
| `httpIdleTimeoutMs` | number | `300000` |
| `websocketConnectTimeoutMs` | number | `15000` |

## Terminal & Images

| Key | Type | Default |
| --- | --- | --- |
| `terminal.showImages` | boolean | `true` |
| `terminal.imageWidthCells` | number | `60` |
| `terminal.clearOnShrink` | boolean | `false` |
| `terminal.hyperlinks` | boolean or `"auto"` | `"auto"` |
| `terminal.images` | string or boolean | `"auto"` |
| `terminal.trueColor` | boolean or `"auto"` | `"auto"` |
| `images.autoResize` | boolean | `true` |
| `images.blockImages` | boolean | `false` |

## Shell

| Key | Type | Default |
| --- | --- | --- |
| `shellPath` | string | - |
| `shellCommandPrefix` | string | - |
| `npmCommand` | string[] | - |

## Tools

| Key | Type | Default |
| --- | --- | --- |
| `defaultTools` | string[] | - |

## Sessions

| Key | Type | Default |
| --- | --- | --- |
| `sessionDir` | string | - |

## Model Cycling

| Key | Type | Default |
| --- | --- | --- |
| `enabledModels` | string[] | - |

## Markdown

| Key | Type | Default |
| --- | --- | --- |
| `markdown.codeBlockIndent` | string | `"  "` |
| `markdown.mermaid` | string | `"streaming"` |

## Resources

| Key | Type | Default |
| --- | --- | --- |
| `packages` | array | `[]` |
| `extensions` | string[] | `[]` |
| `skills` | string[] | `[]` |
| `prompts` | string[] | `[]` |
| `themes` | string[] | `[]` |
| `enableSkillCommands` | boolean | `true` |
