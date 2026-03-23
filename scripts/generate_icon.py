#!/usr/bin/env python3
"""
Generate WildDex app icon using DALL-E 3.
Usage: OPENAI_API_KEY=sk-... python3 scripts/generate_icon.py
"""
import os, urllib.request, json

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("Error: set OPENAI_API_KEY environment variable")
    exit(1)

prompt = (
    "App icon for a wildlife identification app. "
    "A stylized, bold illustration of a Siberian Husky dog face, front-facing. "
    "The husky has black and dark gray fur on top of the head and around the eyes, "
    "a white/cream face mask, amber/brown eyes, and pointy ears. Happy expression with tongue out. "
    "Clean flat design with minimal detail, suitable for a mobile app icon. "
    "Dark background (#1a1a1a). Bold, graphic, icon-friendly style. No text."
)

payload = json.dumps({
    "model": "dall-e-3",
    "prompt": prompt,
    "n": 1,
    "size": "1024x1024",
    "quality": "hd",
    "style": "vivid",
}).encode()

req = urllib.request.Request(
    "https://api.openai.com/v1/images/generations",
    data=payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
)

with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())

image_url = data["data"][0]["url"]
print(f"Generated: {image_url}")

# Download to assets/icon_dalle.png
urllib.request.urlretrieve(image_url, "assets/icon_dalle.png")
print("Saved to assets/icon_dalle.png")
