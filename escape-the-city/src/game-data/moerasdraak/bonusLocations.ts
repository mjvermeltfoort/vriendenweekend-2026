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
    intro: { title: 'De Verloren Poort', text: 'Een stadspoort is verdwenen, maar bij het bolwerk is nog een spoor te vinden. Zoek niet alleen naar oude muren: kijk ook op de grond.' },
    navigation: { clue: 'Waar oud steenwerk een roestkleurig pantser draagt. Zoek ook naar een lichte plaat in de bestrating.', fallbackDirections: 'Volg de Sint-Janssingel naar het bolwerk en zoek naar een lichte plaat in de bestrating.', externalMapsQuery: 'Bolwerk Sint-Jan Den Bosch' },
    challenge: {
      kind: 'choice',
      prompt: 'De Moerasdraak heeft een oude stadspoort uit de herinneringen gewist. Zoek de lichte plaat in de bestrating bij Bolwerk Sint-Jan. Hoe heette de middeleeuwse stadspoort op deze plek?',
      options: [
        { id: 'b', label: 'De Vughterpoort', correct: false },
        { id: 'a', label: 'De Koepoort', correct: true },
        { id: 'c', label: 'De Orthenpoort', correct: false },
        { id: 'd', label: 'De Hinthamerpoort', correct: false }
      ],
      correctFeedback: 'Goed gevonden! De Koepoort gaf hier vroeger toegang tot de stad. De Poortschub is gevonden!',
      wrongFeedback: 'Nog niet. Zoek de lichte plaat bij het bolwerk en denk aan de naam van de verdwenen stadspoort.'
    },
    hints: [{ id: 'h1', text: 'Kijk bij je voeten naar de lichte plaat. De naam van de oude poort verwijst naar een dier dat vroeger buiten de stadsmuren liep.' }],
    answerExplanation: 'De Koepoort was een middeleeuwse toegang tot Den Bosch in het verlengde van de Sint-Jansstraat, richting Vlijmen. In 1528 werd vóór deze kwetsbare toegang het Bolwerk Sint-Jan aangelegd, met verder naar buiten een nieuwe Sint-Janspoort. De oude poorten verdwenen, maar bij het huidige bolwerk zijn nog resten van de vroegere vestingwerken te ontdekken.',
    reward: { id: 'poortschub', title: 'Poortschub', text: 'De verdediging leeft voort.', symbol: '◈', resultLabel: 'Poortschub' }
  },
  {
    id: 'bonus:halve-peer', isBonus: true, order: 0, slug: 'halve-peer', title: 'De Halve Peer', shortTitle: 'Verborgen vondst', locationName: 'Molenstraat, bij de Binnendieze (gevel Drie Kronen)',
    // Ter plekke bevestigde exacte GPS-positie, ter vervanging van het eerdere kaartpunt.
    coordinates: coordinate(51.68961800908911, 5.299956048272589, 55, 120, 130),
    hiddenClue: 'Zoek een belangrijk man die maar voor de helft aanwezig is.', revealedDescription: 'In Oeteldonk is een halve oplossing soms precies genoeg.', estimatedDetourMinutes: 5,
    recommendedBetween: { afterStopId: 'zoete-lieve-gerritje', beforeStopId: 'binnendieze' }, visibleAfterStopId: 'drakenfontein', maximumPoints: 200,
    manualVerification: { questionId: 'bonus-halve-peer-primary', question: 'Waar bevindt de afgebeelde helft zich?' },
    intro: { title: 'De Ontbrekende Helft', text: 'Twee verenigingen maakten afspraken over een eerbetoon. Maar waarom bleef er uiteindelijk maar een halve Peer over?' },
    navigation: { clue: 'Zoek een belangrijk man die maar voor de helft aanwezig is, boven de Binnendieze.', fallbackDirections: 'Loop de Molenstraat in en kijk naar de gevel boven het water bij de Binnendieze.', externalMapsQuery: 'De Halve Peer Molenstraat Den Bosch' },
    challenge: {
      kind: 'choice',
      prompt: 'De Moerasdraak heeft een halve Peer gevonden! Kijk goed naar het beeld en het opschrift. Welke vereniging heeft deze halve Peer laten maken?',
      options: [
        { id: 'a', label: 'De Oeteldonksche Club van 1882', correct: false },
        { id: 'b', label: 'Carnavalsvereniging De Oetels', correct: true },
        { id: 'c', label: "De gemeente 's-Hertogenbosch", correct: false },
        { id: 'd', label: 'Het Bossche Schuttersgilde', correct: false }
      ],
      correctFeedback: 'Goed gevonden! De Oetels lieten hun eigen halve Peer maken.',
      wrongFeedback: 'Nog niet! De vereniging heeft haar naam achtergelaten bij het beeld.'
    },
    hints: [{ id: 'h1', text: 'Zelfs een halve Peer heeft een handtekening. Zoek de woorden bij het beeld, niet alleen het gezicht.' }],
    answerExplanation: 'Frans Vennix, die jarenlang de rol van Peer vaan den Muggenheuvel vervulde, was lid van carnavalsvereniging De Oetels. Na een conflict over afspraken met de Oeteldonksche Club van 1882 zouden beide partijen bijdragen aan een gedenkteken. De Oetels lieten in 1988 alleen hun eigen aandeel maken: letterlijk een halve Peer! Zo werd een carnavalsconflict een Bossch monument met een flinke knipoog.',
    reward: { id: 'narrenschub', title: 'Narrenschub', text: 'Een halve oplossing was genoeg.', symbol: '◈', resultLabel: 'Narrenschub' }
  },
  {
    id: 'bonus:de-moriaan', isBonus: true, order: 0, slug: 'de-moriaan', title: 'De Moriaan', shortTitle: 'Verborgen vondst', locationName: 'Markt 77',
    coordinates: coordinate(51.689615, 5.303141, 55, 120, 120),
    hiddenClue: 'Vind het stenen huis dat aan de slopershamer ontsnapte.', revealedDescription: 'Steen onthoudt wat mensen bijna verloren lieten gaan.', estimatedDetourMinutes: 5,
    recommendedBetween: { afterStopId: 'binnendieze', beforeStopId: 'bosch-wezen' }, visibleAfterStopId: 'zoete-lieve-gerritje', maximumPoints: 150,
    manualVerification: { questionId: 'bonus-moriaan-primary', question: 'Welke combinatie herken je aan dit gebouw?' },
    intro: { title: 'Het Huis dat Bleef Staan', text: 'Een woonhuis dat geldt als een van de oudste bakstenen in de stad bleef hier behouden.' },
    navigation: { clue: 'Vind het stenen huis dat aan de slopershamer ontsnapte.', fallbackDirections: 'Ga naar Markt 77.', externalMapsQuery: 'De Moriaan Den Bosch' },
    challenge: { kind: 'choice', prompt: 'Wat maakt dit gebouw historisch bijzonder?', options: [{ id: 'b', label: 'Glazen gevel, plat dak en metalen balkon', correct: false }, { id: 'a', label: 'Het is een van de oudste bakstenen woonhuizen', correct: true }, { id: 'c', label: 'Houten topgevel, klokkentoren en zuilen', correct: false }, { id: 'd', label: 'Witte lijstgevel, koepel en arcade', correct: false }], correctFeedback: 'De Steenschub is gevonden.', wrongFeedback: 'Kijk naar de gevelvormen.' },
    hints: [{ id: 'h1', text: 'Zoek vormen die ouder zijn dan de winkelstraat.' }], reward: { id: 'steenschub', title: 'Steenschub', text: 'Steen bewaart de herinnering.', symbol: '◈', resultLabel: 'Steenschub' }
  },
  {
    id: 'bonus:zwanenbroedershuis', isBonus: true, order: 0, slug: 'zwanenbroedershuis', title: 'Zwanenbroedershuis', shortTitle: 'Verborgen vondst', locationName: 'Hinthamerstraat 94',
    coordinates: coordinate(51.688710, 5.309535, 60, 120, 130),
    hiddenClue: 'Een vogel bewaakt een huis dat ouder is dan zijn gevel.', revealedDescription: 'De zwaan ziet wat beneden vaak onopgemerkt blijft.', estimatedDetourMinutes: 4,
    recommendedBetween: { afterStopId: 'sint-jan', beforeStopId: 'kruithuis' }, visibleAfterStopId: 'binnendieze', maximumPoints: 150,
    manualVerification: { questionId: 'bonus-zwanenbroedershuis-primary', question: 'Welk dier staat helemaal boven op de gevel?' },
    intro: { title: 'De Wachter op de Gevel', text: 'De Illustre Lieve Vrouwe Broederschap liet hier een zwaan achter.' },
    navigation: { clue: 'Een vogel bewaakt een huis dat ouder is dan zijn gevel.', fallbackDirections: 'Ga naar Hinthamerstraat 94.', externalMapsQuery: 'Zwanenbroedershuis Den Bosch' },
    challenge: { kind: 'choice', prompt: 'Welke organisatie is met dit huis verbonden?', options: [{ id: 'a', label: 'Schuttersgilde', correct: false }, { id: 'b', label: 'De Illustre Lieve Vrouwe Broederschap', correct: true }, { id: 'c', label: 'Gilde van Sint-Jan', correct: false }, { id: 'd', label: 'VOC', correct: false }], correctFeedback: 'De Veerschub is gevonden.', wrongFeedback: 'Lees de naam boven de deur.' },
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
    challenge: { kind: 'reorder', prompt: 'Zet de geschiedenis in de juiste volgorde.', items: ['Theater en film', 'Koekjes- en biscuitfabriek', 'Leegstand / einde productie'], correctOrder: ['Koekjes- en biscuitfabriek', 'Leegstand / einde productie', 'Theater en film'], wrongFeedback: 'De geschiedenis loopt anders.' },
    hints: [{ id: 'h1', text: 'Begin bij productie en eindig bij de huidige bestemming.' }], reward: { id: 'machineschub', title: 'Machineschub', text: 'De machines vertellen verder.', symbol: '◈', resultLabel: 'Machineschub' }
  }
];
