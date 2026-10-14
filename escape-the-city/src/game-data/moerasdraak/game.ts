import type { GamePack } from '../../features/game/gameTypes';
import { audioAsset } from '../../features/audio/audioConfig';
import { audioTranscripts } from '../../features/audio/audioTranscripts';
import { bonusLocations } from './bonusLocations';

export const gamePack: GamePack = {
  slug: 'moerasdraak-den-bosch',
  version: 1,
  title: 'Het Geheim van de Moerasdraak',
  subtitle: 'Escape the City in Den Bosch',
  city: 'Den Bosch',
  estimatedDurationMinutes: 120,
  estimatedDistanceKm: 4.8,
  startStopId: 'drakenfontein',
  finalStopId: 'bossche-brouwers',
  bonusLocations,
  bonusCompletionReward: { requiredCount: 6, points: 300, title: 'Schubbenjagers', badge: 'Zes gouden drakenschubben' },
  scoring: {
    basePoints: 1000,
    hintPenalty: [100, 150, 250],
    wrongAnswerPenalty: 25,
    minimumPerStop: 100
  },
  stops: [
    {
      id: 'drakenfontein',
      order: 1,
      slug: 'drakenfontein',
      title: 'De Drakenfontein',
      shortTitle: 'Start',
      locationName: 'Drakenfontein, Stationsplein',
      coordinates: { latitude: 51.690506, longitude: 5.296208, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'De draak ontwaakt', text: 'De Moerasdraak heeft zeven herinneringen uit de stad losgemaakt. Vind de eerste bij de fontein.', audioSrc: audioAsset('01-drakenfontein.mp3'), transcript: audioTranscripts.drakenfontein },
      navigation: { clue: 'Zoek het water en de stenen koppen. De eerste herinnering sluimert bij de draak.', fallbackDirections: 'Ga naar de fontein bij station Den Bosch.', externalMapsQuery: 'Drakenfontein Den Bosch' },
      challenge: {
        kind: 'choice',
        prompt: 'De gouden draak waakt hoog boven de stad, maar hij staat er niet alleen voor. Hoeveel draken bewaken de fontein in totaal, inclusief de gouden draak?',
        options: [
          { id: 'b', label: '3 draken', correct: false },
          { id: 'c', label: '4 draken', correct: false },
          { id: 'a', label: '5 draken', correct: true },
          { id: 'd', label: '6 draken', correct: false }
        ],
        correctFeedback: 'Vijf draken, vijf wachters! De Moerasdraak herkent jullie scherpe blik. Jullie eerste spoor is gevonden.',
        wrongFeedback: 'Nog niet raak. Kijk of je bij het rondlopen een draak hebt gemist of dubbel hebt geteld.'
      },
      hints: [{ id: 'h1', text: 'De gouden draak trekt alle aandacht. Loop eens om de fontein heen en kijk ook lager dan de top. Zie je vanaf iedere kant hetzelfde?' }],
      reward: { title: 'Vuur', text: 'Eerste herinnering veiliggesteld.', symbol: '🔥' }
    },
    {
      id: 'zoete-lieve-gerritje',
      order: 2,
      slug: 'zoete-lieve-gerritje',
      title: 'Zoete Lieve Gerritje',
      shortTitle: 'Gerritje',
      locationName: 'Hoek Lepelstraat en Korenbrugstraat',
      coordinates: { latitude: 51.689817, longitude: 5.299926, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Tegenstrijdige getuigen', text: 'Vier getuigen zingen ieder een ander stukje van hetzelfde lied. Welk spoor heeft Gerritje hier achtergelaten?', audioSrc: audioAsset('02-zoete-lieve-gerritje.mp3'), transcript: audioTranscripts.zoeteLieveGerritje },
      navigation: { clue: 'Let op gevels en details rond Gerritje.', fallbackDirections: 'Loop naar Zoete Lieve Gerritje.', externalMapsQuery: 'Zoete Lieve Gerritje Den Bosch' },
      challenge: {
        kind: 'choice',
        prompt: 'De Moerasdraak heeft vier regels uit een oud Bossch lied door elkaar gehaald. Kijk naar de muur achter Zoete Lieve Gerritje. Welke regel staat daar geschreven?',
        options: [
          { id: 'a', label: 'Brandewijn met suiker', correct: false },
          { id: 'b', label: 'Dat gaat naar Den Bosch toe', correct: true },
          { id: 'c', label: 'Wie zal dat betalen?', correct: false },
          { id: 'd', label: 'Den eerste boer den beste', correct: false }
        ],
        correctFeedback: 'Goed gezien! De eerste regel van het Bossche lied staat achter Gerritje. De herinnering aan haar verhaal is gered!',
        wrongFeedback: 'Nog niet. Alle vier de regels komen uit het lied, maar kijk welke er echt op de muur achter Gerritje staat.'
      },
      hints: [{ id: 'h1', text: 'Het beeld vertelt maar een deel van het verhaal. Zoek de woorden die achter Gerritje zijn achtergebleven.' }],
      reward: { title: 'Legende', text: 'Getuigenis bevestigd.', symbol: '📜' }
    },
    {
      id: 'binnendieze',
      order: 3,
      slug: 'binnendieze',
      title: 'Onder de Stad',
      shortTitle: 'Waterpoort',
      locationName: 'Waterpoort, Herman Moerkerkpark',
      coordinates: { latitude: 51.689641, longitude: 5.305190, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Het Spoor van het Verdwenen Water', text: 'De Moerasdraak heeft een waterloop uit het stadsbeeld laten verdwijnen. Maar een spoor in de bestrating is achtergebleven. Kunnen jullie ontdekken wat hier vroeger stroomde?', audioSrc: audioAsset('03-binnendieze.mp3'), transcript: audioTranscripts.binnendieze },
      navigation: { clue: 'Zoek bij de oude Waterpoort naar sporen van verdwenen water.', fallbackDirections: 'Ga naar de Waterpoort in het Herman Moerkerkpark, vlak bij de Binnendieze.', externalMapsQuery: 'Waterpoort Herman Moerkerkpark Den Bosch' },
      challenge: {
        kind: 'choice',
        prompt: 'De Moerasdraak heeft een rivier uit het stadsbeeld laten verdwijnen. Maar één spoor kon hij niet uitwissen. Kijk goed naar de bestrating bij de oude Waterpoort. Wat vertellen de blauwe stenen over deze plek?',
        options: [
          { id: 'b', label: 'Hier stond vroeger de buitenste stadsmuur.', correct: false },
          { id: 'c', label: 'Hier liep de oude handelsroute naar de Markt.', correct: false },
          { id: 'a', label: 'Hier stroomde vroeger de Marktstroom, een tak van de Binnendieze.', correct: true },
          { id: 'd', label: 'Hier lag een aanlegplaats voor handelsschepen.', correct: false }
        ],
        correctFeedback: 'Goed gezien! De blauwe stenen laten zien waar de verdwenen Marktstroom ooit liep. De herinnering aan het water is hersteld!',
        wrongFeedback: 'Nog niet helemaal. Kijk niet alleen naar de oude muren: waarom zouden er juist blauwe stenen in de straat liggen?'
      },
      hints: [{ id: 'h1', text: 'Vreemd hè? Een rivier zonder water! Soms laat het verleden zijn sporen gewoon op straat achter. Volg de kleur die bij water past!' }],
      answerExplanation: 'De blauwe stenen in het Herman Moerkerkpark markeren de vroegere loop van de Marktstroom, een tak van de Binnendieze. Deze waterloop werd tussen 1962 en 1966 gedempt. Bij de herinrichting van het park is een deel van de Binnendieze opnieuw opengelegd en zijn resten van de oude Waterpoort zichtbaar gemaakt. Zo kun je hier het verdwenen waterverleden van Den Bosch terugvinden.',
      reward: { title: 'Water', text: 'De stroom is onthuld.', symbol: '💧' }
    },
    {
      id: 'bosch-wezen',
      order: 4,
      slug: 'bosch-wezen',
      title: 'Het Monster van Bosch',
      shortTitle: 'Wezen',
      locationName: 'Standbeeld Jheronimus Bosch (August Falise), Markt tegenover De Kleine Winst',
      // Standbeeldcoördinaten: Wikimedia Commons (51°41′20.72″N, 5°18′13.5″E).
      // Nog ter plaatse te bevestigen voor de laatste meters.
      coordinates: { latitude: 51.689089, longitude: 5.303750, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Het Monster van Bosch', text: 'In de wereld van Jheronimus Bosch is niets wat het lijkt. De Moerasdraak heeft hier een geheim verborgen. Luister naar het verhaal en laat je verbeelding spreken.', audioSrc: audioAsset('04-jheronimus-bosch.mp3'), transcript: audioTranscripts.jheronimusBosch },
      navigation: { clue: 'Zoek het bronzen standbeeld van Jheronimus Bosch op de Markt, tegenover De Kleine Winst.', fallbackDirections: 'Ga op de Markt naar het standbeeld tegenover De Kleine Winst. Niet naar het Huis van Bosch op Markt 29.', externalMapsQuery: 'Standbeeld Jeroen Bosch Markt Den Bosch August Falise' },
      challenge: {
        kind: 'composite',
        prompt: 'Het schetsboek van Bosch is beschadigd. Bekijk eerst het standbeeld en de sokkel om het te openen. Herstel daarna de Boomman uit De tuin der lusten.',
        categories: {
          head: ['bird', 'human', 'fish'],
          body: ['barrel', 'egg', 'tower'],
          object: ['human', 'trees', 'bird']
        },
        correctAnswer: {
          head: 'human',
          body: 'egg',
          object: 'trees'
        },
        summaryTemplate: 'Hoofd: {head}, lijf: {body}, benen: {object}.',
        wrongFeedback: 'Het monster krijgt nog geen leven. Bekijk de aanwijzingen in het schetsboek en probeer een andere combinatie.'
      },
      hints: [{ id: 'h1', text: 'Het standbeeld geeft je het begin: wat draagt een schilder en welk laatste jaartal staat op de sokkel? Voor het monster: zoek een mensengezicht, een hol ei met een herberg en boomstammen die in bootjes staan.' }],
      answerExplanation: 'Jheronimus Bosch (ca. 1450–1516) schilderde wonderlijke fantasiewezens, vaak opgebouwd uit mensen, dieren en voorwerpen. De Boomman staat op het rechterpaneel van De tuin der lusten: een mensengezicht onder een schijf, een hol ei-achtig lichaam met een herberg en boomstam-benen in bootjes. Onze illustratie is een vrije reconstructie van dat schilderijmotief. Het standbeeld op de Markt is gemaakt door August Falise en werd in 1930 onthuld. Let op het penseel, het palet en de levensjaren op de sokkel: 1450–1516.',
      reward: { title: 'Verbeelding', text: 'Jullie Boomman is tot leven gewekt!', symbol: '✨' }
    },
    {
      id: 'sint-jan',
      order: 5,
      slug: 'sint-jan',
      title: 'Het Hemelse Bericht',
      shortTitle: 'Boodschap',
      locationName: 'Sint-Janskathedraal, Paradezijde',
      coordinates: { latitude: 51.687992, longitude: 5.308464, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Bellende engel', text: 'Luister naar het patroon en noteer de code.', audioSrc: audioAsset('05-sint-jan.mp3'), transcript: audioTranscripts.bellendeEngel },
      navigation: { clue: 'Een bericht verstopt zich in klank en ritme.', fallbackDirections: 'Bezoek de Sint-Jan.', externalMapsQuery: 'Sint Jan Den Bosch' },
      challenge: {
        kind: 'code',
        prompt: 'Voer de ritmecode in.',
        answerLength: 4,
        keyboard: 'numeric',
        acceptedAnswers: ['3142', '3-1-4-2'],
        wrongFeedback: 'De code klinkt anders.'
      },
      hints: [{ id: 'h1', text: 'Tel korte en lange signalen apart.' }],
      reward: { title: 'Boodschap', text: 'De klank is gekraakt.', symbol: '🔔' }
    },
    {
      id: 'kruithuis',
      order: 6,
      slug: 'kruithuis',
      title: 'Vuur en Water',
      shortTitle: 'Kruithuis',
      locationName: 'Kruithuis, Citadellaan 7',
      coordinates: { latitude: 51.693656, longitude: 5.305112, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      // De oude 06-kruithuis.mp3 beschrijft een routepuzzel die niet bestaat.
      // Audio pas opnieuw aansluiten na een opname die met het transcript overeenkomt.
      intro: { title: 'Het geheim van het Kruithuis', text: 'Eén vonk kon Den Bosch laten beven. De bouwmeester verborg een slimme bescherming in dit gebouw. Ontdekken jullie zijn geheim?', transcript: audioTranscripts.kruithuis },
      navigation: { clue: 'Zoek het oude Kruithuis aan de Citadellaan. Wat vertelt het gebouw over de verdediging van de stad?', fallbackDirections: 'Ga naar het Kruithuis aan de Citadellaan 7.', externalMapsQuery: 'Kruithuis Den Bosch' },
      challenge: {
        kind: 'choice',
        prompt: 'De Moerasdraak bewaakte hier ooit een gevaarlijke voorraad. Eén vonk kon genoeg zijn om het hele gebouw te laten ontploffen. De bouwmeester bedacht daarom een slimme manier om de stad te beschermen. Wat moest er gebeuren met de kracht van een explosie als het buskruit toch ontplofte?',
        options: [
          { id: 'b', label: 'De kracht moest via ondergrondse gangen ontsnappen.', correct: false },
          { id: 'c', label: 'De kracht moest door de dikke muren worden opgevangen.', correct: false },
          { id: 'a', label: 'De kracht moest vooral omhoog, door het lichtere dak.', correct: true },
          { id: 'd', label: 'De kracht moest via het water van de gracht worden afgevoerd.', correct: false }
        ],
        correctFeedback: 'Precies! Door de lichte dakconstructie kon de druk vooral omhoog ontsnappen, weg van de stad. Het geheim van het Kruithuis is ontrafeld!',
        wrongFeedback: 'Dat zou de stad niet goed genoeg beschermen. Denk aan de richting waarin de kracht van de explosie het gebouw het makkelijkst kon verlaten.'
      },
      hints: [{ id: 'h1', text: 'BOEM! Daar gaat mijn kapsel! Gelukkig dacht de bouwmeester vooruit. Kijk eens omhoog… Wat is gemakkelijker kapot te krijgen: een muur van een meter dik of een dak?' }],
      answerExplanation: 'Het Bossche Kruithuis werd tussen 1618 en 1620 gebouwd om buskruit veilig op te slaan. Het zeshoekige gebouw kreeg buitenmuren van ongeveer één meter dik, dunnere muren rond de binnenplaats en een relatief lichte dakconstructie. Bij een ontploffing moest de druk daardoor vooral omhoog en van de stad af worden geleid. Oorspronkelijk lag er ook een gracht om het gebouw. Het is het laatste overgebleven kruithuis uit de Tachtigjarige Oorlog in Nederland.',
      reward: { title: 'Moed', text: 'Het geheim van het Kruithuis is ontrafeld.', symbol: '🛡️' }
    },
    {
      id: 'bossche-brouwers',
      order: 7,
      slug: 'bossche-brouwers',
      title: 'De Brouwcode',
      shortTitle: 'Finish',
      locationName: 'Bossche Brouwers, Tramkade 29',
      coordinates: { latitude: 51.696900, longitude: 5.299290, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'De finale', text: 'Zet het brouwproces in juiste volgorde.', audioSrc: audioAsset('07-tramkade.mp3'), transcript: audioTranscripts.tramkade },
      navigation: { clue: 'De laatste herinnering eindigt bij de brouwers.', fallbackDirections: 'Ga naar Bossche Brouwers.', externalMapsQuery: 'Bossche Brouwers Den Bosch' },
      challenge: {
        kind: 'reorder',
        prompt: 'Zet brouwstappen in volgorde.',
        items: ['Gisten', 'Schroten', 'Koelen', 'Maischen', 'Koken', 'Filteren'],
        correctOrder: ['Schroten', 'Maischen', 'Filteren', 'Koken', 'Koelen', 'Gisten'],
        wrongFeedback: 'Het brouwproces loopt anders.'
      },
      hints: [{ id: 'h1', text: 'Denk in processtappen, van korrel naar gist.' }],
      reward: { title: 'Rust', text: 'De draak kan slapen.', symbol: '🍺' },
      isFinal: true
    }
  ]
};
