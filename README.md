# WildDex 🦅

**A real life Pokédex.** Point your camera at any animal and instantly identify it — species name, fun facts, conservation status, and more.

Available on iOS via TestFlight.

---

## What it does

- **Identify any animal** from a photo using AI — birds, mammals, reptiles, insects, fish, and more
- **Build your WildDex** — every unique species you spot gets logged to your personal collection
- **Social feed** — share sightings with location, like and comment on others
- **Species info** — Wikipedia-powered descriptions, range maps, taxonomy pulled from iNaturalist
- **Badges** — earn achievements as your collection grows
- **Dark/light mode**, pinch-to-zoom camera, offline-capable identification

---

## Tech Stack

**Mobile**
- React Native + Expo
- TypeScript
- Expo Camera with pinch-to-zoom
- react-native-fast-tflite — on-device ML inference

**Backend**
- Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- Supabase Realtime for live feed updates

**AI / ML**
- Claude Sonnet (Anthropic) — primary animal identification via vision API
- EfficientNetB0 — custom 500-species classifier, trained via AWS SageMaker on 100k iNaturalist images, exported to TFLite float16 (~14MB) for on-device inference
- Hybrid approach: TFLite runs on-device first, Claude handles rare/ambiguous species as fallback

**ML Pipeline**
- Data: 100k research-grade images scraped from iNaturalist API (500 species, 200 images each)
- Training: AWS SageMaker (TensorFlow Estimator, ml.g4dn.xlarge T4 GPU)
- Architecture: EfficientNetB0 transfer learning — 2-phase training (frozen base → fine-tune top 30 layers)
- Export: TFLite float16 quantization via TFLiteConverter

**Infrastructure**
- S3 for training data and model artifacts
- Supabase Storage (CDN-cached) for sighting photos
- Supabase Edge Functions (Deno) for serverless AI calls

---

## Architecture

```
User takes photo
      ↓
On-device TFLite model (~50ms, free, works offline)
      ↓ confidence < 70% or species not in model
Claude Sonnet vision API (covers rare/ambiguous species)
      ↓
Species identified → logged to Supabase → appears in feed
```

---

## Project Structure

```
screens/          React Native screens (Camera, Feed, WildDex, Profile, etc.)
components/       Shared UI components
utils/            Supabase client, storage helpers, badge logic
supabase/
  functions/      Edge Functions (identify-animal, get-animal-profile)
  migrations/     Database schema
scripts/          ML pipeline (download_images.py, wilddex_train_script.py, sagemaker_train.ipynb)
constants/        Theme, colors
```
