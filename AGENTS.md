# Pi Dashboard guidance

This is Austin's personal project. Prioritize a useful end-to-end loop and avoid speculative infrastructure.

Austin explicitly confirmed this is for his own use first. Current design direction combines everyday pi conversations with a customization workbench in a local browser app. Do not expand scope for teams, broad onboarding, a marketplace, or general-purpose productization.

Current stage: implementation handoff prepared. Read `docs/implementation-handoff.md` for the bounded first slice and thread ownership. This planning thread does not launch implementation; a thread explicitly assigned an implementation track may execute that track. Do not treat older exploratory documents as additional scope.

- Plans in this repo are proposals, not automatically adopted requirements.
- Verify pi behavior against the installed version; current research baseline is 0.85.1 under `@earendil-works`.
- Keep pi configuration files as the proposed source of truth. Distinguish pi-native settings, extension-owned configuration, and dashboard-only preferences.
- Preserve existing settings and unrelated files. Never commit credentials, session contents, or copies of Austin's global config.
- Clearly label mock content and distinguish saving configuration from applying it to a running agent.
- Do not install community packages or alter live pi settings as part of research.
- Use the local browser B/C direction in the handoff: everyday conversation with an inspector, side-by-side workbench when editing. Stop at a useful learning point for Austin to dogfood.
