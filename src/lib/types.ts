export type AppMode = 'auto' | 'manual';

export type TeamChoice = 'AUTO' | string;

export interface OverlayConfig {
  mode: AppMode;
  team: TeamChoice;
  gameId?: number;
  playoffsOnly: boolean;
  showClock: boolean;
}

export interface NamedValue {
  default: string;
}

export interface ClockState {
  timeRemaining: string;
  secondsRemaining: number;
  running: boolean;
  inIntermission: boolean;
}

export interface PeriodDescriptor {
  number: number;
  periodType: string;
  maxRegulationPeriods?: number;
}

export interface SeriesStatus {
  round?: number;
  seriesAbbrev?: string;
  seriesTitle?: string;
  topSeedTeamAbbrev: string;
  topSeedWins: number;
  bottomSeedTeamAbbrev: string;
  bottomSeedWins: number;
  gameNumberOfSeries?: number;
}

export interface TeamRecord {
  id: number;
  abbrev: string;
  score?: number;
  commonName?: NamedValue;
  placeName?: NamedValue;
  logo?: string;
  darkLogo?: string;
}

export interface NhlGame {
  id: number;
  season: number;
  gameType: number;
  gameState: string;
  gameScheduleState?: string;
  gameDate?: string;
  startTimeUTC: string;
  venueTimezone?: string;
  awayTeam: TeamRecord;
  homeTeam: TeamRecord;
  clock?: ClockState | null;
  periodDescriptor?: PeriodDescriptor;
  seriesStatus?: SeriesStatus;
}

export interface ScheduleDay {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
  games: NhlGame[];
}

export interface ScheduleResponse {
  previousStartDate?: string;
  nextStartDate?: string;
  gameWeek: ScheduleDay[];
}

export interface ScoreResponse {
  currentDate: string;
  prevDate?: string;
  nextDate?: string;
  games: NhlGame[];
}

export interface DataSnapshot {
  games: NhlGame[];
  selectedGame: NhlGame | null;
  schedule: ScheduleResponse | null;
  score: ScoreResponse | null;
}

