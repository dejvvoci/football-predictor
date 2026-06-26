export interface TableTeam {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

export interface TableStandingEntry {
  position: number;
  teamId: number;
  teamName: string;
  teamShortName: string;
  points: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TableSeason {
  id: string;                      // `{code}_{season}`
  competition: string;             // "Premier League"
  code: string;                    // "PL"
  season: number;                  // 2024
  teams: TableTeam[];
  deadline: number;                // timestamp — predictions close
  currentStandings: TableStandingEntry[];
  active: boolean;
  lastUpdated?: number;
}

export interface TablePrediction {
  id: string;                      // `{code}_{season}_{userId}`
  userId: string;
  displayName: string;
  competition: string;
  code: string;
  season: number;
  prediction: string[];            // teamShortName in order (index 0 = 1st)
  score?: number;
  computedAt?: number;
  createdAt: number;
}

export const COMP_NAMES: Record<string, string> = {
  PL:  'Premier League',
  PD:  'La Liga',
  BL1: 'Bundesliga',
  SA:  'Serie A',
  FL1: 'Ligue 1',
};

export const COMP_FLAGS: Record<string, string> = {
  PL: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', PD: '🇪🇸', BL1: '🇩🇪', SA: '🇮🇹', FL1: '🇫🇷'
};