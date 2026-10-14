import clips from './henkReminderClips.json';
import { audioAsset } from './audioConfig';
import type { HenkClip } from './hintHenkAudio';

export function henkReminderAudio(count?: number): HenkClip {
  const key = count === undefined ? 'passed' : `finale-${count}`;
  const entry = (clips as Record<string, { file: string; transcript: string; durationSeconds: number }>)[key];
  return { ...entry, source: audioAsset(`hint-henk/reminders/${entry.file}`) };
}
export function allHenkReminderAudio() {
  return Object.values(clips).map((c) => audioAsset(`hint-henk/reminders/${c.file}`));
}
