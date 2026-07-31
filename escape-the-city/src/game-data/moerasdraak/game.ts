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
        prompt: 'Welke aanwijzing past bij start?',
        options: [
          { id: 'a', label: 'Water', correct: true },
          { id: 'b', label: 'Vuur', correct: false },
          { id: 'c', label: 'Zand', correct: false }
        ],
        correctFeedback: 'Goed: de eerste herinnering komt uit water.',
        wrongFeedback: 'Nog niet. Kijk opnieuw naar de fontein.'
      },
      hints: [{ id: 'h1', text: 'De fontein staat niet bij een winkelstraat.' }],
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
      intro: { title: 'Tegenstrijdige getuigen', text: 'Een detail in de straat ontmaskert één verklaring.', audioSrc: audioAsset('02-zoete-lieve-gerritje.mp3'), transcript: audioTranscripts.zoeteLieveGerritje },
      navigation: { clue: 'Let op gevels en details rond Gerritje.', fallbackDirections: 'Loop naar Zoete Lieve Gerritje.', externalMapsQuery: 'Zoete Lieve Gerritje Den Bosch' },
      challenge: {
        kind: 'choice',
        prompt: 'Welke verklaring klopt niet?',
        options: [
          { id: 'a', label: 'De brug lag hier altijd al', correct: false },
          { id: 'b', label: 'Er stroomt water onder de stad', correct: true },
          { id: 'c', label: 'De stenen zijn oud', correct: false }
        ],
        correctFeedback: 'Juist: die verklaring past bij de plek.',
        wrongFeedback: 'Niet juist. Eén verhaal wijkt af.'
      },
      hints: [{ id: 'h1', text: 'Kies het detail dat ook zonder fantasie logisch blijft.' }],
      reward: { title: 'Legende', text: 'Getuigenis bevestigd.', symbol: '📜' }
    },
    {
      id: 'binnendieze',
      order: 3,
      slug: 'binnendieze',
      title: 'De Verdwenen Stroom',
      shortTitle: 'Water',
      locationName: 'Waterpoort, Herman Moerkerkpark',
      coordinates: { latitude: 51.689641, longitude: 5.305190, radiusMeters: 35, maximumAccuracyMeters: 40, needsOnSiteVerification: true },
      intro: { title: 'Onder de stad', text: 'Zet de waterstromen in juiste volgorde.', audioSrc: audioAsset('03-binnendieze.mp3'), transcript: audioTranscripts.binnendieze },
      navigation: { clue: 'Volg het water waar de stad haar geheimen bewaart.', fallbackDirections: 'Zoek een toegangspunt tot de Binnendieze.', externalMapsQuery: 'Binnendieze Den Bosch' },
      challenge: {
        kind: 'reorder',
        prompt: 'Welke route klopt?',
        items: ['Bron', 'Kanaal', 'Sluis', 'Stad'],
        correctOrder: ['Bron', 'Kanaal', 'Sluis', 'Stad'],
        wrongFeedback: 'De stroom loopt anders.'
      },
      hints: [{ id: 'h1', text: 'Water beweegt altijd van begin naar eind.' }],
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
        prompt: 'Kies hoofd, lijf en object.',
        categories: {
          head: ['Horn', 'Masker', 'Kroon'],
          body: ['Schubben', 'Mantel', 'Steen'],
          object: ['Lantaarn', 'Sleutel', 'Vork']
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
          { id: 'a', label: 'Verdediging', correct: true },
          { id: 'b', label: 'Zwemmen', correct: false },
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
        items: ['Schroten', 'Maischen', 'Filteren', 'Koken', 'Koelen', 'Gisten'],
        correctOrder: ['Schroten', 'Maischen', 'Filteren', 'Koken', 'Koelen', 'Gisten'],
        wrongFeedback: 'Het brouwproces loopt anders.'
      },
      hints: [{ id: 'h1', text: 'Denk in processtappen, van korrel naar gist.' }],
      reward: { title: 'Rust', text: 'De draak kan slapen.', symbol: '🍺' },
      isFinal: true
    }
  ]
};
