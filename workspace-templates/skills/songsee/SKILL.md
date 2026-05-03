---
name: songsee
description: Visualize audio files as mel spectrograms, chromagrams, and MFCC plots using Python librosa
category: media
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: audio, spectrogram, mel, chroma, mfcc, librosa, visualization, music, sound-analysis
---

# Audio Visualization with Spectrograms

Visualize audio files as mel spectrograms, chromagrams, and MFCC feature plots using the `librosa` Python library. Useful for music analysis, speech processing, and audio debugging.

## When to Use

- User wants to visualize what an audio file "looks like"
- User wants to analyze the frequency content of a recording
- User wants to compare two audio files visually
- User wants to understand musical key or chroma content
- User wants to extract MFCC features for a machine learning task

## How to Use

### 1. Install dependencies

```powershell
pip install librosa matplotlib soundfile
```

### 2. Generate a mel spectrogram

```python
import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np

def mel_spectrogram(audio_path, output="mel_spec.png"):
  y, sr = librosa.load(audio_path, sr=None)
  S     = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
  S_db  = librosa.power_to_db(S, ref=np.max)

  fig, ax = plt.subplots(figsize=(12, 4), facecolor="#0d1117")
  ax.set_facecolor("#0d1117")
  img = librosa.display.specshow(S_db, sr=sr, x_axis="time", y_axis="mel", fmax=8000, ax=ax, cmap="magma")
  fig.colorbar(img, ax=ax, format="%+2.0f dB", label="dB")
  ax.set_title(f"Mel Spectrogram — {audio_path}", color="white")
  ax.tick_params(colors="white")
  ax.xaxis.label.set_color("white")
  ax.yaxis.label.set_color("white")
  plt.tight_layout()
  plt.savefig(output, dpi=150, bbox_inches="tight")
  plt.close()
  print(f"Saved: {output}")

mel_spectrogram("song.mp3")
```

### 3. Generate a chromagram (musical key content)

```python
import librosa, librosa.display, matplotlib.pyplot as plt

def chromagram(audio_path, output="chroma.png"):
  y, sr   = librosa.load(audio_path, sr=None)
  chroma  = librosa.feature.chroma_cqt(y=y, sr=sr)

  fig, ax = plt.subplots(figsize=(12, 4), facecolor="#0d1117")
  ax.set_facecolor("#0d1117")
  img = librosa.display.specshow(chroma, y_axis="chroma", x_axis="time", ax=ax, cmap="coolwarm")
  fig.colorbar(img, ax=ax)
  ax.set_title("Chromagram", color="white")
  ax.tick_params(colors="white")
  plt.tight_layout()
  plt.savefig(output, dpi=150, bbox_inches="tight")
  plt.close()
  print(f"Saved: {output}")

chromagram("song.mp3")
```

### 4. Generate MFCC features

```python
import librosa, librosa.display, matplotlib.pyplot as plt
import numpy as np

def mfcc_plot(audio_path, n_mfcc=20, output="mfcc.png"):
  y, sr = librosa.load(audio_path, sr=None)
  mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)

  fig, ax = plt.subplots(figsize=(12, 4), facecolor="#0d1117")
  ax.set_facecolor("#0d1117")
  img = librosa.display.specshow(mfccs, x_axis="time", ax=ax, cmap="viridis")
  fig.colorbar(img, ax=ax)
  ax.set_title(f"MFCC ({n_mfcc} coefficients)", color="white")
  ax.tick_params(colors="white")
  plt.tight_layout()
  plt.savefig(output, dpi=150, bbox_inches="tight")
  plt.close()
  print(f"Saved: {output}")

mfcc_plot("speech.wav", n_mfcc=13)
```

### 5. Generate all three plots at once

```python
def analyze_audio(audio_path):
  base = audio_path.rsplit(".", 1)[0]
  mel_spectrogram(audio_path, output=f"{base}_mel.png")
  chromagram(audio_path,      output=f"{base}_chroma.png")
  mfcc_plot(audio_path,       output=f"{base}_mfcc.png")
  print(f"Analysis complete: 3 PNG files saved for {audio_path}")

analyze_audio("recording.wav")
```

### 6. Get basic audio statistics

```python
import librosa, numpy as np

y, sr     = librosa.load("audio.mp3", sr=None)
duration  = librosa.get_duration(y=y, sr=sr)
tempo, _  = librosa.beat.beat_track(y=y, sr=sr)
rms       = np.sqrt(np.mean(y**2))

print(f"Duration:   {duration:.2f} seconds")
print(f"Sample rate:{sr} Hz")
print(f"Tempo:      {tempo:.1f} BPM")
print(f"RMS energy: {rms:.4f}")
```

## Examples

**"Show me what this audio recording looks like as a spectrogram"**
→ Use step 2 to generate a mel spectrogram PNG. Open the saved file.

**"What musical key is this song in? Visualize the chroma content"**
→ Use step 3 to generate a chromagram — peaks in chroma rows indicate dominant pitch classes.

**"Generate MFCC features from this speech recording for my ML model"**
→ Use step 4 to plot MFCCs, then extract the `mfccs` array for downstream ML use.

## Cautions

- librosa loads audio in float32 mono by default — stereo files are mixed down automatically
- Large audio files (> 30 minutes) take significant time and memory to process — slice with `offset` and `duration` parameters if needed
- `librosa.load` supports MP3, WAV, FLAC, OGG — ensure `soundfile` and `audioread` are installed for MP3 support
- MFCC coefficients are sensitive to `n_mfcc` and `sr` — use consistent settings across all files in an ML dataset
