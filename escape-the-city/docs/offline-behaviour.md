# Offline behaviour

- Team, progress, queue and settings persist locally.
- Preparation caches route assets in Cache Storage.
- App continues when Supabase is absent.
- Sync retries happen on open, online, and manual trigger.
- Observatieantwoorden worden offline als pending actie opgeslagen en geven
  lokaal nooit een stop vrij.
- Bij reconnect wordt eerst serverstate opgehaald. Acties voor al bevestigde
  stops vervallen; overige observatieacties worden FIFO en met hun vaste
  `action_id` afgespeeld. Daarna wordt serverstate opnieuw opgehaald.
- Netwerkfouten blijven pending. Functioneel geweigerde of gecontroleerde
  antwoorden worden uit de queue verwijderd.
- Route preparation stores all narration, scenic and Bellende Engel MP3/WAV files in `moerasdraak-audio-v2`.
- The service worker serves `/escape-the-city/audio/*.{mp3,wav}` cache-first.
- Missing or failed audio falls back to visible story text.
