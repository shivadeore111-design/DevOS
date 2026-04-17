#!/usr/bin/env python3
# ============================================================
# DevOS — Autonomous AI Execution System
# Copyright (c) 2026 Shiva Deore. All rights reserved.
# ============================================================
#
# core/voice/voxcpm_runner.py — VoxCPM2 subprocess runner.
#
# This script is spawned by core/voice/tts.ts as a child process.
# It reads a JSON payload from stdin and writes a JSON result to stdout.
#
# VoxCPM2 attribution:
#   Model:    VoxCPM (OpenBMB / Nous Research)
#   License:  Apache 2.0
#   GitHub:   https://github.com/OpenBMB/MiniCPM-o
#   HuggingFace: https://huggingface.co/openbmb/VoxCPM
#   Paper:    arXiv:2412.09345
#
# Input JSON (via stdin):
#   {
#     "text":               string,          # required — text to synthesize
#     "output_path":        string,          # required — WAV output path
#     "mode":               "tts" | "clone" | "design",
#     "reference_audio":    string | null,   # clone mode — path to reference WAV
#     "voice_description":  string | null,   # design mode — text description of voice
#     "language":           string           # default "en"
#   }
#
# Output JSON (to stdout):
#   { "ok": true,  "output_path": "...", "duration_ms": 1234 }
#   { "ok": false, "error": "..." }
#
# Requirements:
#   pip install torch torchaudio transformers accelerate
#   pip install voxcpm  (or install from source per VOXCPM_SETUP.md)

import sys
import json
import time
import os

def run(payload: dict) -> dict:
    text              = payload.get("text", "")
    output_path       = payload.get("output_path", "")
    mode              = payload.get("mode", "tts")           # tts | clone | design
    reference_audio   = payload.get("reference_audio")       # for clone
    voice_description = payload.get("voice_description")     # for design
    language          = payload.get("language", "en")

    if not text:
        return {"ok": False, "error": "No text provided"}
    if not output_path:
        return {"ok": False, "error": "No output_path provided"}

    t0 = time.time()

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as e:
        return {"ok": False, "error": f"Missing dependency: {e}. Run: pip install torch transformers"}

    try:
        from voxcpm import VoxCPM  # type: ignore
    except ImportError:
        return {"ok": False, "error": "No module named voxcpm. See docs/VOXCPM_SETUP.md for install instructions."}

    try:
        model_name = os.environ.get("VOXCPM_MODEL", "openbmb/VoxCPM")
        device     = "cuda" if torch.cuda.is_available() else "cpu"

        model = VoxCPM.from_pretrained(model_name).to(device)
        model.eval()

        if mode == "clone":
            if not reference_audio:
                return {"ok": False, "error": "reference_audio required for clone mode"}
            wav_tensor = model.clone_voice(
                text            = text,
                reference_audio = reference_audio,
                language        = language,
            )
        elif mode == "design":
            if not voice_description:
                return {"ok": False, "error": "voice_description required for design mode"}
            wav_tensor = model.design_voice(
                text              = text,
                voice_description = voice_description,
                language          = language,
            )
        else:
            # standard TTS
            wav_tensor = model.synthesize(text=text, language=language)

        # Save as WAV
        import torchaudio
        sample_rate = model.sample_rate if hasattr(model, "sample_rate") else 22050
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
        torchaudio.save(output_path, wav_tensor.unsqueeze(0).cpu(), sample_rate)

        duration_ms = int((time.time() - t0) * 1000)
        return {"ok": True, "output_path": output_path, "duration_ms": duration_ms}

    except torch.cuda.OutOfMemoryError:
        return {"ok": False, "error": "CUDA out of memory. Try reducing text length or using CPU (unset CUDA_VISIBLE_DEVICES)."}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    try:
        raw     = sys.stdin.read()
        payload = json.loads(raw)
        result  = run(payload)
    except json.JSONDecodeError as e:
        result = {"ok": False, "error": f"Invalid JSON input: {e}"}
    except Exception as e:
        result = {"ok": False, "error": f"Runner error: {e}"}

    print(json.dumps(result))
    sys.stdout.flush()
