---
name: youtube-content
description: Extract transcripts, download audio/video, and analyze YouTube content using youtube-transcript-api and yt-dlp
category: research
version: 1.0.0
origin: aiden
tags: youtube, transcript, video, audio, download, subtitles, yt-dlp, content, summary
---

# YouTube Content Extraction

Extract transcripts, download audio or video, and retrieve metadata from YouTube using `youtube-transcript-api` (Python) and `yt-dlp`.

## When to Use

- User wants to get the transcript of a YouTube video
- User wants to summarize a YouTube video without watching it
- User wants to download audio from a YouTube video
- User wants to download a video for offline viewing
- User wants to search for metadata (title, duration, views) of a video

## How to Use

### 1. Install required tools

```powershell
pip install youtube-transcript-api
pip install yt-dlp
# Verify
yt-dlp --version
```

### 2. Get a video transcript (Python)

```python
from youtube_transcript_api import YouTubeTranscriptApi

video_id = "dQw4w9WgXcQ"   # from youtube.com/watch?v=<id>
transcript = YouTubeTranscriptApi.get_transcript(video_id)
text = " ".join(entry["text"] for entry in transcript)
print(text[:2000])
```

### 3. Get transcript in a specific language

```python
from youtube_transcript_api import YouTubeTranscriptApi

video_id = "dQw4w9WgXcQ"
# Try English first, then auto-generated
transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US"])
text = " ".join(entry["text"] for entry in transcript)
```

### 4. List available transcript languages for a video

```python
from youtube_transcript_api import YouTubeTranscriptApi

video_id = "dQw4w9WgXcQ"
transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
for t in transcript_list:
  print(t.language, t.language_code, "auto-generated:", t.is_generated)
```

### 5. Download audio (MP3) with yt-dlp

```powershell
$videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
yt-dlp -x --audio-format mp3 -o "%(title)s.%(ext)s" $videoUrl
```

### 6. Download video (best quality)

```powershell
$videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
yt-dlp -f "bestvideo+bestaudio" --merge-output-format mp4 -o "%(title)s.%(ext)s" $videoUrl
```

### 7. Download video at specific quality

```powershell
# List available formats first
yt-dlp -F $videoUrl

# Download 720p
yt-dlp -f "bestvideo[height<=720]+bestaudio" --merge-output-format mp4 -o "%(title)s.%(ext)s" $videoUrl
```

### 8. Get video metadata (no download)

```powershell
yt-dlp --dump-json --no-download $videoUrl | python -m json.tool | Select-String -Pattern '"title"|"duration"|"view_count"|"upload_date"'
```

### 9. Download an entire playlist

```powershell
$playlistUrl = "https://www.youtube.com/playlist?list=PLxxxxxx"
yt-dlp -x --audio-format mp3 -o "%(playlist_index)s-%(title)s.%(ext)s" $playlistUrl
```

## Examples

**"Get me the transcript of this YouTube tutorial so I can read it"**
→ Use step 2 — extract video ID from URL and call `get_transcript`.

**"Download the audio from this podcast episode on YouTube"**
→ Use step 5 with the video URL to download as MP3.

**"What languages are available for transcripts on this video?"**
→ Use step 4 to list available transcript languages.

## Cautions

- `youtube-transcript-api` only works for videos that have transcripts (manual or auto-generated)
- Auto-generated transcripts may have errors, especially for technical content or non-English speech
- Downloading videos may be subject to YouTube's Terms of Service — use for personal research and fair use only
- yt-dlp may need updates when YouTube changes its API: run `yt-dlp -U` to update
- Rate limiting may occur on rapid consecutive downloads — add delays between requests for playlists
