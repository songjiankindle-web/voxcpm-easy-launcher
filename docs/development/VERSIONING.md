# DubCue versioning

DubCue uses two related version numbers:

1. **App version**: three-part SemVer used by package managers and app bundlers.
2. **Sync version**: four-part DubCue baseline used when Fuki requests a specific DubCue state to sync from.

## Current baseline

- App version: `0.6.0`
- Sync version: `0.6.0.0`

The sync version is stored in the repository root [`VERSION`](../../VERSION) file.

## Why the versions differ

Many tools expect app versions to be valid SemVer, such as:

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Those should stay three-part versions like `0.5.0`.

Fuki synchronization needs a more precise product-baseline marker. For that, DubCue uses a four-part sync version like `0.5.0.1`.

## Four-part sync version format

Use:

```text
major.minor.feature.sync
```

Example:

```text
0.5.0.1
```

Meaning:

- `major`: broad product generation; `0` while pre-1.0.
- `minor`: product milestone.
- `feature`: grouped capability milestone.
- `sync`: precise sync checkpoint for Fuki and other sibling products.

## Increment rules

- Increment the fourth number for small syncable checkpoints:
  - `0.5.0.1` → `0.5.0.2`
  - bug fixes
  - shared-core behavior changes
  - sync contract updates
- Increment the third number for a meaningful feature group:
  - `0.5.0.x` → `0.5.1.0`
  - new project model
  - new generation workflow
  - major import/export change
- Increment the second number for a product milestone:
  - `0.5.x.x` → `0.6.0.0`
  - release-candidate level changes
  - major UX or architecture phase
- Increment the first number only for stable major releases:
  - `1.0.0.0`

When the first three numbers change, app version should usually follow them:

| Sync version | App version |
| --- | --- |
| `0.5.0.1` | `0.5.0` |
| `0.5.0.2` | `0.5.0` |
| `0.5.1.0` | `0.5.1` |
| `0.6.0.0` | `0.6.0` |

## Commit and sync hygiene

When preparing a checkpoint for Fuki:

1. Make sure `VERSION` contains the intended four-part sync version.
2. Keep app versions in package/bundler files aligned to the first three sync parts.
3. Commit sync-friendly slices when possible:
   - `shared-core: preserve director state across project switches`
   - `shared-core: remove hard speed control from generation`
   - `dubcue-shell: adjust reference voice UI`
4. In the final response, state the DubCue sync version that Fuki should request.

Example Fuki request:

```text
把 DubCue 0.6.0.0 的 shared-core 多模型 provider/capability 架构同步到 Fuki，但不要同步 DubCue UI。
```
