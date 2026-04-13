"""
Fetches the top 500 most observed species from iNaturalist API.
Outputs: scripts/top_500_species.json
"""

import requests
import json
import time

TOP_N = 500
PER_PAGE = 100  # iNat max per request
OUTPUT_FILE = 'scripts/top_500_species.json'

# Only include animal taxa (Animalia kingdom)
ANIMALIA_TAXON_ID = 1

species = []
page = 1

print(f"Fetching top {TOP_N} species from iNaturalist...")

while len(species) < TOP_N:
    url = 'https://api.inaturalist.org/v1/taxa'
    params = {
        'taxon_id': ANIMALIA_TAXON_ID,
        'rank': 'species',
        'order': 'desc',
        'order_by': 'observations_count',
        'per_page': PER_PAGE,
        'page': page,
    }

    res = requests.get(url, params=params)
    if not res.ok:
        print(f"Error on page {page}: {res.status_code}")
        break

    data = res.json()
    results = data.get('results', [])
    if not results:
        break

    for taxon in results:
        common_name = taxon.get('preferred_common_name', '').strip().lower()
        scientific_name = taxon.get('name', '').strip()
        obs_count = taxon.get('observations_count', 0)

        if not common_name:
            continue  # skip species with no common name

        species.append({
            'common_name': common_name,
            'scientific_name': scientific_name,
            'observations_count': obs_count,
            'class_label': common_name.replace(' ', '_').replace('-', '_'),
        })

    print(f"Page {page}: fetched {len(results)} — total so far: {len(species)}")
    page += 1
    time.sleep(0.5)  # be polite to the API

# Trim to exactly TOP_N
species = species[:TOP_N]

with open(OUTPUT_FILE, 'w') as f:
    json.dump(species, f, indent=2)

print(f"\nDone. Saved {len(species)} species to {OUTPUT_FILE}")
print("\nTop 10:")
for s in species[:10]:
    print(f"  {s['common_name']} ({s['scientific_name']}) — {s['observations_count']:,} observations")
