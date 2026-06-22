import { db, FieldValue } from './admin';
import { fetchUpcomingMatches } from './football-data-client';
import { fetchOddsForCompetition, matchKey, OddsEntry } from './odds-client';
import { generateFallbackOdds } from './fallback-odds';
import { calculatePoints, calculateOverUnderPoints, MatchOdds, OverUnderOdds, MatchResult, PredictionChoice, ExactScoreGuess } from './scoring';

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

  const matches = await fetchUpcomingMatches(footballDataToken);
  const oddsCache = new Map<string, Map<string, OddsEntry>>();
  const justFinished: string[] = [];

  console.log(`Gjetën ${matches.length} ndeshje (sot + nesër).`);

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
      const oddsEntry = oddsCache.get(m.competition.code)?.get(matchKey(m.homeTeam.name, m.awayTeam.name));
      const odds: MatchOdds = oddsEntry ?? generateFallbackOdds();
      const ouOdds: OverUnderOdds | undefined = oddsEntry?.overUnder;

      await matchRef.set({
        competition: m.competition.name,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        ...(m.homeTeam.crest ? { homeCrest: m.homeTeam.crest } : {}),
        ...(m.awayTeam.crest ? { awayCrest: m.awayTeam.crest } : {}),
        ...(m.venue ? { venue: m.venue } : {}),
        kickoff: new Date(m.utcDate).getTime(),
        status: newStatus,
        odds,
        ...(ouOdds ? { ouOdds } : {}),
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
  const competition: string = match['competition'] ?? '';

  // 1. Gradimi GLOBAL — predictions/{userId}_{matchId} → totalPoints, streak, arritje
  const predictionsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();
  for (const predDoc of predictionsSnap.docs) {
    const prediction = predDoc.data() as {
      userId: string;
      choice: PredictionChoice;
      exactScore?: ExactScoreGuess;
      overUnder?: 'over' | 'under';
    };

    const points = calculatePoints(
      prediction.choice,
      prediction.exactScore,
      match['odds'] as MatchOdds,
      match['result'] as MatchResult
    );

    const ouOdds = match['ouOdds'] as OverUnderOdds | undefined;
    const ouPoints = (prediction.overUnder && ouOdds)
      ? calculateOverUnderPoints(prediction.overUnder, ouOdds, match['result'] as MatchResult)
      : 0;

    const totalMatchPoints = points + ouPoints;

    const outcomeCorrect = points > 0;
    const exactScoreCorrect = !!(
      prediction.exactScore &&
      prediction.exactScore.home === (match['result'] as MatchResult).homeGoals &&
      prediction.exactScore.away === (match['result'] as MatchResult).awayGoals
    );

    batch.update(predDoc.ref, {
      points,
      ...(prediction.overUnder !== undefined ? { ouPoints } : {}),
      seen: false,
      competition,
      exactScoreCorrect
    });

    const userRef = db.collection('users').doc(prediction.userId);
    const userIncrement: Record<string, unknown> = {
      totalPoints: FieldValue.increment(totalMatchPoints)
    };
    if (outcomeCorrect) {
      userIncrement['totalCorrect'] = FieldValue.increment(1);
    }
    batch.update(userRef, userIncrement);

    // Merr profilin aktual të userit për streak + arritje (jashtë batch — duhet lexim)
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};
    const currentAchievements: string[] = userData['achievements'] ?? [];
    const totalCorrect: number = (userData['totalCorrect'] ?? 0) + (outcomeCorrect ? 1 : 0);
    const totalPredictions: number = (await db.collection('predictions')
      .where('userId', '==', prediction.userId)
      .where('points', '>=', 0)
      .count()
      .get()).data().count;

    // Streak
    let currentStreak: number = userData['currentStreak'] ?? 0;
    let bestStreak: number = userData['bestStreak'] ?? 0;
    if (outcomeCorrect) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }

    // Arritje të reja
    const newAchievements: string[] = [];
    const has = (id: string) => currentAchievements.includes(id) || newAchievements.includes(id);

    if (outcomeCorrect && !has('first_correct') && totalCorrect === 1) newAchievements.push('first_correct');
    if (exactScoreCorrect && !has('first_exact')) newAchievements.push('first_exact');
    if (currentStreak >= 3 && !has('streak_3')) newAchievements.push('streak_3');
    if (currentStreak >= 5 && !has('streak_5')) newAchievements.push('streak_5');
    if (currentStreak >= 10 && !has('streak_10')) newAchievements.push('streak_10');
    if (totalPredictions >= 10 && !has('predictions_10')) newAchievements.push('predictions_10');
    if (totalPredictions >= 50 && !has('predictions_50')) newAchievements.push('predictions_50');
    if (outcomeCorrect && (match['odds'] as MatchOdds)[prediction.choice === '1' ? 'home' : prediction.choice === 'X' ? 'draw' : 'away'] >= 4 && !has('underdog')) {
      newAchievements.push('underdog');
    }
    if (outcomeCorrect && competition.toLowerCase().includes('world cup') && !has('world_cup')) {
      newAchievements.push('world_cup');
    }

    const streakUpdate: Record<string, unknown> = {
      currentStreak,
      bestStreak
    };
    if (newAchievements.length > 0) {
      streakUpdate['achievements'] = FieldValue.arrayUnion(...newAchievements);
    }
    batch.update(userRef, streakUpdate);

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