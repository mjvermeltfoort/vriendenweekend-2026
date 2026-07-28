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
  | CompositeSelectChallengeConfig;

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
  summaryTemplate: string;
  wrongFeedback: string;
}
