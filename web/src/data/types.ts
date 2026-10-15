import type { TableView } from '../table/types';

/** Una fila del torneo (mismo formato que va a producir eval/). Las proporciones van de 0 a 1. */
export interface TournamentRow {
  rival: string;
  description: string;
  partidos: number;
  ganados: number;
  winRate: number;
  ciLow: number;
  ciHigh: number;
  netPerHand: number;
  netCiLow: number;
  netCiHigh: number;
  /** % de jugadas del rival externo que hubo que reemplazar por una legal. `null` si no aplica. */
  fallbackPct: number | null;
}

export interface LearningPoint {
  iteration: number;
  vsRandom: number;
  vsHeuristic: number;
}

export interface ExploitPoint {
  iteration: number;
  /** Puntos por mano que perdería contra el mejor contrincante (MiniTruco, exacta). */
  exploitability: number;
}

export interface ReplayStep {
  caption: string;
  view: TableView;
}

export interface Highlight {
  id: string;
  title: string;
  why: string;
  steps: ReplayStep[];
}

export interface ResultsData {
  isMock: boolean;
  generatedAt: string;
  tournament: TournamentRow[];
  learning: LearningPoint[];
  exploitability: ExploitPoint[];
  /** Explotabilidad de la red final de MiniTruco (puntos por mano). */
  exploitabilityFinal?: number;
}
