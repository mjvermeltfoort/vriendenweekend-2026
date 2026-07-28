import type { GamePack } from '../game/gameTypes';
import { allBellChallengeImages, allEffectAudio, allScenicAudio, allStandaloneNarration } from '../audio/audioConfig';

const MEDIA_CACHE = 'moerasdraak-audio-v2';
export const ROUTE_OFFLINE_ASSETS = [
  './routes/moerasdraak-den-bosch.geojson',
  './maps/route-map-fallback.webp'
] as const;

export function buildAssetManifest(pack: GamePack) {
  const assets = new Set<string>(['./manifest.webmanifest', './icons/icon.svg', ...ROUTE_OFFLINE_ASSETS]);
  for (const stop of pack.stops) {
    if (stop.intro.audioSrc) assets.add(stop.intro.audioSrc);
  }
  for (const asset of allStandaloneNarration()) assets.add(asset);
  for (const asset of allScenicAudio()) assets.add(asset);
  for (const asset of allEffectAudio()) assets.add(asset);
  for (const asset of allBellChallengeImages()) assets.add(asset);
  return [...assets];
}

export async function precacheRouteAssets(assets: string[]) {
  const cache = await caches.open(MEDIA_CACHE);
  let stored = 0;
  for (const asset of assets) {
    const response = await fetch(asset, { cache: 'reload' });
    if (!response.ok) continue;
    await cache.put(asset, response.clone());
    stored += 1;
  }
  return { stored, total: assets.length };
}
