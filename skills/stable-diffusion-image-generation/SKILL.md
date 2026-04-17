---
name: stable-diffusion-image-generation
description: Generate images using Stable Diffusion via HuggingFace Diffusers library locally or via API
category: creative
version: 1.0.0
origin: aiden
tags: stable-diffusion, image-generation, ai-art, diffusers, huggingface, text-to-image, sdxl, creative
---

# Stable Diffusion Image Generation

Generate images from text prompts using Stable Diffusion locally via HuggingFace Diffusers, or via the HuggingFace Inference API for zero-install operation.

## When to Use

- User wants to generate an image from a text description
- User wants to create concept art, illustrations, or visual mockups
- User wants to experiment with AI image generation locally
- User wants to generate multiple variations of an image
- User wants to use img2img (image-to-image) transformation

## How to Use

### 1. Quick generation via HuggingFace Inference API (no GPU needed)

```python
import requests, base64, os

def generate_image_api(prompt, output="output.png"):
  api_url = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
  headers = {"Authorization": f"Bearer {os.environ['HF_TOKEN']}"}
  resp    = requests.post(api_url, headers=headers, json={"inputs": prompt}, timeout=120)
  resp.raise_for_status()
  with open(output, "wb") as f:
    f.write(resp.content)
  print(f"Saved: {output}")

# Set HF_TOKEN in env: huggingface.co/settings/tokens
generate_image_api("a futuristic city at night, cyberpunk style, neon lights, 8k")
```

### 2. Local generation with Diffusers (requires GPU or CPU + patience)

```python
# pip install diffusers transformers accelerate torch
from diffusers import StableDiffusionXLPipeline
import torch

pipe = StableDiffusionXLPipeline.from_pretrained(
  "stabilityai/stable-diffusion-xl-base-1.0",
  torch_dtype=torch.float16,
  use_safetensors=True
)
pipe = pipe.to("cuda")   # use "cpu" if no GPU (very slow)

image = pipe(
  prompt="a majestic mountain landscape at golden hour, photorealistic",
  negative_prompt="blurry, low quality, cartoon",
  num_inference_steps=30,
  guidance_scale=7.5,
  width=1024, height=1024
).images[0]

image.save("landscape.png")
print("Saved: landscape.png")
```

### 3. Generate multiple variations

```python
images = pipe(
  prompt="a robot reading a book in a cozy library",
  num_images_per_prompt=4,
  num_inference_steps=25,
).images

for i, img in enumerate(images):
  img.save(f"variation_{i+1}.png")
  print(f"Saved variation_{i+1}.png")
```

### 4. Write effective prompts

Good prompt structure:
```
[subject], [style], [setting/background], [lighting], [quality tags]

Examples:
"a golden retriever puppy, oil painting style, in a sunlit meadow, warm afternoon light, highly detailed"
"abstract data visualization, dark background, glowing cyan lines, geometric patterns, 4k"
"portrait of a scientist, dramatic studio lighting, photorealistic, sharp focus, professional headshot"
```

Useful negative prompt additions:
```
"blurry, low quality, watermark, signature, deformed, extra limbs, bad anatomy, poorly drawn"
```

### 5. CPU-only generation (slower but works without GPU)

```python
from diffusers import StableDiffusionPipeline
import torch

pipe = StableDiffusionPipeline.from_pretrained(
  "runwayml/stable-diffusion-v1-5",
  torch_dtype=torch.float32
)

image = pipe(
  prompt="a simple landscape, watercolor style",
  num_inference_steps=15,    # fewer steps = faster on CPU
  width=512, height=512      # smaller size for CPU
).images[0]
image.save("output.png")
```

## Examples

**"Generate an image of a futuristic AI lab"**
→ Use step 1 (API) if `HF_TOKEN` is set. Prompt: `"futuristic AI research lab, holographic displays, clean aesthetic, cinematic lighting"`.

**"Create 4 variations of a logo concept for a tech startup"**
→ Use step 3 with a logo-style prompt and `num_images_per_prompt=4`.

**"Generate an image locally without internet"**
→ Use step 2 (local Diffusers). SDXL needs ~8GB VRAM; for CPU use step 5 with SD v1.5 at 512×512.

## Cautions

- SDXL requires at least 8GB VRAM for float16; use SD v1.5 (step 5) on CPU or low-VRAM GPUs
- First run downloads model weights (~6-7GB) — this takes time; subsequent runs use cache
- HuggingFace Inference API free tier has rate limits — set a delay between requests for batch generation
- Generated images may reflect biases in training data — review outputs before publishing
- `HF_TOKEN` must be set as an environment variable — never hardcode it in scripts
