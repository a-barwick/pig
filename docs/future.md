# Deferred ideas

These are saved possibilities, not implementation scope. Follow [the project guidance](../AGENTS.md) for the native app.

## Skill evals

Compare skill revisions on a small set of repeatable tasks after the basic edit → run → inspect loop is useful.

A useful future version could save example prompts and expected behavior, rerun them against a selected skill revision/model, and compare the actual outputs and tool traces. Include examples where the skill should not activate. Preserve the skill revision and configuration with each result; distinguish rule-based checks, Austin's assessment, and any model-based grading.

Revisit when Austin has a skill he uses enough to worry about regressions. Do not build an eval runner, dataset format, scoring system, or dashboard now.
