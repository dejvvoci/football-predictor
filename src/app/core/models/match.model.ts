export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface OverUnderOdds {
  over: number;
  under: number;
  line: number; // tipikisht 2.5
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
  kickoff: number;
  status: MatchStatus;
  odds: MatchOdds;
  ouOdds?: OverUnderOdds;
  result?: MatchResult;
  halfTimeResult?: MatchResult;
  hasRedCard?: boolean;        // set by sync script from match detail API call
  stage?: string;              // football-data.org stage: GROUP_STAGE | LAST_16 | QUARTER_FINALS | SEMI_FINALS | FINAL | ...
}