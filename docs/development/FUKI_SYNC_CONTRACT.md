# DubCue → Fuki sync contract

This document defines how changes from DubCue may be synced into Fuki.

Fuki is a commercial sibling product. It shares most of DubCue's functional architecture, but it is not a DubCue skin or theme. Fuki has its own UI system, visual identity, product tone, commercial roadmap, and future commercial-only modules.

DubCue sync baselines use the four-part version in [`../../VERSION`](../../VERSION). See [`VERSIONING.md`](VERSIONING.md) for the versioning rules.

## Sync trigger

Do not sync changes into Fuki automatically.

Only sync from DubCue to Fuki when the user explicitly asks from the Fuki side, for example:

- “把 DubCue 最近的生成逻辑同步到 Fuki”
- “Fuki 也要这个项目切换不中断生成的修复”
- “把 DubCue 的下载保存逻辑移植到 Fuki”

If the request is broad, first prepare a short sync plan that separates shared functionality from product shell changes.

## Product boundary

### Shared core that can usually sync

These changes are generally eligible for Fuki, subject to review:

- Project/workspace data model and migrations
- Import, segmentation, director-table behavior, and persistence logic
- Generation queue behavior, cancellation, progress semantics, and project-switch safety
- Backend bridge behavior for VoxCPM or product-neutral local model invocation
- Audio quality policy, including “never degrade voice quality for hard speed matching”
- Reference audio handling, transcript handling, clone-mode behavior, and request payload shape
- Merge/export/download file behavior
- File save/open commands and desktop runtime glue when product-neutral
- Tests, type fixes, security fixes, and data-loss fixes

### Product shell that must not sync blindly

These must stay product-specific unless the user explicitly asks for an equivalent Fuki design:

- DubCue logo, mark, icons, app name, package name, file extension, window title, and release text
- DubCue visual layout, CSS theme, spacing, colors, motion, and component styling
- DubCue Chinese/English copy tone when Fuki needs its own wording
- DubCue onboarding, help text, examples, marketing copy, screenshots, and docs
- UI affordances that conflict with `docs/design/FUKI_UI_SYSTEM.md`

When a DubCue UI change represents a real product behavior that Fuki also needs, translate it into Fuki's own UI system instead of copying the DubCue JSX/CSS literally.

### Fuki commercial-only layer

These belong to Fuki and should not be copied back to DubCue by default:

- Commercial model providers and provider marketplace
- Account login, membership, subscription, license checks, billing, invoicing
- Commercial quotas, watermark policy, cloud sync, analytics, telemetry
- Fuki-specific distribution, activation, or update channels

## Recommended file structure direction

When evolving DubCue, keep future Fuki sync in mind:

```text
src/
  api.ts                 product-neutral HTTP payloads and backend calls
  desktop.ts             mostly product-neutral desktop commands with product labels isolated
  App.tsx                DubCue product shell; avoid hiding reusable domain logic here
  domain/                future home for reusable project/generation/audio logic
  product/               future home for DubCue-specific product constants/copy
backend/
  server.py              current local backend bridge; keep product-neutral generation policy clear
docs/development/
  FUKI_SYNC_CONTRACT.md  this sync boundary
```

Prefer moving reusable logic into `src/domain/` as the codebase grows. Good candidates:

- project normalization and migrations
- generation job state updates
- audio filename generation
- speed-intent mapping
- reference-audio state validation

Do not do a large refactor just for neatness during small fixes. Instead, keep new logic cleanly separated and extract when a second product sync actually needs it.

## Sync workflow

When asked to sync a DubCue change into Fuki:

1. Identify the DubCue sync version or change range.
   - Prefer an explicit sync version such as `0.6.0.0`.
   - Prefer committed changes.
   - If changes are uncommitted, summarize the relevant files and create a focused patch plan before applying anything.
2. Classify every change as:
   - `shared-core`
   - `product-shell`
   - `dubcue-only`
   - `fuki-commercial`
3. Port only the `shared-core` behavior by default.
4. Re-express any needed UI in Fuki's own components and design language.
5. Preserve Fuki naming, assets, colors, and commercial architecture.
6. Run Fuki's own verification commands, not only DubCue's checks.
7. Report any deliberately skipped DubCue UI/brand changes.

## Commit hygiene

When possible, commit DubCue work in sync-friendly slices:

- `shared-core: preserve director state across project switches`
- `shared-core: make target speed a pre-generation pacing hint`
- `dubcue-shell: remove duplicate workspace breadcrumb`
- `dubcue-docs: explain local development backend`

This makes later Fuki sync safer than cherry-picking one mixed commit.

If a commit mixes shared logic and DubCue UI, document the split in the final response so Fuki can port only the functional part.

## Current known shared changes worth syncing to Fuki

As of the current development pass, these DubCue changes are likely good Fuki candidates:

- First-launch project list should be empty.
- Dev/runtime backend connection should start reliably in development.
- Director state should persist per project, including reference audio, clone mode, and reference transcript.
- Switching projects during generation must not lose or misdirect in-flight generation results.
- Super clone mode disables performance prompt, while preserving reference voice workflow.
- Row generation progress should not fake precise percentages when the backend does not expose real progress events.
- Audio download should use a save-location flow in the desktop app.
- Target speed should be a soft pre-generation pacing hint, never a post-generation hard time-stretch that degrades voice quality.

Port these as behavior, not as DubCue UI.
