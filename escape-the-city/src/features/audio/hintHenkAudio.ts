import clips from './hintHenkClips.json';
import { audioAsset } from './audioConfig';

export interface HenkClip {
  source: string;
  transcript: string;
  durationSeconds: number;
}

function clip(key: string): HenkClip | undefined {
  const entry = (clips as Record<string, { file: string; transcript: string; durationSeconds: number }>)[key];
  return entry ? { ...entry, source: audioAsset(`hint-henk/${entry.file}`) } : undefined;
}

export const henkConfirmation = clip('confirmation')!;
export function henkHint(stopId: string, hintId: string) {
  return clip(`${stopId}:${hintId}`);
}
export function allHenkAudio() {
  return Object.keys(clips).map((key) => clip(key)!.source);
}
