import { create } from 'zustand';

export type Screen = 'home' | 'setup' | 'lobby' | 'game' | 'results' | 'settings';
export interface Player {
  id: string;
  name: string;
  score: number;
  bot: boolean;
}
interface GameState {
  screen: Screen;
  phase: 'listen' | 'perform' | 'reveal';
  round: number;
  rounds: number;
  players: Player[];
  scores: number[];
  theme: string;
  highContrast: boolean;
  reducedMotion: boolean;
  setScreen: (screen: Screen) => void;
  setPlayers: (players: Player[]) => void;
  setRounds: (rounds: 5 | 7 | 10 | 15) => void;
  startGame: () => void;
  setPhase: (phase: GameState['phase']) => void;
  addScore: (value: number) => void;
  nextRound: () => void;
  setTheme: (theme: string) => void;
  toggleContrast: () => void;
  toggleMotion: () => void;
}
export const useGame = create<GameState>((set, get) => ({
  screen: 'home',
  phase: 'listen',
  round: 0,
  rounds: 5,
  players: [],
  scores: Array.from({ length: 5 }, () => 0),
  theme: 'festival',
  highContrast: false,
  reducedMotion:
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  setScreen: (screen) => set({ screen }),
  setPlayers: (players) => set({ players }),
  setRounds: (rounds) => set({ rounds, scores: Array.from({ length: rounds }, () => 0) }),
  startGame: () =>
    set({
      screen: 'game',
      round: 0,
      phase: 'listen',
      scores: Array.from({ length: get().rounds }, () => 0),
    }),
  setPhase: (phase) => set({ phase }),
  addScore: (value) => {
    const scores = [...get().scores];
    scores[get().round] = value;
    set({ scores });
  },
  nextRound: () => {
    const next = get().round + 1;
    set(next >= get().rounds ? { screen: 'results' } : { round: next, phase: 'listen' });
  },
  setTheme: (theme) => set({ theme }),
  toggleContrast: () => set({ highContrast: !get().highContrast }),
  toggleMotion: () => set({ reducedMotion: !get().reducedMotion }),
}));
