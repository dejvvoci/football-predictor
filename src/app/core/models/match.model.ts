export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface MatchOdds {
  home: number; // koeficenti për fitoren e skuadrës 1
  draw: number; // koeficenti për barazim (X)
  away: number; // koeficenti për fitoren e skuadrës 2
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
}

export interface Match {
  id: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string;
  awayCrest?: string;
  venue?: string;
  kickoff: number; // timestamp (ms)
  status: MatchStatus;
  odds: MatchOdds;
  result?: MatchResult;
}