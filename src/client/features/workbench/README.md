# Workbench mount

Default export: `Workbench.svelte`.

Props:

- `projectPath: string`: currently opened project.
- `section: 'skills' | 'settings'`: selected customization section.
- `ontrial: (snapshot: Snapshot) => void`: adopts the fresh conversation returned by `api.trial`.
- `ondirty?: (dirty: boolean) => void`: lets the shell warn before project/section navigation discards drafts.

The component imports `api` from `src/client/api.ts`. No SDK code enters the browser. Skill creation requires name, description and instructions; edits require reviewing the actual saved-to-draft patch before saving. Conflicts and failed reads/saves retain the draft. Save is explicitly disk-only; trial requires a clean saved revision and sends its resource ID/hash to the runtime. The runtime owns revision verification, fresh-session creation, trust and actual load evidence.

Settings default changes and per-model changes are submitted separately. Only changed fields are sent, preserving independent provider/model inheritance and unknown server settings. Global editing is an explicit scope choice. Undo is available for the last acknowledged save in this mounted workbench; server restart loses undo history.
