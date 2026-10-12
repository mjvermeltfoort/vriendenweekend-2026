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
      locationName: 'Huis van Bosch, Markt 29',
      coordinates: { latitude: 51.688968, longitude: 5.304617, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Gevels worden lichaam', text: 'Stel een fantasiewezen samen uit drie delen.', audioSrc: audioAsset('04-jheronimus-bosch.mp3'), transcript: audioTranscripts.jheronimusBosch },
      navigation: { clue: 'Combineer wat je op gevels herkent.', fallbackDirections: 'Ga naar de Markt en kijk rond.', externalMapsQuery: 'Markt Den Bosch' },
      challenge: {
        kind: 'composite',
        prompt: 'Kies een hoofd, een lijf en een voorwerp.',
        categories: {
          head: ['Masker', 'Horn', 'Kroon'],
          body: ['Mantel', 'Steen', 'Schubben'],
          object: ['Vork', 'Lantaarn', 'Sleutel']
        },
        correctAnswer: {
          head: 'Horn',
          body: 'Schubben',
          object: 'Lantaarn'
        },
        summaryTemplate: 'Hoofd: {head}, lijf: {body}, object: {object}.',
        wrongFeedback: 'Nog niet de juiste combinatie.'
      },
      hints: [{ id: 'h1', text: 'Zoek naar het meest drakige hoofd.' }],
      reward: { title: 'Verbeelding', text: 'Het wezen krijgt vorm.', symbol: '✨' }
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
      shortTitle: 'Balans',
      locationName: 'Kruithuis, Citadellaan 7',
      coordinates: { latitude: 51.693656, longitude: 5.305112, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Vuur, water en verdediging', text: 'Breng drie krachten in balans.', audioSrc: audioAsset('06-kruithuis.mp3'), transcript: audioTranscripts.kruithuis },
      navigation: { clue: 'Zoek baksteen, water en muur.', fallbackDirections: 'Ga naar het Kruithuis of Citadel.', externalMapsQuery: 'Kruithuis Den Bosch' },
      challenge: {
        kind: 'choice',
        prompt: 'Wat hoort hier het meest bij?',
        options: [
          { id: 'b', label: 'Zwemmen', correct: false },
          { id: 'a', label: 'Verdediging', correct: true },
          { id: 'c', label: 'Bakken', correct: false }
        ],
        correctFeedback: 'Juist: balans houdt stand.',
        wrongFeedback: 'Niet de juiste kracht.'
      },
      hints: [{ id: 'h1', text: 'Kijk naar functie, niet naar sfeer.' }],
      reward: { title: 'Moed', text: 'De verdediging staat.', symbol: '🛡️' }
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
