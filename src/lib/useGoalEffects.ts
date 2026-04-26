import { useEffect, useRef, useState } from 'react';
import { isLiveGame } from './gameSelection';
import type { GoalFlashState } from '../components/GoalFlash';
import type { NhlGame } from './types';

export const GOAL_FLASH_DURATION_MS = 60_000;
const GOAL_HORN_DURATION_MS = 3_000;

type GoalHornCleanup = () => void;

export function useGoalFlash(game: NhlGame | null): GoalFlashState | null {
  const [goalFlash, setGoalFlash] = useState<GoalFlashState | null>(null);
  const previousGameRef = useRef<NhlGame | null>(null);

  useEffect(() => {
    const previousGame = previousGameRef.current;

    if (!game) {
      previousGameRef.current = null;
      return;
    }

    if (previousGame && previousGame.id === game.id && isLiveGame(game)) {
      const previousAwayScore = previousGame.awayTeam.score ?? 0;
      const previousHomeScore = previousGame.homeTeam.score ?? 0;
      const nextAwayScore = game.awayTeam.score ?? 0;
      const nextHomeScore = game.homeTeam.score ?? 0;
      const awayIncrease = nextAwayScore - previousAwayScore;
      const homeIncrease = nextHomeScore - previousHomeScore;

      if (awayIncrease > 0 && homeIncrease <= 0) {
        setGoalFlash({
          key: Date.now(),
          gameId: game.id,
          team: game.awayTeam,
          alignment: 'away',
        });
      } else if (homeIncrease > 0 && awayIncrease <= 0) {
        setGoalFlash({
          key: Date.now(),
          gameId: game.id,
          team: game.homeTeam,
          alignment: 'home',
        });
      }
    }

    previousGameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!goalFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGoalFlash((currentGoalFlash) =>
        currentGoalFlash?.key === goalFlash.key ? null : currentGoalFlash,
      );
    }, GOAL_FLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [goalFlash]);

  return goalFlash;
}

export function useSelectedGamesGoalFlash(games: NhlGame[]): GoalFlashState | null {
  const [goalFlash, setGoalFlash] = useState<GoalFlashState | null>(null);
  const previousScoresRef = useRef<Map<number, { awayScore: number; homeScore: number }>>(
    new Map(),
  );

  useEffect(() => {
    const previousScores = previousScoresRef.current;
    const nextScores = new Map<number, { awayScore: number; homeScore: number }>();
    let nextGoalFlash: GoalFlashState | null = null;

    for (const game of games) {
      const awayScore = game.awayTeam.score ?? 0;
      const homeScore = game.homeTeam.score ?? 0;

      nextScores.set(game.id, { awayScore, homeScore });

      const previousGameScores = previousScores.get(game.id);

      if (!previousGameScores || !isLiveGame(game) || nextGoalFlash) {
        continue;
      }

      const awayIncrease = awayScore - previousGameScores.awayScore;
      const homeIncrease = homeScore - previousGameScores.homeScore;

      if (awayIncrease > 0 && homeIncrease <= 0) {
        nextGoalFlash = {
          key: Date.now(),
          gameId: game.id,
          team: game.awayTeam,
          alignment: 'away',
        };
      } else if (homeIncrease > 0 && awayIncrease <= 0) {
        nextGoalFlash = {
          key: Date.now(),
          gameId: game.id,
          team: game.homeTeam,
          alignment: 'home',
        };
      }
    }

    previousScoresRef.current = nextScores;

    if (nextGoalFlash) {
      setGoalFlash(nextGoalFlash);
    }
  }, [games]);

  useEffect(() => {
    if (!goalFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGoalFlash((currentGoalFlash) =>
        currentGoalFlash?.key === goalFlash.key ? null : currentGoalFlash,
      );
    }, GOAL_FLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [goalFlash]);

  return goalFlash;
}

function disconnectAudioNode(node: AudioNode) {
  try {
    node.disconnect();
  } catch {
    // Disconnect can throw if the node was already released.
  }
}

function stopAudioSource(source: AudioScheduledSourceNode, time: number) {
  try {
    source.stop(time);
  } catch {
    // Stop can throw if the source has already ended.
  }
}

async function playGoalHorn(audioContext: AudioContext): Promise<GoalHornCleanup | null> {
  if (audioContext.state === 'closed') {
    return null;
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const startTime = audioContext.currentTime + 0.02;
  const endTime = startTime + GOAL_HORN_DURATION_MS / 1_000;
  const masterGain = audioContext.createGain();
  const audioNodes: AudioNode[] = [masterGain];
  const sources: AudioScheduledSourceNode[] = [];

  masterGain.gain.setValueAtTime(0.18, startTime);
  masterGain.connect(audioContext.destination);

  [
    { frequency: 311.13, detune: -8, gain: 0.4 },
    { frequency: 392, detune: 5, gain: 0.32 },
    { frequency: 466.16, detune: 0, gain: 0.24 },
  ].forEach(({ frequency, detune, gain }) => {
    const oscillator = audioContext.createOscillator();
    const vibrato = audioContext.createOscillator();
    const vibratoGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const voiceGain = audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(detune, startTime);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(4.8, startTime);
    vibratoGain.gain.setValueAtTime(12, startTime);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.max(680, frequency * 2.15), startTime);
    filter.Q.setValueAtTime(0.8, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(gain, startTime + 0.08);
    voiceGain.gain.setValueAtTime(gain, endTime - 0.18);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(oscillator.detune);
    oscillator.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(masterGain);

    oscillator.start(startTime);
    vibrato.start(startTime);
    oscillator.stop(endTime);
    vibrato.stop(endTime);

    sources.push(oscillator, vibrato);
    audioNodes.push(vibratoGain, filter, voiceGain);
  });

  let released = false;
  const cleanupTimeoutId = window.setTimeout(() => {
    cleanup();
  }, GOAL_HORN_DURATION_MS + 250);

  function cleanup() {
    if (released) {
      return;
    }

    released = true;
    window.clearTimeout(cleanupTimeoutId);
    const stopTime = audioContext.currentTime;

    sources.forEach((source) => {
      stopAudioSource(source, stopTime);
      disconnectAudioNode(source);
    });

    audioNodes.forEach(disconnectAudioNode);
  }

  return cleanup;
}

export function useGoalHorn(goalFlash: GoalFlashState | null, muted: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeHornCleanupRef = useRef<GoalHornCleanup | null>(null);
  const lastPlayedGoalKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (muted) {
      activeHornCleanupRef.current?.();
      activeHornCleanupRef.current = null;
    }

    if (!goalFlash) {
      return;
    }

    if (lastPlayedGoalKeyRef.current === goalFlash.key) {
      return;
    }

    lastPlayedGoalKeyRef.current = goalFlash.key;

    if (muted || typeof window.AudioContext !== 'function') {
      return;
    }

    const audioContext =
      audioContextRef.current ?? new window.AudioContext();

    audioContextRef.current = audioContext;
    activeHornCleanupRef.current?.();
    activeHornCleanupRef.current = null;

    let cancelled = false;

    void playGoalHorn(audioContext)
      .then((cleanup) => {
        if (cancelled) {
          cleanup?.();
          return;
        }

        activeHornCleanupRef.current = cleanup;
      })
      .catch(() => {
        // Audio playback is best-effort and can be blocked by browser policy.
      });

    return () => {
      cancelled = true;
    };
  }, [goalFlash, muted]);

  useEffect(() => {
    return () => {
      activeHornCleanupRef.current?.();
      activeHornCleanupRef.current = null;

      if (!audioContextRef.current) {
        return;
      }

      void audioContextRef.current.close().catch(() => {
        // Ignore shutdown failures during unmount.
      });
    };
  }, []);
}
