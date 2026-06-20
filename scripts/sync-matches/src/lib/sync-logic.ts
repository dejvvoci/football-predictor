import { db, FieldValue } from './admin';
import { fetchTodayMatches } from './football-data-client';
import { fetchOddsForCompetition, matchKey, OddsEntry } from './odds-client';
import { generateFallbackOdds } from './fallback-odds';
import { calculatePoints, MatchOdds, MatchResult, PredictionChoice, ExactScoreGuess } from './scoring';

type MatchStatus = 'scheduled' | 'live' | 'finished';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Mungon env variable ${name}`);
  }
  return value;
}

function mapStatus(fdStatus: string): MatchStatus {
  switch (fdStatus) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
      return 'finished';
    default:
      // SCHEDULED, TIMED, POSTPONED, SUSPENDED, CANCELLED — mbeten "scheduled" si rast i thjeshtuar
      return 'scheduled';
  }
}

export async function syncMatchesAndGrade(): Promise<void> {
  const footballDataToken = requireEnv('FOOTBALL_DATA_TOKEN');
  const oddsApiKey = requireEnv('ODDS_API_KEY');

  const matches = await fetchTodayMatches(footballDataToken);
  const oddsCache = new Map<string, Map<string, OddsEntry>>();
  const justFinished: string[] = [];

  console.log(`Gjetën ${matches.length} ndeshje sot.`);

  for (const m of matches) {
    const docId = String(m.id);
    const matchRef = db.collection('matches').doc(docId);
    const existing = await matchRef.get();
    const newStatus = mapStatus(m.status);

    const hasResult = m.score?.fullTime?.home !== null && m.score?.fullTime?.away !== null;
    const result: MatchResult | undefined = hasResult
      ? { homeGoals: m.score.fullTime.home as number, awayGoals: m.score.fullTime.away as number }
      : undefined;

    if (!existing.exists) {
      if (!oddsCache.has(m.competition.code)) {
        oddsCache.set(m.competition.code, await fetchOddsForCompetition(oddsApiKey, m.competition.code));
      }
      const odds: MatchOdds =
        oddsCache.get(m.competition.code)?.get(matchKey(m.homeTeam.name, m.awayTeam.name)) ??
        generateFallbackOdds();

      await matchRef.set({
        competition: m.competition.name,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        kickoff: new Date(m.utcDate).getTime(),
        status: newStatus,
        odds,
        ...(result ? { result } : {})
      });

      console.log(`+ Ndeshje e re: ${m.homeTeam.name} vs ${m.awayTeam.name}`);
    } else {
      const prevStatus = existing.data()?.['status'] as MatchStatus | undefined;

      await matchRef.set({ status: newStatus, ...(result ? { result } : {}) }, { merge: true });

      if (prevStatus !== 'finished' && newStatus === 'finished') {
        justFinished.push(docId);
      }
    }
  }

  for (const matchId of justFinished) {
    console.log(`Gradim: ndeshja ${matchId} sapo mbaroi.`);
    await gradeMatch(matchId);
  }
}

async function gradeMatch(matchId: string): Promise<void> {
  const matchSnap = await db.collection('matches').doc(matchId).get();
  const match = matchSnap.data();
  if (!match || !match['result']) return;

  const batch = db.batch();
  let gradedCount = 0;

  // 1. Gradimi GLOBAL — predictions/{userId}_{matchId} → totalPoints i userit
  const predictionsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();
  for (const doc of predictionsSnap.docs) {
    const prediction = doc.data() as {
      userId: string;
      choice: PredictionChoice;
      exactScore?: ExactScoreGuess;
    };

    const points = calculatePoints(
      prediction.choice,
      prediction.exactScore,
      match['odds'] as MatchOdds,
      match['result'] as MatchResult
    );

    batch.update(doc.ref, { points });
    batch.update(db.collection('users').doc(prediction.userId), {
      totalPoints: FieldValue.increment(points)
    });
    gradedCount++;
  }

  // 2. Gradimi PËR GRUP — groupPredictions/{groupId}_{userId}_{matchId} → groupScores (i pavarur nga gradimi global)
  const groupPredictionsSnap = await db.collection('groupPredictions').where('matchId', '==', matchId).get();
  for (const doc of groupPredictionsSnap.docs) {
    const groupPrediction = doc.data() as {
      groupId: string;
      userId: string;
      choice: PredictionChoice;
      exactScore?: ExactScoreGuess;
    };

    const points = calculatePoints(
      groupPrediction.choice,
      groupPrediction.exactScore,
      match['odds'] as MatchOdds,
      match['result'] as MatchResult
    );

    batch.update(doc.ref, { points });

    const userSnap = await db.collection('users').doc(groupPrediction.userId).get();
    const scoreRef = db.collection('groupScores').doc(`${groupPrediction.groupId}_${groupPrediction.userId}`);
    batch.set(
      scoreRef,
      {
        groupId: groupPrediction.groupId,
        userId: groupPrediction.userId,
        displayName: userSnap.data()?.['displayName'] ?? '',
        points: FieldValue.increment(points)
      },
      { merge: true }
    );
    gradedCount++;
  }

  if (gradedCount === 0) return;

  await batch.commit();
  console.log(
    `  → ${predictionsSnap.size} parashikime globale + ${groupPredictionsSnap.size} parashikime grupesh u graduan.`
  );
}