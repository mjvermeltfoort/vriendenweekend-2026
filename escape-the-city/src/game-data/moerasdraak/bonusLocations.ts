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
    intro: { title: 'De Verloren Poort', text: 'Lang geleden bewaakte een stadspoort de toegang tot Den Bosch. Haar naam is uit de herinnering van de Moerasdraak verdwenen.' },
    navigation: { clue: 'Waar oud steenwerk een roestkleurig pantser draagt.', fallbackDirections: 'Volg de Sint-Janssingel naar Bolwerk Sint-Jan bij de stadsentree.', externalMapsQuery: 'Bolwerk Sint-Jan Den Bosch' },
    challenge: {
      kind: 'choice',
      prompt: 'De Moerasdraak bewaakt een toegang die al eeuwen verdwenen is. Maar niet alle sporen zijn uitgewist. Hoe heette de middeleeuwse stadspoort op deze plek?',
      options: [
        { id: 'b', label: 'De Vughterpoort', correct: false },
        { id: 'a', label: 'De Koepoort', correct: true },
        { id: 'c', label: 'De Orthenpoort', correct: false },
        { id: 'd', label: 'De Hinthamerpoort', correct: false }
      ],
      correctFeedback: 'Goed gevonden! De Koepoort gaf hier vroeger toegang tot de stad. De Poortschub is gevonden!',
      wrongFeedback: 'Nog niet. Kijk nog eens goed rond en denk na over de naam van de verdwenen stadspoort.'
    },
    hints: [{ id: 'h1', text: 'Niet alles wat verdwenen is, ligt onder de grond. Soms vertelt een steen je precies wat hier vroeger stond. Kijk eens bij je voeten!' }],
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
    intro: { title: 'Het Huis dat Bleef Staan', text: 'Midden op de Markt staat De Moriaan, een eeuwenoud woonhuis dat ternauwernood aan de slopershamer ontsnapte. De Moerasdraak vermoedt dat er hoog aan het gebouw een bijzondere wachter schuilt.' },
    navigation: { clue: 'Vind het stenen huis dat aan de slopershamer ontsnapte.', fallbackDirections: 'Ga naar Markt 77.', externalMapsQuery: 'De Moriaan Den Bosch' },
    challenge: {
      kind: 'choice',
      prompt: 'Midden op de Markt staat De Moriaan, een eeuwenoud huis dat ooit bijna werd gesloopt. De Moerasdraak beweert dat er hoog op het gebouw nog altijd een bijzondere wachter staat. Welk opvallend bouwelement zie je boven aan de hoek van De Moriaan?',
      options: [
        { id: 'b', label: 'Een stenen leeuw', correct: false },
        { id: 'c', label: 'Een grote klok', correct: false },
        { id: 'a', label: 'Een klein rond torentje', correct: true },
        { id: 'd', label: 'Een houten balkon', correct: false }
      ],
      correctFeedback: 'Goed gevonden! Het opvallende hoektorentje van De Moriaan is teruggevonden. De Steenschub is van jullie!',
      wrongFeedback: 'Nog niet! Bekijk de bovenkant van De Moriaan, vooral waar de twee gevels bij elkaar komen.'
    },
    hints: [{ id: 'h1', text: 'Als ik een middeleeuws huis moest bewaken, zou ik een plekje zoeken met goed uitzicht. Kijk eens omhoog, helemaal naar de hoek!' }],
    answerExplanation: 'Het opvallende hoektorentje hoort bij De Moriaan, een van de oudste bakstenen huizen van Nederland. Het huis dateert uit het begin van de 13e eeuw. In de jaren vijftig dreigde het te worden gesloopt, maar acties van Bosschenaren voorkwamen dat. Tijdens de ingrijpende restauratie en reconstructie in de jaren zestig werd ook de historische gevel hersteld. Zo bleef dit bijzondere stukje middeleeuws Den Bosch bewaard.',
    reward: { id: 'steenschub', title: 'Steenschub', text: 'Steen bewaart de herinnering.', symbol: '◈', resultLabel: 'Steenschub' }
  },
  {
    id: 'bonus:zwanenbroedershuis', isBonus: true, order: 0, slug: 'zwanenbroedershuis', title: 'Zwanenbroedershuis', shortTitle: 'Verborgen vondst', locationName: 'Hinthamerstraat 94',
    coordinates: coordinate(51.688710, 5.309535, 60, 120, 130),
    hiddenClue: 'Een vogel bewaakt een huis dat ouder is dan zijn gevel.', revealedDescription: 'De zwaan ziet wat beneden vaak onopgemerkt blijft.', estimatedDetourMinutes: 4,
    recommendedBetween: { afterStopId: 'sint-jan', beforeStopId: 'kruithuis' }, visibleAfterStopId: 'binnendieze', maximumPoints: 150,
    manualVerification: { questionId: 'bonus-zwanenbroedershuis-primary', question: 'Welk dier staat helemaal boven op de gevel?' },
    intro: { title: 'De Wachters van de Zwaan', text: 'Hoog boven de Hinthamerstraat bewaakt een zwaan een eeuwenoud geheim. Maar de vogel staat niet alleen. De Moerasdraak heeft nog meer wachters op de gevel ontdekt.' },
    navigation: { clue: 'Een vogel bewaakt een huis dat ouder is dan zijn gevel.', fallbackDirections: 'Ga naar Hinthamerstraat 94.', externalMapsQuery: 'Zwanenbroedershuis Den Bosch' },
    challenge: {
      kind: 'choice',
      prompt: 'Hoeveel menselijke beelden staan er aan de voorgevel van het Zwanenbroedershuis?',
      options: [
        { id: 'a', label: 'Twee', correct: false },
        { id: 'c', label: 'Drie', correct: false },
        { id: 'b', label: 'Vier', correct: true },
        { id: 'd', label: 'Vijf', correct: false }
      ],
      correctFeedback: 'Goed geteld! Vier stenen wachters houden de gevel in de gaten. De Veerschub is gevonden!',
      wrongFeedback: 'Nog niet. Tel de menselijke figuren tegen de voorgevel, maar tel de zwaan bovenop niet mee.'
    },
    hints: [{ id: 'h1', text: 'Die zwaan bovenop trekt natuurlijk alle aandacht. Maar kijk eens een stukje lager. Daar staan een paar heren al eeuwen op wacht. Hoeveel zijn het er?' }],
    answerExplanation: 'De vier stenen gevelbeelden werden in 1962 gemaakt door beeldhouwer Marius van Beek. Ze stellen Willem van Oranje, Gerardus van Uden, Gijsbertus van der Poorten en Floris van Egmond voor: bekende personen uit de geschiedenis van de Illustre Lieve Vrouwe Broederschap. De broederschap is sinds 1483 op deze plek gevestigd. Het huidige Zwanenbroedershuis dateert uit 1846–1847. Ook schilder Jheronimus Bosch was lid van de broederschap.',
    reward: { id: 'veerschub', title: 'Veerschub', text: 'De gevelwachter ziet alles.', symbol: '◈', resultLabel: 'Veerschub' }
  },
  {
    id: 'bonus:citadel', isBonus: true, order: 0, slug: 'citadel', title: 'De Citadel', shortTitle: 'Verborgen vondst', locationName: 'Citadellaan / Zuid-Willemsvaart',
    coordinates: coordinate(51.695161, 5.302865, 80, 140, 140),
    hiddenClue: 'Zoek de bril waardoor de machthebbers de stad bekeken.', revealedDescription: 'De bril keek niet alleen naar de vijand, maar ook naar de stad zelf.', estimatedDetourMinutes: 6,
    recommendedBetween: { afterStopId: 'kruithuis', beforeStopId: 'bossche-brouwers' }, visibleAfterStopId: 'kruithuis', maximumPoints: 250,
    manualVerification: { questionId: 'bonus-citadel-primary', question: 'Welk verdedigend onderdeel vormt hier nog steeds de toegang tot de Citadel?' },
    intro: {
      title: 'De Papenbril',
      text: 'Na de verovering van Den Bosch verscheen hier een machtig fort. De Moerasdraak ontdekte iets vreemds: de kanonnen wezen niet alleen naar buiten, maar óók naar de stad zelf. Waarom zou een vesting haar eigen stad onder schot houden?'
    },
    navigation: { clue: 'Zoek de bril waardoor de machthebbers de stad bekeken.', fallbackDirections: 'Volg de Citadellaan naar de vestingwal.', externalMapsQuery: 'Citadel Den Bosch' },
    // Bronnen: BHIC en Erfgoed 's-Hertogenbosch over Fort Willem Maria / de Papenbril.
    challenge: {
      kind: 'choice',
      prompt: 'Waarom waren de kanonnen van de Citadel ook op Den Bosch gericht?',
      options: [
        { id: 'b', label: 'Om vijandelijke schepen vanuit de haven te kunnen beschieten.', correct: false },
        { id: 'c', label: 'Om de oude stadsmuren vanuit het fort te kunnen verdedigen.', correct: false },
        { id: 'a', label: 'Omdat het nieuwe gezag bang was voor een opstand van de katholieke Bosschenaren.', correct: true },
        { id: 'd', label: 'Om waarschuwingsschoten te lossen wanneer de stadspoorten sloten.', correct: false }
      ],
      correctFeedback: 'Precies! Dit fort hield niet alleen de vijand buiten, maar ook de eigen bevolking in de gaten. De Wachterschub is gevonden!',
      wrongFeedback: 'Niet helemaal. Wie vertrouwde het nieuwe gezag na de verovering van Den Bosch misschien nog niet?'
    },
    hints: [{ id: 'h1', text: 'Een bril om de vijand buiten te zien, dacht je? De machthebbers keken ook achterom. Na 1629 hadden ze de stad veroverd… maar hadden ze ook de harten van de Bosschenaren gewonnen?' }],
    answerExplanation: 'In 1629 veroverde Frederik Hendrik Den Bosch op de Spanjaarden. Het Staatse bewind liet tussen 1637 en 1645 Fort Willem Maria bouwen. Het fort diende om aanvallen van buiten af te slaan, maar ook om de overwegend katholieke Bosschenaren onder controle te houden: de nieuwe machthebbers vreesden trouw aan Spanje en mogelijke opstanden. Daarom waren kanonnen ook op de stad gericht en kreeg het fort de spotnaam Papenbril. Oorspronkelijk had de Citadel vijf bastions.',
    reward: { id: 'wachterschub', title: 'Wachterschub', text: 'De vesting blijft waken.', symbol: '◈', resultLabel: 'Wachterschub' }
  },
  {
    id: 'bonus:verkadefabriek', isBonus: true, order: 0, slug: 'verkadefabriek', title: 'Verkadefabriek', shortTitle: 'Verborgen vondst', locationName: 'Boschdijkstraat 45',
    coordinates: coordinate(51.695626, 5.297448, 70, 130, 130),
    hiddenClue: 'Waar machines iets knapperigs maakten, worden nu verhalen vertoond.', revealedDescription: 'Een gebouw hoeft niet te verdwijnen om een nieuw verhaal te beginnen.', estimatedDetourMinutes: 8,
    recommendedBetween: { afterStopId: 'kruithuis', beforeStopId: 'bossche-brouwers' }, visibleAfterStopId: 'kruithuis', maximumPoints: 250,
    manualVerification: { questionId: 'bonus-verkade-primary', question: 'Wat was de oorspronkelijke functie van dit gebouw?' },
    intro: {
      title: 'Van Koek naar Cultuur',
      text: 'Ooit rolden hier koekjes van de lopende band. Na de sluiting in 1993 leek het verleden te verdwijnen. Maar de Moerasdraak weet dat het gebouw nog een bijzonder spoor uit de fabriekstijd bewaart.'
    },
    navigation: { clue: 'Waar machines iets knapperigs maakten, worden nu verhalen vertoond.', fallbackDirections: 'Ga naar Boschdijkstraat 45.', externalMapsQuery: 'Verkadefabriek Den Bosch' },
    // Bron: https://www.verkadefabriek.nl/over-ons/verkadefabriek
    challenge: {
      kind: 'choice',
      prompt: 'Toen de fabriek in 2004 opnieuw opende als plek voor film en theater, besloot de architect iets bijzonders van vroeger te bewaren. Maar liefst 18.000 onderdelen werden één voor één schoongemaakt en opnieuw gebruikt. Wat waren dat?',
      options: [
        { id: 'b', label: 'De metalen bakvormen van de koekjes', correct: false },
        { id: 'c', label: 'De houten transportkisten', correct: false },
        { id: 'a', label: 'De oude gele vloertegels', correct: true },
        { id: 'd', label: 'De stenen van de fabrieksschoorsteen', correct: false }
      ],
      correctFeedback: 'Goed gevonden! De oude gele vloertegels kregen een tweede leven in het vernieuwde gebouw. Jullie hebben een verborgen spoor uit de fabriekstijd ontdekt!',
      wrongFeedback: 'Nog niet helemaal. De oude fabriek heeft haar sporen achtergelaten op een plek waar je misschien dagelijks overheen loopt.'
    },
    hints: [{ id: 'h1', text: 'Achttienduizend onderdelen?! Daar zou zelfs mijn computer van vastlopen! Ik zou maar eens wat lager zoeken. Soms ligt de geschiedenis letterlijk onder je neus. Of eigenlijk… onder je schoenen!' }],
    answerExplanation: 'De Verkadefabriek sloot in 1993. Bij de verbouwing tot cultureel centrum werden ongeveer 18.000 oude gele vloertegels één voor één verwijderd, schoongebikt en opnieuw gelegd. Ook de kenmerkende sheddaken bleven behouden. In 2004 opende het gebouw opnieuw, dit keer als plek voor film, theater en cultuur. Zo bleef de geschiedenis van de koekjesfabriek bewaard.',
    reward: { id: 'machineschub', title: 'Machineschub', text: 'De machines vertellen verder.', symbol: '◈', resultLabel: 'Machineschub' }
  }
];
