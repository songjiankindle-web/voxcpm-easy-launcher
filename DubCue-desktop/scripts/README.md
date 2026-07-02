# macOS runtime release

The Tauri application is intentionally small. Its first-run installer consumes
`macos-arm64.json`, downloads a private CPython/VoxCPM runtime and the pinned
official `openbmb/VoxCPM2` files, verifies every SHA-256, then installs them in
the product's Application Support directory.

Build a release artifact on Apple Silicon:

```bash
python3 scripts/build_macos_runtime.py \
  --product DubCue \
  --backend backend/server.py \
  --voxcpm ../VoxCPM-main \
  --output runtime-release \
  --base-url https://downloads.your-app-domain.example/dubcue/runtime-v1
```

Publish both generated runtime files on a stable application-owned download
domain and configure `DUBCUE_RUNTIME_MANIFEST_URL` at release time. This URL is
only for the application runtime; model files always come from the pinned
official OpenBMB Hugging Face repository. The App refuses missing or incorrect
checksums.
