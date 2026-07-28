import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGame } from '../../app/gameContext';

const MUSIC_VOLUME = 0.16;
const DUCKED_VOLUME = 0.04;
const CROSSFADE_MS = 800;

interface NarrationState {
  source: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  error: string;
}

interface AudioContextValue {
  soundEnabled: boolean;
  backgroundMusicEnabled: boolean;
  unlocked: boolean;
  effectPlaying: boolean;
  narration: NarrationState;
  setBackgroundTrack: (source: string) => void;
  unlockAudio: () => void;
  toggleSound: () => void;
  toggleBackgroundMusic: () => void;
  toggleNarration: (source: string) => void;
  stopNarration: () => void;
  seekNarration: (seconds: number) => void;
  playEffectSequence: (sources: readonly string[], gapMs?: number) => void;
  stopEffects: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

const initialNarration: NarrationState = {
  source: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  error: ''
};

export function AudioProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useGame();
  const backgroundChannels = useRef<HTMLAudioElement[]>([]);
  const activeBackground = useRef(0);
  const desiredBackground = useRef('');
  const fadeFrame = useRef<number | null>(null);
  const narrationElement = useRef<HTMLAudioElement | null>(null);
  const effectElement = useRef<HTMLAudioElement | null>(null);
  const effectRunId = useRef(0);
  const effectResolve = useRef<(() => void) | null>(null);
  const effectPlayingRef = useRef(false);
  const unlockedRef = useRef(false);
  const narrationPlayingRef = useRef(false);
  const visibilityPausedRef = useRef(false);
  const settingsRef = useRef(settings);
  const [unlocked, setUnlocked] = useState(false);
  const [narration, setNarration] = useState<NarrationState>(initialNarration);
  const [effectPlaying, setEffectPlaying] = useState(false);

  settingsRef.current = settings;

  const targetMusicVolume = useCallback(() => narrationPlayingRef.current || effectPlayingRef.current ? DUCKED_VOLUME : MUSIC_VOLUME, []);

  const cancelFade = useCallback(() => {
    if (fadeFrame.current !== null) {
      cancelAnimationFrame(fadeFrame.current);
      fadeFrame.current = null;
    }
  }, []);

  const fadeChannels = useCallback((from: HTMLAudioElement | null, to: HTMLAudioElement, target: number) => {
    cancelFade();
    const fromVolume = from?.volume ?? 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / CROSSFADE_MS);
      if (from) from.volume = Math.max(0, fromVolume * (1 - progress));
      to.volume = Math.max(0, Math.min(1, target * progress));
      if (progress < 1) {
        fadeFrame.current = requestAnimationFrame(step);
      } else {
        if (from) {
          from.pause();
          from.currentTime = 0;
        }
        fadeFrame.current = null;
      }
    };
    fadeFrame.current = requestAnimationFrame(step);
  }, [cancelFade]);

  const startBackground = useCallback(async (source = desiredBackground.current) => {
    if (!source || !unlockedRef.current || !settingsRef.current.soundEnabled || !settingsRef.current.backgroundMusicEnabled || document.hidden) return;
    const channels = backgroundChannels.current;
    if (channels.length !== 2) return;
    const current = channels[activeBackground.current];
    if (current.dataset.source === source) {
      current.volume = targetMusicVolume();
      try {
        await current.play();
      } catch {
        return;
      }
      return;
    }

    const nextIndex = activeBackground.current === 0 ? 1 : 0;
    const next = channels[nextIndex];
    next.src = source;
    next.dataset.source = source;
    next.currentTime = 0;
    next.volume = 0;
    try {
      await next.play();
    } catch {
      return;
    }
    fadeChannels(current.dataset.source ? current : null, next, targetMusicVolume());
    activeBackground.current = nextIndex;
  }, [fadeChannels, targetMusicVolume]);

  const stopBackground = useCallback(() => {
    cancelFade();
    for (const channel of backgroundChannels.current) channel.pause();
  }, [cancelFade]);

  useEffect(() => {
    const first = new Audio();
    const second = new Audio();
    for (const channel of [first, second]) {
      channel.loop = true;
      channel.preload = 'auto';
      channel.volume = 0;
    }
    backgroundChannels.current = [first, second];

    const voice = new Audio();
    voice.preload = 'metadata';
    narrationElement.current = voice;
    const effect = new Audio();
    effect.preload = 'auto';
    effectElement.current = effect;

    const updateTime = () => {
      setNarration((current) => ({
        ...current,
        currentTime: Number.isFinite(voice.currentTime) ? voice.currentTime : 0,
        duration: Number.isFinite(voice.duration) ? voice.duration : 0
      }));
    };
    const handlePlay = () => {
      narrationPlayingRef.current = true;
      const active = backgroundChannels.current[activeBackground.current];
      if (active && !active.paused) active.volume = DUCKED_VOLUME;
      setNarration((current) => ({ ...current, playing: true, error: '' }));
    };
    const handlePause = () => {
      narrationPlayingRef.current = false;
      const active = backgroundChannels.current[activeBackground.current];
      if (active && !active.paused) active.volume = MUSIC_VOLUME;
      setNarration((current) => ({ ...current, playing: false }));
    };
    const handleEnded = () => {
      handlePause();
      setNarration((current) => ({ ...current, currentTime: current.duration }));
    };
    const handleError = () => {
      handlePause();
      setNarration((current) => ({ ...current, error: 'Audio kon niet worden geladen.' }));
    };

    voice.addEventListener('timeupdate', updateTime);
    voice.addEventListener('loadedmetadata', updateTime);
    voice.addEventListener('durationchange', updateTime);
    voice.addEventListener('play', handlePlay);
    voice.addEventListener('pause', handlePause);
    voice.addEventListener('ended', handleEnded);
    voice.addEventListener('error', handleError);

    return () => {
      cancelFade();
      effectRunId.current += 1;
      effectResolve.current?.();
      effectResolve.current = null;
      first.pause();
      second.pause();
      voice.pause();
      effect.pause();
      voice.removeEventListener('timeupdate', updateTime);
      voice.removeEventListener('loadedmetadata', updateTime);
      voice.removeEventListener('durationchange', updateTime);
      voice.removeEventListener('play', handlePlay);
      voice.removeEventListener('pause', handlePause);
      voice.removeEventListener('ended', handleEnded);
      voice.removeEventListener('error', handleError);
    };
  }, [cancelFade]);

  useEffect(() => {
    if (!settings.soundEnabled || !settings.backgroundMusicEnabled) {
      stopBackground();
    } else if (unlockedRef.current) {
      void startBackground();
    }
    if (!settings.soundEnabled) {
      narrationElement.current?.pause();
      effectRunId.current += 1;
      effectResolve.current?.();
      effectResolve.current = null;
      effectElement.current?.pause();
      effectPlayingRef.current = false;
      setEffectPlaying(false);
    }
  }, [settings.soundEnabled, settings.backgroundMusicEnabled, startBackground, stopBackground]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        visibilityPausedRef.current = backgroundChannels.current.some((channel) => !channel.paused);
        stopBackground();
      } else if (visibilityPausedRef.current) {
        visibilityPausedRef.current = false;
        void startBackground();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startBackground, stopBackground]);

  const unlockAudio = useCallback(() => {
    unlockedRef.current = true;
    setUnlocked(true);
    if (!settingsRef.current.soundEnabled) {
      settingsRef.current = { ...settingsRef.current, soundEnabled: true };
      updateSettings({ soundEnabled: true });
    }
    void startBackground();
  }, [startBackground, updateSettings]);

  const setBackgroundTrack = useCallback((source: string) => {
    if (desiredBackground.current === source) return;
    desiredBackground.current = source;
    if (unlockedRef.current) void startBackground(source);
  }, [startBackground]);

  const toggleSound = useCallback(() => {
    const enabled = !settingsRef.current.soundEnabled;
    settingsRef.current = { ...settingsRef.current, soundEnabled: enabled };
    updateSettings({ soundEnabled: enabled });
    if (enabled) {
      unlockedRef.current = true;
      setUnlocked(true);
      void startBackground();
    } else {
      stopBackground();
      narrationElement.current?.pause();
      effectRunId.current += 1;
      effectResolve.current?.();
      effectResolve.current = null;
      effectElement.current?.pause();
      effectPlayingRef.current = false;
      setEffectPlaying(false);
    }
  }, [startBackground, stopBackground, updateSettings]);

  const toggleBackgroundMusic = useCallback(() => {
    const enabled = !settingsRef.current.backgroundMusicEnabled;
    settingsRef.current = { ...settingsRef.current, backgroundMusicEnabled: enabled };
    updateSettings({ backgroundMusicEnabled: enabled });
    if (enabled) {
      unlockedRef.current = true;
      setUnlocked(true);
      void startBackground();
    } else {
      stopBackground();
    }
  }, [startBackground, stopBackground, updateSettings]);

  const stopNarration = useCallback(() => {
    const voice = narrationElement.current;
    if (!voice) return;
    voice.pause();
    voice.currentTime = 0;
    setNarration((current) => ({ ...current, playing: false, currentTime: 0 }));
  }, []);

  const stopEffects = useCallback(() => {
    effectRunId.current += 1;
    effectResolve.current?.();
    effectResolve.current = null;
    const effect = effectElement.current;
    if (effect) {
      effect.pause();
      effect.currentTime = 0;
    }
    effectPlayingRef.current = false;
    setEffectPlaying(false);
    const active = backgroundChannels.current[activeBackground.current];
    if (active && !active.paused) active.volume = narrationPlayingRef.current ? DUCKED_VOLUME : MUSIC_VOLUME;
  }, []);

  const playEffectSequence = useCallback((sources: readonly string[], gapMs = 180) => {
    const effect = effectElement.current;
    if (!effect || !sources.length) return;
    stopEffects();
    const runId = effectRunId.current + 1;
    effectRunId.current = runId;
    narrationElement.current?.pause();
    unlockedRef.current = true;
    setUnlocked(true);
    if (!settingsRef.current.soundEnabled) {
      settingsRef.current = { ...settingsRef.current, soundEnabled: true };
      updateSettings({ soundEnabled: true });
    }
    effectPlayingRef.current = true;
    setEffectPlaying(true);
    const active = backgroundChannels.current[activeBackground.current];
    if (active && !active.paused) active.volume = DUCKED_VOLUME;

    const play = async () => {
      for (const source of sources) {
        if (effectRunId.current !== runId) return;
        effect.src = source;
        effect.currentTime = 0;
        await new Promise<void>((resolve) => {
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            effect.removeEventListener('ended', finish);
            effect.removeEventListener('error', finish);
            if (effectResolve.current === finish) effectResolve.current = null;
            resolve();
          };
          effectResolve.current = finish;
          effect.addEventListener('ended', finish, { once: true });
          effect.addEventListener('error', finish, { once: true });
          void effect.play().catch(finish);
        });
        if (effectRunId.current !== runId) return;
        await new Promise((resolve) => window.setTimeout(resolve, gapMs));
      }
      if (effectRunId.current === runId) {
        effectPlayingRef.current = false;
        setEffectPlaying(false);
        const current = backgroundChannels.current[activeBackground.current];
        if (current && !current.paused) current.volume = narrationPlayingRef.current ? DUCKED_VOLUME : MUSIC_VOLUME;
      }
    };
    void play();
    void startBackground();
  }, [startBackground, stopEffects, updateSettings]);

  const toggleNarration = useCallback((source: string) => {
    const voice = narrationElement.current;
    if (!voice) return;
    unlockedRef.current = true;
    setUnlocked(true);
    if (!settingsRef.current.soundEnabled) {
      settingsRef.current = { ...settingsRef.current, soundEnabled: true };
      updateSettings({ soundEnabled: true });
    }
    if (voice.dataset.source === source && !voice.paused) {
      voice.pause();
      return;
    }
    stopEffects();
    if (voice.dataset.source !== source) {
      voice.src = source;
      voice.dataset.source = source;
      voice.currentTime = 0;
      setNarration({ source, playing: false, currentTime: 0, duration: 0, error: '' });
    }
    void voice.play().catch(() => {
      setNarration((current) => ({ ...current, playing: false, error: 'Tik opnieuw om audio af te spelen.' }));
    });
    void startBackground();
  }, [startBackground, stopEffects, updateSettings]);

  const seekNarration = useCallback((seconds: number) => {
    const voice = narrationElement.current;
    if (!voice || !Number.isFinite(seconds)) return;
    voice.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(voice.duration) ? voice.duration : seconds));
    setNarration((current) => ({ ...current, currentTime: voice.currentTime }));
  }, []);

  const value = useMemo<AudioContextValue>(() => ({
    soundEnabled: settings.soundEnabled,
    backgroundMusicEnabled: settings.backgroundMusicEnabled,
    unlocked,
    effectPlaying,
    narration,
    setBackgroundTrack,
    unlockAudio,
    toggleSound,
    toggleBackgroundMusic,
    toggleNarration,
    stopNarration,
    seekNarration,
    playEffectSequence,
    stopEffects
  }), [
    narration,
    effectPlaying,
    playEffectSequence,
    seekNarration,
    setBackgroundTrack,
    settings.backgroundMusicEnabled,
    settings.soundEnabled,
    stopNarration,
    stopEffects,
    toggleBackgroundMusic,
    toggleNarration,
    toggleSound,
    unlockAudio,
    unlocked
  ]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const value = useContext(AudioContext);
  if (!value) throw new Error('AudioProvider ontbreekt.');
  return value;
}
