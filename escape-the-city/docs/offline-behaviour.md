# Offline behaviour

- Team, progress, queue and settings persist locally.
- Preparation caches route assets in Cache Storage.
- App continues when Supabase is absent.
- Sync retries happen on open, online, and manual trigger.
- Route preparation stores all narration, scenic and Bellende Engel MP3/WAV files in `moerasdraak-audio-v2`.
- The service worker serves `/escape-the-city/audio/*.{mp3,wav}` cache-first.
- Missing or failed audio falls back to visible story text.
