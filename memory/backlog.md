---
name: Backlog
description: Known issues and deferred improvements for WildDex
type: project
---

## MVP 2 — Badges expansion
New badge ideas to add alongside existing 8 (streak + rarity data already available):
- 🗓️ *Consistent* — 7-day streak | 🔥 *Obsessed* — 30-day streak
- 💎 *Rare Hunter* — X endangered species spotted | 👑 *Legendary* — critically endangered sighting
- 🌍 *Globetrotter* — sightings on 3+ continents | 🗺️ *Explorer* — 5+ locations
- 👥 *Influencer* — 10+ followers | ⚡ *Flash* — 5 sightings in one day
- 🦅 *Bird Watcher* — 10 bird species | 🦎 *Reptile Wrangler* — 5 reptiles

## MVP 2 — Likes & Comments
- DB: `likes` table (user_id, sighting_id) + `comments` table (user_id, sighting_id, text) with RLS
- Storage: likeSighting/unlikeSighting/addComment/getComments functions
- UI: heart button + count on feed cards, comment bottom sheet (@gorhom/bottom-sheet)
- Push notification edge function for like/comment events
- Optional: Supabase realtime subscriptions for live comment updates

## Deferred features

- **2FA (TOTP)**: Supabase native MFA. Enrollment in Settings (QR code via react-native-qrcode-svg), post-login challenge in AuthScreen. Skip for now.
- **API key exposure**: Supabase anon key is client-side — acceptable for now, revisit before public launch
- **Username race condition**: Two users could claim the same username simultaneously — add DB unique constraint or use a transaction
- **Apple Sign In incomplete profiles**: Apple only gives name/email on first sign-in; users may end up with no username set
- **animal_cache TTL**: Cache has no expiry — stale conservation status data will accumulate over time
- **Magic link auth**: Passwordless email login — was suggested, not rejected, consider alongside 2FA later
