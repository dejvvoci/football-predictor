// Rrethet e mundshme të fazës me eliminim direkt, ashtu siç i emërton football-data.org
export type BracketRoundName = 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'FINAL';

export const BRACKET_ROUND_ORDER: BracketRoundName[] = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

export const BRACKET_ROUND_LABELS: Record<BracketRoundName, string> = {
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinals',
  SEMI_FINALS: 'Semifinals',
  FINAL: 'Final'
};

export const DEFAULT_POINTS_PER_ROUND: Record<BracketRoundName, number> = {
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 5,
  FINAL: 8
};

export interface BracketTeam {
  name: string;
  crest?: string;
}

/** Një çift/ndeshje brenda një rrethi të bracket-it */
export interface BracketMatchup {
  id: string;              // `${round}_${slotIndex}`
  round: BracketRoundName;
  slotIndex: number;       // pozicioni brenda rrethit, duke filluar nga 0
  home: BracketTeam;
  away: BracketTeam;
}

export interface Bracket {
  id: string;
  title: string;
  competition: string;
  rounds: BracketRoundName[];                      // rradha e rretheve, nga i pari deri te finalja
  pointsPerRound: Partial<Record<BracketRoundName, number>>;
  matchups: BracketMatchup[];                      // vetëm ndeshjet reale të rrethit të parë
  deadline: number;                                // kickoff i ndeshjes më të hershme të rrethit të parë
  status: 'open' | 'locked' | 'resolved';
  resolvedRounds?: BracketRoundName[];              // rrethet për të cilat pikët janë llogaritur tashmë
  createdBy: string;
  createdAt: number;
}

export interface BracketPrediction {
  id: string;                                       // `${userId}_${bracketId}`
  userId: string;
  displayName: string;
  bracketId: string;
  picks: Record<string, string>;                    // matchupId → emri i ekipit të parashikuar fitues
  roundPoints?: Partial<Record<BracketRoundName, number>>;
  totalPoints?: number;
  claimed?: boolean;
  createdAt: number;
  updatedAt: number;
}
