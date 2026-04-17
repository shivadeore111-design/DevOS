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
- ~4–5 GB disk space for model weights

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

### 4. Download the model (4–5 GB, one-time)

```bash
pip install huggingface_hub
huggingface-cli download openbmb/VoxCPM2 --local-dir ~/.cache/voxcpm/VoxCPM2
```

Alternatively, via Python:

```python
from huggingface_hub import snapshot_download
snapshot_download("openbmb/VoxCPM2", local_dir="~/.cache/voxcpm/VoxCPM2")
```

### 5. Enable in DevOS by setting environment variables

```bash
USE_VOXCPM=1
VOXCPM_MODEL_PATH=~/.cache/voxcpm/VoxCPM2
```

On **Windows (PowerShell)** — set persistently for your user account:

```powershell
[Environment]::SetEnvironmentVariable('USE_VOXCPM', '1', 'User')
[Environment]::SetEnvironmentVariable('VOXCPM_MODEL_PATH', "$HOME/.cache/voxcpm/VoxCPM2", 'User')
```

### 6. Restart DevOS and verify

```
/voice providers
```

VoxCPM should appear at position 1 with **active** status.

---

## Usage

### Basic TTS

```
/speak "Hello from VoxCPM, speaking naturally."
```

### Voice design (no reference audio needed)

```
/voice design "Young female voice, warm and gentle, radio announcer"
/speak "This is now the designed voice."
```

### Voice cloning (requires reference audio)

```
/voice clone ~/my_voice_sample.wav
/speak "This sounds like you."
```

### Reset

```
/voice reset
```

Returns to the default VoxCPM voice, clearing any active design or clone.

### Agent usage

When VoxCPM is active, the planner can call `voice_speak`, `voice_clone`, and
`voice_design` as first-class tools in multi-step tasks. Example:

> **User:** "Clone the voice from attached.wav and read monthly_report.md aloud"
>
> **Agent plan:**
> 1. `voice_clone(referenceAudioPath: "attached.wav")`
> 2. `file_read("monthly_report.md")`
> 3. `voice_speak(text: <content>)`

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

| Tool             | Description |
|------------------|-------------|
| `voice_speak`    | Standard TTS with provider fallback |
| `voice_clone`    | Clone voice from reference audio |
| `voice_design`   | Design voice from text description |
| `voice_transcribe` | Speech-to-text from an audio file |

---

## When to use each provider

| Need                          | Provider     |
|-------------------------------|--------------|
| Simple English TTS, fast, free | Edge TTS    |
| Best quality English TTS, paid | ElevenLabs  |
| Offline TTS, any Windows machine | Windows SAPI |
| Multilingual (30+ languages)  | VoxCPM       |
| Voice cloning                 | VoxCPM       |
| Voice design from text        | VoxCPM       |

---

## Troubleshooting

### "No module named voxcpm"

VoxCPM is not installed, or the wrong Python environment is active.

```bash
python -c "import voxcpm"   # should print nothing on success
```

If it fails, re-run the `pip install` step in the correct virtual environment.

### "Model not found at VOXCPM_MODEL_PATH"

The `huggingface-cli download` step was skipped. Re-run:

```bash
huggingface-cli download openbmb/VoxCPM2 --local-dir ~/.cache/voxcpm/VoxCPM2
```

### "CUDA out of memory"

Your GPU has less than 8 GB VRAM. Options:

1. Lower inference steps by reducing text length (VoxCPM works best with ≤500 chars per call)
2. Close other GPU-heavy applications
3. Use CPU mode by setting `CUDA_VISIBLE_DEVICES=-1`
4. Use a machine with more VRAM

### "python3 not found" on Windows

Set the `VOXCPM_PYTHON_CMD` environment variable to point at your Python binary:

```powershell
[Environment]::SetEnvironmentVariable('VOXCPM_PYTHON_CMD', 'python', 'User')
```

### VoxCPM is slow

VoxCPM on CPU is roughly 10–30× slower than GPU. A 5-second audio clip may take
30–90 seconds on CPU. For real-time use, GPU acceleration is strongly recommended.

### VoxCPM not appearing in `/voice providers`

Confirm `USE_VOXCPM=1` is set in the **same shell** where you launch DevOS.

```powershell
echo $env:USE_VOXCPM   # PowerShell
```

```bash
echo $USE_VOXCPM       # bash / zsh
```

Common causes:
- Python binary not in PATH — check `python --version`
- Wrong virtual environment active — the `python` that DevOS spawns must have voxcpm installed
- Model download still in progress on first run

---

## Privacy

VoxCPM runs entirely on your local machine. No audio data or text is sent to any
external server. Reference audio files are read locally and not persisted beyond
the current synthesis session.

---

*Last updated: 2026-04-17*
