"""Small local HTTP bridge between the DubCue desktop UI and VoxCPM2.

The service intentionally uses only Python's standard HTTP server. The model
and audio dependencies come from the existing VoxCPM environment.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import threading
import time
import unicodedata
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import numpy as np
import soundfile as sf


DESKTOP_DIR = Path(__file__).resolve().parents[1]
VOXCPM_DIR = Path(os.environ.get("DUBCUE_VOXCPM_DIR", DESKTOP_DIR.parent / "VoxCPM-main"))
sys.path.insert(0, str(VOXCPM_DIR / "src"))

from voxcpm import VoxCPM  # noqa: E402


HOST = os.environ.get("DUBCUE_BACKEND_HOST", "127.0.0.1")
PORT = int(os.environ.get("DUBCUE_BACKEND_PORT", "8810"))
SESSION_TOKEN = os.environ.get("DUBCUE_SESSION_TOKEN", "")
ALLOWED_ORIGINS = {
    "tauri://localhost",
    "http://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    *(origin.strip() for origin in os.environ.get("DUBCUE_ALLOWED_ORIGINS", "").split(",") if origin.strip()),
}
MODEL_ID = os.environ.get("DUBCUE_MODEL_ID", "openbmb/VoxCPM2")
ASR_MODEL_ID = os.environ.get("DUBCUE_ASR_MODEL_ID", "iic/SenseVoiceSmall")
ASR_DEVICE = os.environ.get("DUBCUE_ASR_DEVICE", "cpu")
OUTPUT_DIR = Path(os.environ.get("DUBCUE_OUTPUT_DIR", DESKTOP_DIR.parent / "outputs" / "desktop"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_model = None
_model_lock = threading.Lock()
_asr_model = None
_asr_model_lock = threading.Lock()
_generation_lock = threading.Lock()


def get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                print(f"[DubCue] Loading {MODEL_ID}...", flush=True)
                _model = VoxCPM.from_pretrained(
                    MODEL_ID,
                    device="auto",
                    optimize=False,
                    load_denoiser=False,
                    local_files_only=True,
                )
                print("[DubCue] VoxCPM2 ready.", flush=True)
    return _model


def get_asr_model():
    global _asr_model
    if _asr_model is None:
        with _asr_model_lock:
            if _asr_model is None:
                from funasr import AutoModel

                print(f"[DubCue] Loading ASR model {ASR_MODEL_ID}...", flush=True)
                _asr_model = AutoModel(
                    model=ASR_MODEL_ID,
                    disable_update=True,
                    log_level="ERROR",
                    device=ASR_DEVICE,
                )
                print("[DubCue] ASR model ready.", flush=True)
    return _asr_model


def spoken_character_count(text: str) -> int:
    return sum(
        1
        for char in text
        if not char.isspace() and not unicodedata.category(char).startswith(("P", "S"))
    )


def duration_seconds(audio: np.ndarray, sample_rate: int) -> float:
    return len(audio) / float(sample_rate)


def adjust_toward_target_cpm(audio: np.ndarray, sample_rate: int, text: str, target_cpm: float):
    count = max(1, spoken_character_count(text))
    actual_cpm = count / max(duration_seconds(audio, sample_rate) / 60.0, 1e-6)
    # Do not hard time-stretch generated speech by default. Even pitch-preserving
    # stretching can make cloned voices sound thinner and less natural, especially
    # after reference cloning. Target CPM is handled as a soft generation direction;
    # the returned CPM reports what the model actually produced.
    return np.asarray(audio, dtype=np.float32), actual_cpm


def save_reference(reference: dict | None) -> str | None:
    if not reference or not reference.get("base64"):
        return None
    suffix = Path(reference.get("name") or "reference.wav").suffix.lower()
    if suffix not in {".wav", ".mp3", ".flac", ".m4a", ".ogg"}:
        suffix = ".wav"
    path = OUTPUT_DIR / f"reference-{uuid.uuid4().hex}{suffix}"
    path.write_bytes(base64.b64decode(reference["base64"]))
    return str(path)


def safe_output_file(name: str) -> Path:
    clean = Path(unquote(name)).name
    path = (OUTPUT_DIR / clean).resolve()
    if path.parent != OUTPUT_DIR.resolve() or not path.exists():
        raise FileNotFoundError(clean)
    return path


def transcribe_reference(payload: dict) -> dict:
    reference_path = save_reference(payload.get("referenceAudio"))
    if not reference_path:
        raise ValueError("请先选择参考音频。")
    try:
        result = get_asr_model().generate(
            input=reference_path,
            language="auto",
            use_itn=True,
        )
        if not result:
            raise ValueError("没有识别到参考音频中的文字。")
        text = str(result[0].get("text") or "").split("|>")[-1].strip()
        if not text:
            raise ValueError("没有识别到参考音频中的文字。")
        return {"text": text}
    finally:
        Path(reference_path).unlink(missing_ok=True)


def generate_audio(payload: dict) -> dict:
    text = str(payload.get("text") or "").strip()
    if not text:
        raise ValueError("分段文本不能为空。")
    direction = re.sub(r"[()（）]", "", str(payload.get("direction") or "")).strip()
    target_cpm = max(80.0, min(420.0, float(payload.get("targetCpm") or 215)))
    cfg_value = max(1.0, min(3.0, float(payload.get("cfgValue") or 3.0)))
    inference_timesteps = max(1, min(50, int(payload.get("inferenceTimesteps") or 50)))
    prompt_text = str(payload.get("promptText") or "").strip()
    reference_path = save_reference(payload.get("referenceAudio"))

    model = get_model()
    generation_text = f"({direction}){text}" if direction else text
    with _generation_lock:
        generate_kwargs = dict(
            # VoxCPM2's documented parenthetical syntax controls performance.
            # Pacing is intentionally left to the user's performance direction.
            text=generation_text,
            reference_wav_path=reference_path,
            cfg_value=cfg_value,
            inference_timesteps=inference_timesteps,
            normalize=False,
            denoise=False,
        )
        if reference_path and prompt_text:
            generate_kwargs["prompt_wav_path"] = reference_path
            generate_kwargs["prompt_text"] = prompt_text
        audio = model.generate(**generate_kwargs)
    sample_rate = int(model.tts_model.sample_rate)
    audio = np.asarray(audio, dtype=np.float32).squeeze()
    audio, actual_cpm = adjust_toward_target_cpm(audio, sample_rate, text, target_cpm)

    filename = f"segment-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}.wav"
    output_path = OUTPUT_DIR / filename
    sf.write(output_path, audio, sample_rate)
    return {
        "audioUrl": f"/files/{filename}",
        "audioFile": filename,
        "durationSeconds": round(duration_seconds(audio, sample_rate), 3),
        "actualCpm": round(actual_cpm),
        "targetCpm": round(target_cpm),
    }


def merge_audio(payload: dict) -> dict:
    items = payload.get("items") or []
    if not items:
        raise ValueError("没有可合并的分段音频。")
    clips: list[np.ndarray] = []
    sample_rate = None
    for index, item in enumerate(items):
        path = safe_output_file(str(item.get("audioFile") or ""))
        audio, current_rate = sf.read(path, dtype="float32")
        audio = np.asarray(audio, dtype=np.float32)
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)
        if sample_rate is None:
            sample_rate = int(current_rate)
        if int(current_rate) != sample_rate:
            raise ValueError("分段音频采样率不一致。")
        clips.append(audio)
        if index < len(items) - 1:
            pause = max(0.0, min(10.0, float(item.get("pauseSeconds") or 0)))
            clips.append(np.zeros(int(sample_rate * pause), dtype=np.float32))
    merged = np.concatenate(clips)
    filename = f"dubcue-merged-{time.strftime('%Y%m%d-%H%M%S')}.wav"
    sf.write(OUTPUT_DIR / filename, merged, sample_rate or 24000)
    return {
        "audioUrl": f"/files/{filename}",
        "audioFile": filename,
        "durationSeconds": round(duration_seconds(merged, sample_rate or 24000), 3),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "DubCueBackend/0.1"

    def log_message(self, fmt: str, *args):
        print(f"[DubCue] {self.address_string()} {fmt % args}", flush=True)

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def json_response(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def authorized(self) -> bool:
        if not SESSION_TOKEN:
            return True
        return self.headers.get("Authorization", "") == f"Bearer {SESSION_TOKEN}"

    def do_GET(self):
        try:
            if not self.authorized():
                self.json_response(401, {"error": "Unauthorized"})
                return
            if self.path == "/health":
                self.json_response(200, {
                    "ok": True,
                    "modelLoaded": _model is not None,
                    "modelId": MODEL_ID,
                    "outputDirectory": str(OUTPUT_DIR),
                })
                return
            if self.path.startswith("/files/"):
                path = safe_output_file(self.path.removeprefix("/files/"))
                body = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.json_response(404, {"error": "Not found"})
        except Exception as exc:
            self.json_response(400, {"error": str(exc)})

    def do_POST(self):
        try:
            if not self.authorized():
                self.json_response(401, {"error": "Unauthorized"})
                return
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/generate":
                self.json_response(200, generate_audio(payload))
                return
            if self.path == "/transcribe-reference":
                self.json_response(200, transcribe_reference(payload))
                return
            if self.path == "/merge":
                self.json_response(200, merge_audio(payload))
                return
            self.json_response(404, {"error": "Not found"})
        except Exception as exc:
            self.json_response(500, {"error": str(exc)})


def main():
    print(f"[DubCue] Backend listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
