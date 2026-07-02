# DubCue repository identity

This repository is the **DubCue** application project.

Canonical brand assets:

- `assets/brand/dubcue-logo.png` — primary horizontal logo.
- `assets/brand/dubcue-mark.png` — square application mark and icon source.

Treat these PNG files as approved source assets. Do not redraw or vectorize them without explicit user approval. Product UI, package metadata, documentation, and release naming should use **DubCue**. Keep **VoxCPM** when referring to the upstream OpenBMB model. Keep **VoxDirector** only in historical release references.

## DubCue and Fuki parallel development

DubCue and Fuki are parallel sibling products, not a theme pair.

- **DubCue** is the open/local-first product line in this repository.
- **Fuki** is the commercial sibling product. It shares most functional architecture with DubCue, but has its own UI system, brand, product tone, and future commercial modules such as commercial model integrations and membership/account features.
- Fuki must not automatically inherit DubCue UI, DubCue brand assets, DubCue product naming, or DubCue-specific copy when syncing changes.
- Sync from DubCue to Fuki is only done when the user explicitly requests it from the Fuki side. Do not proactively apply Fuki changes from this repository.

When making DubCue changes that may later be synced to Fuki, classify the work:

- **Shared core:** project data model, generation queue behavior, backend generation bridge, audio quality policy, import/export, persistence, file handling, tests, and bug fixes that are product-neutral.
- **Product shell:** UI layout, visual styling, brand assets, wording/tone, onboarding, pricing/account surfaces, and product-specific settings.
- **Commercial-only Fuki layer:** commercial model providers, membership, licensing, billing, analytics, and distribution policy. These do not belong in DubCue unless the user explicitly asks.

Prefer keeping shared core logic in product-neutral modules (`src/api.ts`, `src/desktop.ts`, backend bridge modules, persistence helpers, and future shared domain modules). Avoid burying product-neutral behavior inside DubCue-specific UI components when it can reasonably be factored out. If a fix must touch `src/App.tsx`, keep the logic copyable and clearly separate from brand/UI presentation.

Before syncing any DubCue change into Fuki, follow `docs/development/FUKI_SYNC_CONTRACT.md`.

DubCue uses a four-part sync baseline for sibling-product synchronization. The current sync version is stored in `VERSION`; app/package versions use the first three parts for SemVer compatibility. Follow `docs/development/VERSIONING.md` before bumping versions.
