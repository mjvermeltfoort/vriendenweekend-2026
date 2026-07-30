const audioRoot = `${import.meta.env.BASE_URL}audio`;
const bellImageRoot = `${import.meta.env.BASE_URL}images/bellende-engel`;

export function audioAsset(path: string) {
  return `${audioRoot}/${path}`;
}

export const narrationAudio = {
  welcome: audioAsset('00-welkom.mp3'),
  finale: audioAsset('08-finale.mp3'),
  completed: audioAsset('09-voltooid.mp3')
} as const;

export const scenicAudio = {
  general: audioAsset('scenic/algemene-moerasdraak-sfeer.mp3'),
  binnendieze: audioAsset('scenic/binnendieze.mp3'),
  bosscheBrouwers: audioAsset('scenic/bossche-brouwers.mp3'),
  drakenfontein: audioAsset('scenic/drakenfontein.mp3'),
  jheronimusBosch: audioAsset('scenic/jheronimus-bosch.mp3'),
  sintJan: audioAsset('scenic/sint-jan.mp3')
} as const;

export const bellChallengeAudio = {
  awaken: audioAsset('effects/bellende-engel/ontwaken-stenen.mp3'),
  telephone: audioAsset('effects/bellende-engel/old-telephone.mp3'),
  bells: [
    audioAsset('effects/bellende-engel/bell-1-engel.mp3'),
    audioAsset('effects/bellende-engel/bell-2-draak.mp3'),
    audioAsset('effects/bellende-engel/bell-3-sleutel.mp3'),
    audioAsset('effects/bellende-engel/bell-4-schild.mp3')
  ],
  tones: [
    audioAsset('effects/bellende-engel/bell-1-engel.mp3'),
    audioAsset('effects/bellende-engel/bell-2-draak.mp3'),
    audioAsset('effects/bellende-engel/bell-3-sleutel.mp3'),
    audioAsset('effects/bellende-engel/bell-4-schild.mp3')
  ],
  pattern: [3, 2, 1, 4, 3]
} as const;

export const bellChallengeImages = {
  callingAngel: `${bellImageRoot}/calling-angel.webp`,
  bells: [
    `${bellImageRoot}/bell-angel.webp`,
    `${bellImageRoot}/bell-dragon.webp`,
    `${bellImageRoot}/bell-key.webp`,
    `${bellImageRoot}/bell-shield.webp`
  ]
} as const;

const scenicByStop: Record<string, string> = {
  drakenfontein: scenicAudio.drakenfontein,
  binnendieze: scenicAudio.binnendieze,
  'bosch-wezen': scenicAudio.jheronimusBosch,
  'sint-jan': scenicAudio.sintJan,
  'bossche-brouwers': scenicAudio.bosscheBrouwers
};

export function scenicForPath(pathname: string) {
  if (pathname === '/resultaat') return scenicAudio.bosscheBrouwers;
  const match = pathname.match(/^\/(?:stop|challenge)\/([^/]+)/);
  return match ? scenicByStop[match[1]] ?? scenicAudio.general : scenicAudio.general;
}

export function allScenicAudio() {
  return Object.values(scenicAudio);
}

export function allStandaloneNarration() {
  return Object.values(narrationAudio);
}

export function allEffectAudio() {
  return [
    bellChallengeAudio.awaken,
    bellChallengeAudio.telephone,
    ...bellChallengeAudio.bells,
    ...bellChallengeAudio.tones
  ];
}

export function allBellChallengeImages() {
  return [bellChallengeImages.callingAngel, ...bellChallengeImages.bells];
}
