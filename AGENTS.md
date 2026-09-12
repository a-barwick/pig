# Pi Dashboard guidance

This is Austin's personal project. Prioritize a useful end-to-end loop and avoid speculative infrastructure.

Austin explicitly confirmed this is for his own use first. Current design direction combines everyday pi conversations with a customization workbench in a local browser app. Do not expand scope for teams, broad onboarding, a marketplace, or general-purpose productization.

Current stage: ideation. Research, planning documents, and disposable UI concepts are in scope. Do not start application implementation until Austin explicitly moves the project to implementation.

- Plans in this repo are proposals, not automatically adopted requirements.
- Verify pi behavior against the installed version; current research baseline is 0.85.1 under `@earendil-works`.
- Keep pi configuration files as the proposed source of truth. Distinguish pi-native settings, extension-owned configuration, and dashboard-only preferences.
- Preserve existing settings and unrelated files. Never commit credentials, session contents, or copies of Austin's global config.
- Clearly label mock content and distinguish saving configuration from applying it to a running agent.
- Do not install community packages or alter live pi settings as part of research.
- Stop at a useful learning point. Austin chooses the UI/platform direction before implementation.
