# Hint Henk recordings

Generated on 2026-10-14 using the user-owned ElevenLabs voice **Hint Henk** (`TCJntnsvZTABT5mPPyf1`) and `eleven_multilingual_v2`. One take per clip, 13 paid hints plus a shared confirmation. The exact spoken text and measured duration live in `src/features/audio/hintHenkClips.json`.

These are static local assets; the deployed app needs no ElevenLabs key and makes no live generation requests. Hint IDs and server-side penalties are unchanged. Confirmation never includes a puzzle hint. Audio plays only with sound enabled; replay is free. Offline route preparation includes every clip.

When changing hint text, regenerate the matching clip and update its transcript/duration together. Keep the game-data hint text contained in the spoken transcript. The shared confirmation deliberately leaves the exact cost to the live score display.
