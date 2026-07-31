export interface GamePack {
  slug: string;
  version: number;
  title: string;
  subtitle: string;
  city: string;
  estimatedDurationMinutes: number;
  estimatedDistanceKm: number;
  startStopId: string;
  finalStopId: string;
  stops: RouteStop[];
  bonusLocations?: BonusLocation[];
  bonusCompletionReward?: BonusCompletionReward;
  scoring: ScoringConfig;
}

export interface RouteStop {
  id: string;
  order: number;
  slug: string;
  title: string;
  shortTitle: string;
  locationName: string;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number;
    maximumAccuracyMeters: number;
    needsOnSiteVerification: boolean;
  };
  intro: {
    title: string;
    text: string;
    audioSrc?: string;
    transcript?: string;
  };
  navigation: {
    clue: string;
    fallbackDirections?: string;
    externalMapsQuery?: string;
  };
  challenge: ChallengeConfig;
  hints: HintConfig[];
  reward: {
    title: string;
    text: string;
    symbol: string;
  };
  isFinal?: boolean;
}

/** An optional stop which never participates in the numbered main route. */
export interface BonusLocation extends RouteStop {
  id: `bonus:${string}`;
  isBonus: true;
  hiddenClue: string;
  revealedDescription: string;
  coordinates: RouteStop['coordinates'] & { discoveryRadiusMeters: number };
  estimatedDetourMinutes: number;
  maximumPoints: number;
  visibleAfterStopId: string;
  recommendedBetween: {
    afterStopId: string;
    beforeStopId: string;
  };
  manualVerification: {
    questionId: string;
    question: string;
  };
  reward: RouteStop['reward'] & {
    id: string;
    resultLabel: string;
  };
}

export interface BonusCompletionReward {
  requiredCount: number;
  points: number;
  title: string;
  badge: string;
}

export function isBonusLocation(location: RouteStop | BonusLocation): location is BonusLocation {
  return 'isBonus' in location && location.isBonus === true;
}

export interface ScoringConfig {
  basePoints: number;
  hintPenalty: number[];
  wrongAnswerPenalty: number;
  minimumPerStop: number;
}

export interface HintConfig {
  id: string;
  text: string;
}

export type ChallengeConfig =
  | ChoiceChallengeConfig
  | CodeChallengeConfig
  | ReorderChallengeConfig
  | CompositeSelectChallengeConfig
  | LensChallengeConfig;

export interface ChoiceChallengeConfig {
  kind: 'choice';
  prompt: string;
  options: { id: string; label: string; correct: boolean }[];
  correctFeedback: string;
  wrongFeedback: string;
}

export interface CodeChallengeConfig {
  kind: 'code';
  prompt: string;
  answerLength: number;
  keyboard: 'numeric' | 'text';
  acceptedAnswers: string[];
  wrongFeedback: string;
}

export interface ReorderChallengeConfig {
  kind: 'reorder';
  prompt: string;
  items: string[];
  correctOrder: string[];
  wrongFeedback: string;
}

export interface CompositeSelectChallengeConfig {
  kind: 'composite';
  prompt: string;
  categories: Record<string, string[]>;
  correctAnswer: Record<string, string>;
  summaryTemplate: string;
  wrongFeedback: string;
}

export interface LensChallengeConfig {
  kind: 'lens';
  prompt: string;
  correctAnswer: string;
  wrongFeedback: string;
}
