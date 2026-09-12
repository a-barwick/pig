# UI directions

The interactive concept contains three local-only views with illustrative content. Use the A/B/C selector to compare them. All views share project selection, explicit scope, file provenance, and a clear distinction between a draft and a real run.

## A — Workbench (recommended)

A narrow resource sidebar, a generous editor, and a trial inspector. Skills are the default landing page. Select a skill to edit name/trigger/instructions; the adjacent pane shows the trial prompt and the configuration it will use. Model and thinking controls live close to the trial. A review action reveals the generated file.

Best for repeated **edit → try → inspect** work. The cost is higher visual density, especially at half-screen width; the trial inspector should move below the editor in compact layouts.

Borrow the best part of an IDE without trying to replace the IDE. Keep resource navigation shallow: Skills, Configuration, Instructions, Packages. Add ordinary chat only if trials naturally turn into sustained work.

## B — Preferences

A calm settings utility with a category sidebar and grouped forms. Each value shows its origin. Switching between “My defaults” and “This project” changes the destination of edits. The right action is usually “Override” or “Use inherited value,” rather than duplicating every default into a file.

Best if this is primarily a **config companion to terminal pi**. It is the fastest shape to make useful, but skill authoring and trials become secondary screens. The concept lets you change thinking and review the exact project/global JSON patch.

## C — Recipe builder

A named harness recipe, assembled from model, skills, instructions, and extensions. Selecting a recipe previews the files and resources it needs. Individual capabilities can be included or omitted before review.

Best if the user wants distinct **research / coding / review setups**. Recipes are a dashboard concept, not a native pi `profiles` setting. Implement them only with a clear mapping to actual config roots/files and resource sources. The extra abstraction can conceal inheritance and increase maintenance; defer this structure if one everyday harness is sufficient.

## Recommendation

Start with A's skill editor and trial pane, and use B's grouped, source-aware forms for Configuration. Treat C as a later “save this setup” capability rather than the central data model.

## Review prompts

1. Which feels closest to the tool you want to open every day?
2. Should it complement your terminal pi or eventually be where you run it?
3. Is the main unit of work a skill, a project, or a named harness setup?

Platform selected by Austin: local browser app. Visual direction remains unselected. The mockups are intentionally disposable and have no installed app dependencies.
