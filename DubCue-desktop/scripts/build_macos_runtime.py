#!/usr/bin/env python3
"""Build the signed-input runtime artifact and installer manifest for macOS arm64.

This script intentionally keeps the runtime outside the Tauri bundle. It uses a
pinned, redistributable CPython build, installs the checked-out VoxCPM source,
packages the product-specific backend, and emits SHA-256 metadata consumed by
the desktop installer.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
from pathlib import Path

PYTHON_URL = "https://github.com/astral-sh/python-build-standalone/releases/download/20260510/cpython-3.10.20%2B20260510-aarch64-apple-darwin-install_only.tar.gz"
PYTHON_SHA256 = "22f02aa2458efa28029f91800c3d85a270ae308a2d8450f3f6cef49f56abfa48"
MODEL_REVISION = "bffb3df5a29440629464e5e839f4d214c8714c3d"
MODEL_FILES = [
    ("audiovae.pth", 376951122, "94b5d51e107e0507d4acc976cfdadb64edd6fd06d1f751dadbf2fd1594274bf1"),
    ("config.json", 4336, "405f0dcd92f7feba6011ed4eac5c8d4f74cba9712f07fd5cfa3063bbdd95402c"),
    ("model.safetensors", 4580080592, "f7f964cfa9da23653baec6e6f7750719977ad944ed9f95fe52fe3a620506891d"),
    ("special_tokens_map.json", 1632, "068594063e37662c02b21acf42ebb334ef6a74fb810e68a2368f88f08351de76"),
    ("tokenization_voxcpm2.py", 2895, "84489ea32b6ee0cae22ed5480cacb6df85c46624c3119be9a2021c3649a12729"),
    ("tokenizer.json", 3676772, "f8984687e4a92a3503d521396d454b7d68e9fdaab2a0288eb3536c7c1aa4bc20"),
    ("tokenizer_config.json", 5059, "e78a3ebb48a0b9437efd1823b6b726c823da89e49dd8bcc90c02419d9baa772b"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, destination: Path, expected: str) -> None:
    if not destination.exists() or sha256(destination) != expected:
        destination.unlink(missing_ok=True)
        urllib.request.urlretrieve(url, destination)
    actual = sha256(destination)
    if actual != expected:
        raise SystemExit(f"checksum mismatch for {destination.name}: {actual}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", required=True, choices=["DubCue", "Fuki"])
    parser.add_argument("--backend", type=Path, required=True)
    parser.add_argument("--voxcpm", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--base-url", required=True, help="Release download base URL without trailing slash")
    parser.add_argument("--version", default="1")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    artifact_name = f"{args.product.lower()}-runtime-v{args.version}-macos-arm64.tar.gz"
    artifact = args.output / artifact_name

    with tempfile.TemporaryDirectory(prefix=f"{args.product.lower()}-runtime-") as temp_value:
        temp = Path(temp_value)
        python_archive = temp / "python.tar.gz"
        download(PYTHON_URL, python_archive, PYTHON_SHA256)
        extracted = temp / "extracted"
        with tarfile.open(python_archive, "r:gz") as archive:
            archive.extractall(extracted, filter="data")
        runtime = temp / "runtime"
        shutil.copytree(extracted / "python", runtime, symlinks=True)
        python = runtime / "bin/python3"
        subprocess.run([python, "-m", "pip", "install", "--disable-pip-version-check", str(args.voxcpm.resolve())], check=True)
        backend_dir = runtime / "backend"
        backend_dir.mkdir()
        shutil.copy2(args.backend, backend_dir / "server.py")
        notices = runtime / "LICENSES"
        notices.mkdir()
        for name in ("LICENSE", "README.md"):
            source = args.voxcpm / name
            if source.exists():
                shutil.copy2(source, notices / f"VoxCPM-{name}")
        subprocess.run([python, "-c", "import voxcpm, numpy, soundfile; print('runtime import check passed')"], check=True)
        with tarfile.open(artifact, "w:gz") as archive:
            for child in sorted(runtime.iterdir()):
                archive.add(child, arcname=child.name, recursive=True)

    artifacts = [{
        "name": artifact_name,
        "url": f"{args.base_url.rstrip('/')}/{artifact_name}",
        "sha256": sha256(artifact),
        "size": artifact.stat().st_size,
        "kind": "tar.gz",
        "destination": "runtime",
    }]
    for name, size, digest in MODEL_FILES:
        artifacts.append({
            "name": name,
            "url": f"https://huggingface.co/openbmb/VoxCPM2/resolve/{MODEL_REVISION}/{name}?download=true",
            "sha256": digest,
            "size": size,
            "kind": "file",
            "destination": "model",
        })
    manifest = {"version": args.version, "requiredFreeBytes": 12_000_000_000, "artifacts": artifacts}
    manifest_path = args.output / "macos-arm64.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(artifact)
    print(manifest_path)


if __name__ == "__main__":
    main()
