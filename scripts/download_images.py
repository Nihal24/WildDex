"""
Downloads training images from iNaturalist API for top 500 species.
Uses the observation photos endpoint — no auth required for read access.

Output structure:
  dataset/train/<class_label>/  — 80% of images
  dataset/val/<class_label>/    — 20% of images

Usage:
  python3 scripts/download_images.py
  python3 scripts/download_images.py --species-file scripts/top_500_species.json --images-per-species 50 --output-dir dataset
"""

import requests
import json
import os
import time
import argparse
import random
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

INAT_API = 'https://api.inaturalist.org/v1'
HEADERS = {'User-Agent': 'WildDexTrainingScript/1.0'}

def get_taxon_id(scientific_name: str) -> int | None:
    """Look up iNaturalist taxon ID for a scientific name."""
    r = requests.get(f'{INAT_API}/taxa', params={'q': scientific_name, 'rank': 'species', 'per_page': 1}, headers=HEADERS, timeout=10)
    if not r.ok:
        return None
    results = r.json().get('results', [])
    if not results:
        return None
    return results[0]['id']

def get_photo_urls(taxon_id: int, count: int) -> list[str]:
    """Fetch up to `count` research-grade observation photo URLs for a taxon."""
    urls = []
    page = 1
    per_page = min(count, 100)
    while len(urls) < count:
        params = {
            'taxon_id': taxon_id,
            'quality_grade': 'research',
            'photos': 'true',
            'per_page': per_page,
            'page': page,
            'order': 'desc',
            'order_by': 'votes',
        }
        r = requests.get(f'{INAT_API}/observations', params=params, headers=HEADERS, timeout=15)
        if not r.ok:
            break
        results = r.json().get('results', [])
        if not results:
            break
        for obs in results:
            for photo in obs.get('photos', []):
                url = photo.get('url', '').replace('/square.', '/medium.')
                if url:
                    urls.append(url)
                    if len(urls) >= count:
                        break
            if len(urls) >= count:
                break
        page += 1
        time.sleep(0.3)
    return urls

def download_image(url: str, dest: Path) -> bool:
    """Download a single image. Returns True on success."""
    try:
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.ok and 'image' in r.headers.get('Content-Type', ''):
            dest.write_bytes(r.content)
            return True
    except Exception:
        pass
    return False

def process_species(species: dict, output_dir: str, images_per_species: int) -> dict:
    label = species['class_label']
    scientific = species['scientific_name']
    common = species['common_name']

    train_dir = Path(output_dir) / 'train' / label
    val_dir = Path(output_dir) / 'val' / label
    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)

    # Skip if already downloaded
    existing = list(train_dir.glob('*.jpg')) + list(val_dir.glob('*.jpg'))
    if len(existing) >= images_per_species * 0.8:
        return {'label': label, 'status': 'skipped', 'count': len(existing)}

    taxon_id = get_taxon_id(scientific)
    if not taxon_id:
        return {'label': label, 'status': 'no_taxon', 'count': 0}

    urls = get_photo_urls(taxon_id, images_per_species)
    if not urls:
        return {'label': label, 'status': 'no_photos', 'count': 0}

    random.shuffle(urls)
    split = int(len(urls) * 0.8)
    train_urls = urls[:split]
    val_urls = urls[split:]

    downloaded = 0
    for i, url in enumerate(train_urls):
        dest = train_dir / f'{label}_{i:04d}.jpg'
        if download_image(url, dest):
            downloaded += 1

    for i, url in enumerate(val_urls):
        dest = val_dir / f'{label}_val_{i:04d}.jpg'
        if download_image(url, dest):
            downloaded += 1

    return {'label': label, 'status': 'ok', 'count': downloaded}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--species-file', default='scripts/top_500_species.json')
    parser.add_argument('--images-per-species', type=int, default=50)
    parser.add_argument('--output-dir', default='dataset')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--start', type=int, default=0, help='Start from species index')
    parser.add_argument('--end', type=int, default=None, help='End at species index (exclusive)')
    args = parser.parse_args()

    with open(args.species_file) as f:
        species_list = json.load(f)

    subset = species_list[args.start:args.end]
    print(f"Downloading images for {len(subset)} species ({args.images_per_species} each)...")
    print(f"Estimated images: ~{len(subset) * args.images_per_species:,}")
    print(f"Output: {args.output_dir}/train/ and {args.output_dir}/val/\n")

    results = {'ok': 0, 'skipped': 0, 'failed': 0}

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_species, sp, args.output_dir, args.images_per_species): sp
            for sp in subset
        }
        for i, future in enumerate(as_completed(futures)):
            sp = futures[future]
            result = future.result()
            status = result['status']
            count = result['count']
            if status == 'ok':
                results['ok'] += 1
                icon = 'ok'
            elif status == 'skipped':
                results['skipped'] += 1
                icon = 'skip'
            else:
                results['failed'] += 1
                icon = 'FAIL'
            print(f"[{i+1}/{len(subset)}] {icon} {result['label']} — {count} images")

    print(f"\nDone. ok={results['ok']} skipped={results['skipped']} failed={results['failed']}")
    print(f"Next: upload dataset/ to S3, then run SageMaker training job.")


if __name__ == '__main__':
    main()
