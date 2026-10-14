# Hint Henk recordings

Generated on 2026-10-14 using the user-owned ElevenLabs voice **Hint Henk** (`TCJntnsvZTABT5mPPyf1`) and `eleven_v4`. One take per clip, 13 paid hints plus a shared confirmation. The exact spoken text, delivery tags, generation model, voice ID and measured duration live in `src/features/audio/hintHenkClips.json`.

These are static local assets; the deployed app needs no ElevenLabs key and makes no live generation requests. Hint IDs and server-side penalties are unchanged. Confirmation never includes a puzzle hint. Audio plays only with sound enabled; replay is free. Offline route preparation includes every clip.

When changing hint text, regenerate the matching clip and update its transcript/duration together. Keep the game-data hint text contained in the spoken transcript. The shared confirmation deliberately leaves the exact cost to the live score display.

The `-v4.mp3` filenames invalidate previously cached v2 recordings. The Brouwcode recording includes the current improved hint.

## Optional schub reminders

`reminders/` contains seven additional v4 recordings with the same voice: one passed-schub message and final summaries for one through six missing schubs. Exact text, duration and generation metadata are in `src/features/audio/henkReminderClips.json`. These files also join offline route preparation.

Reminders use fresh local GPS (at most 30 seconds old, accuracy at most 40 metres). A visible unfinished schub must first be within its discovery radius including GPS uncertainty. Walking at least 100 metres farther from the closest approach, beyond that radius, makes it eligible. Turning back cancels a pending reminder. Each schub is announced at most once per team on this device, with ten minutes between messages. A final summary has priority once the main route permits the finale. It works without GPS, but observes the same cooldown.

State persists in `moerasdraak-henk-schub-reminders:v1:<teamId>` and is removed when the local team is deleted. Route/idle checks defer reminders during puzzles, narration, sound effects, hidden tabs and other dialogs. No scoring or server progression changes. The map accepts `?schub=<bonusId>` for explicit selection and `?schubben=ontbrekend` for the missing-schub overview.
