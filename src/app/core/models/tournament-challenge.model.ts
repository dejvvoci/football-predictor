export type ChallengeStatus = 'open' | 'closed' | 'resolved';

export interface TournamentChallenge {
  id: string;
  title: string;           // p.sh. "Who wins Group A?"
  competition: string;     // p.sh. "FIFA World Cup"
  options: string[];       // lista e opsioneve (emra skuadrash ose rezultatesh)
  status: ChallengeStatus;
  result?: string;         // opsioni fitues, vendoset kur zgjidhet
  pointsReward: number;    // pikët për parashikim të saktë
  deadline: number;        // timestamp — pas kësaj parashikimet mbyllen
  createdBy: string;
  createdAt: number;
}

export interface TournamentPrediction {
  id: string;              // `${userId}_${challengeId}`
  userId: string;
  challengeId: string;
  choice: string;          // një nga options[]
  tournamentPoints?: number; // vendoset pas zgjidhjes
  claimed: boolean;        // true pasi useri ka marrë pikët
  createdAt: number;
}