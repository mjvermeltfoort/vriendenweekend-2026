import type { BonusLocation } from '../../features/game/gameTypes';

const coordinate = (latitude: number, longitude: number, radiusMeters: number, discoveryRadiusMeters: number, maximumAccuracyMeters: number) => ({
  latitude,
  longitude,
  radiusMeters,
  discoveryRadiusMeters,
  maximumAccuracyMeters,
  needsOnSiteVerification: true
});

export const bonusLocations: BonusLocation[] = [
  {
    id: 'bonus:bolwerk-sint-jan', isBonus: true, order: 0, slug: 'bolwerk-sint-jan', title: 'Bolwerk Sint-Jan', shortTitle: 'Verborgen vondst', locationName: 'Sint-Janssingel / stadsentree',
    coordinates: coordinate(51.689541, 5.298851, 55, 120, 120),
    hiddenClue: 'Waar oud steenwerk een roestkleurig pantser draagt.', revealedDescription: 'De oude poort is verdwenen, maar haar verdediging leeft voort.', estimatedDetourMinutes: 3,
    recommendedBetween: { afterStopId: 'drakenfontein', beforeStopId: 'zoete-lieve-gerritje' }, visibleAfterStopId: 'drakenfontein', maximumPoints: 100,
    manualVerification: { questionId: 'bonus-bolwerk-primary', question: 'Welke twee materialen ontmoeten elkaar hier het duidelijkst?' },
    intro: { title: 'De Verloren Poort', text: 'Een schub wacht bij de oude stadsentree.' },
    navigation: { clue: 'Waar oud steenwerk een roestkleurig pantser draagt.', fallbackDirections: 'Volg de Sint-Janssingel naar de stadsentree.', externalMapsQuery: 'Bolwerk Sint-Jan Den Bosch' },
    challenge: { kind: 'choice', prompt: 'Welke twee materialen ontmoeten elkaar hier het duidelijkst?', options: [{ id: 'a', label: 'Baksteen en roestkleurig staal', correct: true }, { id: 'b', label: 'Hout en natuursteen', correct: false }, { id: 'c', label: 'Beton en koper', correct: false }, { id: 'd', label: 'Glas en marmer', correct: false }], correctFeedback: 'De Poortschub is gevonden.', wrongFeedback: 'Kijk nog eens naar het steenwerk.' },
    hints: [{ id: 'h1', text: 'Let op de kleur en textuur van de bescherming.' }], reward: { id: 'poortschub', title: 'Poortschub', text: 'De verdediging leeft voort.', symbol: '◈', resultLabel: 'Poortschub' }
  },
  {
    id: 'bonus:halve-peer', isBonus: true, order: 0, slug: 'halve-peer', title: 'De Halve Peer', shortTitle: 'Verborgen vondst', locationName: 'Hoek Molenstraat / Korenbrugstraat',
    coordinates: coordinate(51.689444, 5.299722, 55, 120, 130),
    hiddenClue: 'Zoek een belangrijk man die maar voor de helft aanwezig is.', revealedDescription: 'In Oeteldonk is een halve oplossing soms precies genoeg.', estimatedDetourMinutes: 5,
    recommendedBetween: { afterStopId: 'zoete-lieve-gerritje', beforeStopId: 'binnendieze' }, visibleAfterStopId: 'drakenfontein', maximumPoints: 200,
    manualVerification: { questionId: 'bonus-halve-peer-primary', question: 'Waar bevindt de afgebeelde helft zich?' },
    intro: { title: 'De Ontbrekende Helft', text: 'Een halve figuur bewaart een hele schub.' },
    navigation: { clue: 'Zoek een belangrijk man die maar voor de helft aanwezig is.', fallbackDirections: 'Zoek de gevel bij de Korenbrugstraat.', externalMapsQuery: 'De Halve Peer Den Bosch' },
    challenge: { kind: 'choice', prompt: 'Waar bevindt de afgebeelde helft zich?', options: [{ id: 'a', label: 'Op een brugleuning', correct: false }, { id: 'b', label: 'Tegen een gevel boven de Binnendieze', correct: true }, { id: 'c', label: 'Op een sokkel op straat', correct: false }, { id: 'd', label: 'Boven op een stadspoort', correct: false }], correctFeedback: 'De Narrenschub is gevonden.', wrongFeedback: 'Zoek hoger, bij de gevel.' },
    hints: [{ id: 'h1', text: 'De helft kijkt niet vanaf straatniveau terug.' }], reward: { id: 'narrenschub', title: 'Narrenschub', text: 'Een halve oplossing was genoeg.', symbol: '◈', resultLabel: 'Narrenschub' }
  },
  {
    id: 'bonus:de-moriaan', isBonus: true, order: 0, slug: 'de-moriaan', title: 'De Moriaan', shortTitle: 'Verborgen vondst', locationName: 'Markt 77',
    coordinates: coordinate(51.689615, 5.303141, 55, 120, 120),
    hiddenClue: 'Vind het stenen huis dat aan de slopershamer ontsnapte.', revealedDescription: 'Steen onthoudt wat mensen bijna verloren lieten gaan.', estimatedDetourMinutes: 5,
    recommendedBetween: { afterStopId: 'binnendieze', beforeStopId: 'bosch-wezen' }, visibleAfterStopId: 'zoete-lieve-gerritje', maximumPoints: 150,
    manualVerification: { questionId: 'bonus-moriaan-primary', question: 'Welke combinatie herken je aan dit gebouw?' },
    intro: { title: 'Het Huis dat Bleef Staan', text: 'Een oud huis bewaart een stenen herinnering.' },
    navigation: { clue: 'Vind het stenen huis dat aan de slopershamer ontsnapte.', fallbackDirections: 'Ga naar Markt 77.', externalMapsQuery: 'De Moriaan Den Bosch' },
    challenge: { kind: 'choice', prompt: 'Welke combinatie herken je aan dit gebouw?', options: [{ id: 'a', label: 'Trapgevel, rond hoektorentje en spitsboogdetails', correct: true }, { id: 'b', label: 'Glazen gevel, plat dak en metalen balkon', correct: false }, { id: 'c', label: 'Houten topgevel, klokkentoren en zuilen', correct: false }, { id: 'd', label: 'Witte lijstgevel, koepel en arcade', correct: false }], correctFeedback: 'De Steenschub is gevonden.', wrongFeedback: 'Kijk naar de gevelvormen.' },
    hints: [{ id: 'h1', text: 'Zoek vormen die ouder zijn dan de winkelstraat.' }], reward: { id: 'steenschub', title: 'Steenschub', text: 'Steen bewaart de herinnering.', symbol: '◈', resultLabel: 'Steenschub' }
  },
  {
    id: 'bonus:zwanenbroedershuis', isBonus: true, order: 0, slug: 'zwanenbroedershuis', title: 'Zwanenbroedershuis', shortTitle: 'Verborgen vondst', locationName: 'Hinthamerstraat 94',
    coordinates: coordinate(51.688710, 5.309535, 60, 120, 130),
    hiddenClue: 'Een vogel bewaakt een huis dat ouder is dan zijn gevel.', revealedDescription: 'De zwaan ziet wat beneden vaak onopgemerkt blijft.', estimatedDetourMinutes: 4,
    recommendedBetween: { afterStopId: 'sint-jan', beforeStopId: 'kruithuis' }, visibleAfterStopId: 'binnendieze', maximumPoints: 150,
    manualVerification: { questionId: 'bonus-zwanenbroedershuis-primary', question: 'Welk dier staat helemaal boven op de gevel?' },
    intro: { title: 'De Wachter op de Gevel', text: 'Kijk omhoog naar de gevelwachter.' },
    navigation: { clue: 'Een vogel bewaakt een huis dat ouder is dan zijn gevel.', fallbackDirections: 'Ga naar Hinthamerstraat 94.', externalMapsQuery: 'Zwanenbroedershuis Den Bosch' },
    challenge: { kind: 'choice', prompt: 'Welk dier staat helemaal boven op de gevel?', options: [{ id: 'a', label: 'Adelaar', correct: false }, { id: 'b', label: 'Zwaan', correct: true }, { id: 'c', label: 'Ooievaar', correct: false }, { id: 'd', label: 'Raaf', correct: false }], correctFeedback: 'De Veerschub is gevonden.', wrongFeedback: 'Kijk nog iets hoger.' },
    hints: [{ id: 'h1', text: 'De naam van het huis helpt.' }], reward: { id: 'veerschub', title: 'Veerschub', text: 'De gevelwachter ziet alles.', symbol: '◈', resultLabel: 'Veerschub' }
  },
  {
    id: 'bonus:citadel', isBonus: true, order: 0, slug: 'citadel', title: 'De Citadel', shortTitle: 'Verborgen vondst', locationName: 'Citadellaan / Zuid-Willemsvaart',
    coordinates: coordinate(51.695161, 5.302865, 80, 140, 140),
    hiddenClue: 'Zoek de bril waardoor de machthebbers de stad bekeken.', revealedDescription: 'De bril keek niet alleen naar de vijand, maar ook naar de stad zelf.', estimatedDetourMinutes: 6,
    recommendedBetween: { afterStopId: 'kruithuis', beforeStopId: 'bossche-brouwers' }, visibleAfterStopId: 'kruithuis', maximumPoints: 250,
    manualVerification: { questionId: 'bonus-citadel-primary', question: 'Welk verdedigend onderdeel vormt hier nog steeds de toegang tot de Citadel?' },
    intro: { title: 'De Papenbril', text: 'Twee lenzen vormen samen een vestingvorm.' },
    navigation: { clue: 'Zoek de bril waardoor de machthebbers de stad bekeken.', fallbackDirections: 'Volg de Citadellaan naar de vestingwal.', externalMapsQuery: 'Citadel Den Bosch' },
    challenge: { kind: 'lens', prompt: 'Draai beide lenzen tot de vijfpuntige vestingvorm verschijnt.', correctAnswer: 'vesting', wrongFeedback: 'De lenzen vormen nog geen vesting.' },
    hints: [{ id: 'h1', text: 'Een vesting heeft scherpe punten naar buiten.' }], reward: { id: 'wachterschub', title: 'Wachterschub', text: 'De vesting blijft waken.', symbol: '◈', resultLabel: 'Wachterschub' }
  },
  {
    id: 'bonus:verkadefabriek', isBonus: true, order: 0, slug: 'verkadefabriek', title: 'Verkadefabriek', shortTitle: 'Verborgen vondst', locationName: 'Boschdijkstraat 45',
    coordinates: coordinate(51.695626, 5.297448, 70, 130, 130),
    hiddenClue: 'Waar machines iets knapperigs maakten, worden nu verhalen vertoond.', revealedDescription: 'Een gebouw hoeft niet te verdwijnen om een nieuw verhaal te beginnen.', estimatedDetourMinutes: 8,
    recommendedBetween: { afterStopId: 'kruithuis', beforeStopId: 'bossche-brouwers' }, visibleAfterStopId: 'kruithuis', maximumPoints: 250,
    manualVerification: { questionId: 'bonus-verkade-primary', question: 'Wat was de oorspronkelijke functie van dit gebouw?' },
    intro: { title: 'Van Koek naar Cultuur', text: 'Orden het verhaal van fabriek naar cultuur.' },
    navigation: { clue: 'Waar machines iets knapperigs maakten, worden nu verhalen vertoond.', fallbackDirections: 'Ga naar Boschdijkstraat 45.', externalMapsQuery: 'Verkadefabriek Den Bosch' },
    challenge: { kind: 'reorder', prompt: 'Zet de geschiedenis in de juiste volgorde.', items: ['Koekjes- en biscuitfabriek', 'Leegstand / einde productie', 'Theater en film'], correctOrder: ['Koekjes- en biscuitfabriek', 'Leegstand / einde productie', 'Theater en film'], wrongFeedback: 'De geschiedenis loopt anders.' },
    hints: [{ id: 'h1', text: 'Begin bij productie en eindig bij de huidige bestemming.' }], reward: { id: 'machineschub', title: 'Machineschub', text: 'De machines vertellen verder.', symbol: '◈', resultLabel: 'Machineschub' }
  }
];
