# VoxCPM2 Setup Guide

VoxCPM2 is an open-source, Apache-2.0-licensed text-to-speech model developed by
**OpenBMB** (Tsinghua University) and **Nous Research**. It supports 30+ languages,
voice cloning from 5–10 s of reference audio, and voice design from a text description.

## Attribution

| Field        | Details |
|--------------|---------|
| Model name   | VoxCPM (part of the MiniCPM-o family) |
| Authors      | OpenBMB / Tsinghua University, Nous Research |
| License      | Apache 2.0 |
| GitHub       | <https://github.com/OpenBMB/MiniCPM-o> |
| HuggingFace  | <https://huggingface.co/openbmb/VoxCPM> |
| Paper        | arXiv:2412.09345 — *MiniCPM-o: A GPT-4o Level MLLM for Vision, Speech and Multimodal Live Streaming* |

---

## Requirements

- Python 3.10+
- CUDA-capable GPU with 8 GB+ VRAM (recommended) — CPU fallback is supported but slow
- ~4 GB disk space for model weights

---

## Installation

### 1. Create a dedicated virtual environment (recommended)

```bash
python -m venv .venv-voxcpm
# Windows
.venv-voxcpm\Scripts\activate
# macOS / Linux
source .venv-voxcpm/bin/activate
```

### 2. Install PyTorch (CUDA 12.1 example — adjust to your CUDA version)

```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

For CPU-only:
```bash
pip install torch torchaudio
```

### 3. Install VoxCPM and dependencies

```bash
pip install transformers accelerate huggingface_hub
pip install git+https://github.com/OpenBMB/MiniCPM-o.git#egg=voxcpm
```

### 4. Download the model weights

The model is downloaded automatically on first use. To pre-download:

```python
from huggingface_hub import snapshot_download
snapshot_download("openbmb/VoxCPM", local_dir="./models/voxcpm")
```

Set `VOXCPM_MODEL` env var to use a local path:
```bash
VOXCPM_MODEL=./models/voxcpm
```

---

## Enabling VoxCPM in DevOS

Add to your `.env` or shell profile:

```bash
USE_VOXCPM=1
```

DevOS will automatically place VoxCPM at the top of the TTS provider chain.

---

## Usage

### CLI

```
# Toggle voice design
/voice design "calm, deep male voice with slight British accent"

# Toggle voice clone from reference audio
/voice clone ./reference.wav

# Reset to standard provider chain
/voice reset

# Show all TTS providers and availability
/voice providers
```

### SDK

```typescript
// Standard TTS (falls through provider chain)
await aiden.voice.speak("Hello from DevOS!")

// Voice clone
await aiden.voice.clone("This is my cloned voice.", "./reference.wav")

// Voice design
await aiden.voice.design("Welcome to the briefing.", "calm, deep male voice")

// List providers
const providers = await aiden.voice.providers()
```

### Tool names (for agent plans)

| Tool           | Description |
|----------------|-------------|
| `voice_speak`  | Standard TTS with provider fallback |
| `voice_clone`  | Clone voice from reference audio |
| `voice_design` | Design voice from text description |

---

## Troubleshooting

### "No module named voxcpm"

VoxCPM is not installed. Follow the Installation steps above.

### "CUDA out of memory"

Your GPU has less than 8 GB VRAM. Options:
1. Use CPU by setting `CUDA_VISIBLE_DEVICES=-1`
2. Reduce text length (VoxCPM works best with ≤500 characters per call)
3. Use a machine with more VRAM

### VoxCPM is slow

VoxCPM on CPU is roughly 10–30× slower than GPU. A 5-second audio clip may take
30–90 seconds on CPU. For real-time use, GPU acceleration is strongly recommended.

### VoxCPM not used even with USE_VOXCPM=1

Check the `[TTS]` logs in the DevOS console. Common causes:
- Python binary not in PATH — check `python --version`
- Wrong virtual environment active — the `python` that DevOS spawns must have voxcpm installed
- Model download in progress on first run

---

## Privacy

VoxCPM runs entirely on your local machine. No audio data or text is sent to any
external server. Reference audio files are read locally and not persisted beyond
the current synthesis session.

---

*Last updated: 2026-04-17*
