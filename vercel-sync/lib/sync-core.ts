import { getDb, FieldValue } from './admin';
import {
  calculatePoints, calculateOverUnderPoints, calculateHtFtPoints,
  calculateBttsPoints, calculateRedCardPoints,
  MatchOdds, OverUnderOdds, MatchResult, PredictionChoice, ExactScoreGuess
} from './scoring';

const COMPETITION_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC', 'EC', 'DED', 'PPL', 'BSA', 'ELC'];

interface ApiMatch {
  id: number;
  status: string;
  utcDate: string;
  homeTeam: { name: string; shortName: string; tla: string; crest: string };
  awayTeam: { name: string; shortName: string; tla: string; crest: string };
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  competition: { name: string; code: string };
  venue?: string;
  odds?: { msg: string };
}

function toStatus(s: string): 'scheduled' | 'live' | 'finished' {
  if (['FINISHED', 'AWARDED'].includes(s)) return 'finished';
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(s)) return 'live';
  return 'scheduled';
}

async function fetchTodayMatches(token: string): Promise<ApiMatch[]> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const url = `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${tomorrow}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const data = await res.json() as { matches: ApiMatch[] };
  return (data.matches ?? []).filter(m =>
    COMPETITION_CODES.includes(m.competition.code)
  );
}

async function gradeMatch(matchId: string, matchData: Record<string, unknown>): Promise<void> {
  const db = getDb();
  const result = matchData['result'] as MatchResult;
  const halfTimeResult = matchData['halfTimeResult'] as MatchResult | undefined;
  const odds = matchData['odds'] as MatchOdds;
  const ouOdds = matchData['ouOdds'] as OverUnderOdds | undefined;
  const hasRedCard = matchData['hasRedCard'] as boolean | null | undefined;
  const competition = (matchData['competition'] as string) ?? '';

  const predictionsSnap = await db.collection('predictions')
    .where('matchId', '==', matchId).get();
  const groupPredictionsSnap = await db.collection('groupPredictions')
    .where('matchId', '==', matchId).get();

  if (predictionsSnap.empty && groupPredictionsSnap.empty) return;

  const batch = db.batch();

  const processDoc = (predDoc: FirebaseFirestore.QueryDocumentSnapshot, isGroup: boolean) => {
    const p = predDoc.data() as {
      userId: string;
      choice: PredictionChoice;
      exactScore?: ExactScoreGuess;
      overUnder?: 'over' | 'under';
      htFt?: string;
      btts?: boolean;
      redCard?: boolean;
    };

    const points = calculatePoints(p.choice, p.exactScore, odds, result);
    const ouPoints = (p.overUnder && ouOdds) ? calculateOverUnderPoints(p.overUnder, ouOdds, result) : 0;
    const htFtPoints = (p.htFt && halfTimeResult) ? calculateHtFtPoints(p.htFt, halfTimeResult, result) : 0;
    const bttsPoints = p.btts !== undefined ? calculateBttsPoints(p.btts, result) : 0;
    const redCardPoints = (p.redCard !== undefined && hasRedCard != null)
      ? calculateRedCardPoints(p.redCard, hasRedCard) : 0;
    const total = points + ouPoints + htFtPoints + bttsPoints + redCardPoints;

    const exactScoreCorrect = !!(p.exactScore &&
      p.exactScore.home === result.homeGoals && p.exactScore.away === result.awayGoals);

    batch.update(predDoc.ref, {
      points, ouPoints, htFtPoints, bttsPoints, redCardPoints,
      seen: false, competition, exactScoreCorrect
    });

    if (!isGroup) {
      const userRef = db.collection('users').doc(p.userId);
      batch.update(userRef, { totalPoints: FieldValue.increment(total) });
    }
  };

  for (const doc of predictionsSnap.docs) processDoc(doc, false);
  for (const doc of groupPredictionsSnap.docs) processDoc(doc, true);

  await batch.commit();
  console.log(`  ✓ Graded match ${matchId}: ${predictionsSnap.size} global + ${groupPredictionsSnap.size} group predictions`);
}

export async function runSync(footballDataToken: string): Promise<{ updated: number; graded: number }> {
  const db = getDb();
  const matches = await fetchTodayMatches(footballDataToken);
  console.log(`Fetched ${matches.length} matches`);

  let updatedCount = 0;
  let gradedCount = 0;
  const justFinished: string[] = [];

  for (const m of matches) {
    const matchId = String(m.id);
    const newStatus = toStatus(m.status);
    const matchRef = db.collection('matches').doc(matchId);
    const existingSnap = await matchRef.get();
    const existing = existingSnap.data() ?? {};
    const prevStatus = (existing['status'] as string) ?? 'scheduled';

    const result: MatchResult | null = (m.score.fullTime.home !== null && m.score.fullTime.away !== null)
      ? { homeGoals: m.score.fullTime.home!, awayGoals: m.score.fullTime.away! }
      : null;
    const halfTimeResult: MatchResult | null = (m.score.halfTime.home !== null && m.score.halfTime.away !== null)
      ? { homeGoals: m.score.halfTime.home!, awayGoals: m.score.halfTime.away! }
      : null;

    const updateData: Record<string, unknown> = {
      id: matchId,
      status: newStatus,
      competition: m.competition.name,
      kickoff: new Date(m.utcDate).getTime(),
      homeTeam: m.homeTeam.shortName ?? m.homeTeam.name,
      awayTeam: m.awayTeam.shortName ?? m.awayTeam.name,
      homeCrest: m.homeTeam.crest,
      awayCrest: m.awayTeam.crest,
      ...(m.venue ? { venue: m.venue } : {}),
      ...(result ? { result } : {}),
      ...(halfTimeResult ? { halfTimeResult } : {}),
    };

    // Preserve odds from existing data
    if (existing['odds']) updateData['odds'] = existing['odds'];
    if (existing['ouOdds']) updateData['ouOdds'] = existing['ouOdds'];

    await matchRef.set(updateData, { merge: true });
    updatedCount++;

    // Grade if just finished
    if (newStatus === 'finished' && prevStatus !== 'finished' && result) {
      justFinished.push(matchId);
    }
  }

  // Grade matches sequentially to avoid overloading
  for (const matchId of justFinished) {
    const snap = await db.collection('matches').doc(matchId).get();
    if (snap.exists) {
      await gradeMatch(matchId, snap.data()!);
      gradedCount++;
    }
  }

  console.log(`Sync done: ${updatedCount} updated, ${gradedCount} graded`);
  return { updated: updatedCount, graded: gradedCount };
}
