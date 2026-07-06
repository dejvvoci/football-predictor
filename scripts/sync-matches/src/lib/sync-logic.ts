import { db, FieldValue } from './admin';
import { fetchUpcomingMatches, fetchMatchDetails } from './football-data-client';
import { fetchOddsForCompetition, matchKey, OddsEntry } from './odds-client';
import { generateFallbackOdds } from './fallback-odds';
import { calculatePoints, calculateOverUnderPoints, calculateHtFtPoints, calculateBttsPoints, calculateRedCardPoints, calculateFirstGoalscorerPoints, MatchOdds, OverUnderOdds, MatchResult, PredictionChoice, ExactScoreGuess } from './scoring';
import { computeNewAchievements, UserProgress } from './achievement';
import { pickPlayerForDate, FAMOUS_PLAYERS } from './player-list';

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

    const hasHalfTime = m.score?.halfTime?.home !== null && m.score?.halfTime?.away !== null;
    const halfTimeResult: MatchResult | undefined = hasHalfTime
      ? { homeGoals: m.score.halfTime.home as number, awayGoals: m.score.halfTime.away as number }
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
        ...(result ? { result } : {}),
        ...(halfTimeResult ? { halfTimeResult } : {}),
        ...(m.stage ? { stage: m.stage } : {})
      });

      console.log(`+ Ndeshje e re: ${m.homeTeam.name} vs ${m.awayTeam.name}`);
    } else {
      const prevStatus = existing.data()?.['status'] as MatchStatus | undefined;

      await matchRef.set({
        status: newStatus,
        ...(result ? { result } : {}),
        ...(halfTimeResult ? { halfTimeResult } : {}),
        ...(m.stage ? { stage: m.stage } : {})
      }, { merge: true });

      if (prevStatus !== 'finished' && newStatus === 'finished') {
        justFinished.push(docId);
      }
    }
  }

  for (const matchId of justFinished) {
    console.log(`Grading match ${matchId}...`);
    await gradeMatch(matchId, footballDataToken);
  }

  // Check perfect day bonus for each unique UTC date that had matches finish
  if (justFinished.length > 0) {
    const finishedDates = new Set<string>();
    for (const matchId of justFinished) {
      const snap = await db.collection('matches').doc(matchId).get();
      const kickoff = snap.data()?.['kickoff'] as number | undefined;
      if (kickoff) {
        const dateStr = new Date(kickoff).toISOString().slice(0, 10); // YYYY-MM-DD
        finishedDates.add(dateStr);
      }
    }
    for (const dateStr of finishedDates) {
      await checkPerfectDayBonus(dateStr);
    }
  }

  await autoCreateChallenges(matches);
  await setDailyChallenge();
  if (footballDataToken) await setClubBadgeChallenge(footballDataToken);
  await setFlashbackChallenge();
  if (footballDataToken) await setTopScorerChallenge(footballDataToken);
  if (footballDataToken) await syncTablePredictions(footballDataToken);
}

const PERFECT_DAY_BONUS = 10;

async function checkPerfectDayBonus(dateStr: string): Promise<void> {
  const dayStart = new Date(dateStr + 'T00:00:00Z').getTime();
  const dayEnd   = dayStart + 24 * 60 * 60 * 1000;

  // Get all matches for this UTC day
  const matchesSnap = await db.collection('matches')
    .where('kickoff', '>=', dayStart)
    .where('kickoff', '<', dayEnd)
    .get();

  if (matchesSnap.empty) return;

  // Only proceed if ALL matches for the day are finished
  const allFinished = matchesSnap.docs.every((d) => d.data()['status'] === 'finished');
  if (!allFinished) return;

  const allMatchIds = matchesSnap.docs.map((d) => d.id);

  // Collect per-user prediction results for this day
  const userResults = new Map<string, { correct: number; total: number }>();

  for (const matchId of allMatchIds) {
    const predsSnap = await db.collection('predictions')
      .where('matchId', '==', matchId)
      .where('points', '>=', 0)
      .get();

    for (const predDoc of predsSnap.docs) {
      const pred = predDoc.data();
      const userId = pred['userId'] as string;
      const pts    = (pred['points'] as number) ?? 0;
      const entry  = userResults.get(userId) ?? { correct: 0, total: 0 };
      entry.total++;
      if (pts > 0) entry.correct++;
      userResults.set(userId, entry);
    }
  }

  // Award bonus to users who predicted ALL matches of the day correctly
  for (const [userId, { correct, total }] of userResults.entries()) {
    if (total !== allMatchIds.length || correct !== allMatchIds.length) continue;

    const bonusRef = db.collection('perfectDayBonuses').doc(`${userId}_${dateStr}`);
    const existing = await bonusRef.get();
    if (existing.exists) continue; // already awarded

    await bonusRef.set({ userId, date: dateStr, points: PERFECT_DAY_BONUS, awardedAt: Date.now() });
    await db.collection('users').doc(userId).update({
      totalPoints: FieldValue.increment(PERFECT_DAY_BONUS)
    });
    console.log(`⭐ Perfect day bonus +${PERFECT_DAY_BONUS} pts → ${userId} (${dateStr})`);
  }
}

const KNOCKOUT_STAGES: Record<string, string> = {
  ROUND_OF_16:    'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS:    'Semi-finals',
  FINAL:          'Final',
};

async function autoCreateChallenges(matches: Awaited<ReturnType<typeof fetchUpcomingMatches>>): Promise<void> {
  // ── 1. GROUP_STAGE: "Who tops Group X?" ──
  const groupTeams = new Map<string, { teams: Set<string>; competition: string; latestKickoff: number }>();

  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE' || !m.group) continue;
    if (!m.homeTeam.name || !m.awayTeam.name) continue;

    const key = `auto_${m.competition.code}_${m.group.replace(/\s+/g, '_')}`;
    const entry = groupTeams.get(key) ?? { teams: new Set<string>(), competition: m.competition.name, latestKickoff: 0 };
    entry.teams.add(m.homeTeam.name);
    entry.teams.add(m.awayTeam.name);
    const kickoff = new Date(m.utcDate).getTime();
    if (kickoff > entry.latestKickoff) entry.latestKickoff = kickoff;
    groupTeams.set(key, entry);
  }

  for (const [key, { teams, competition, latestKickoff }] of groupTeams.entries()) {
    const ref = db.collection('tournamentChallenges').doc(key);
    const existing = await ref.get();
    if (existing.exists) continue;

    const groupLabel = key.split('_').slice(2).join(' ');
    await ref.set({
      title: `Who tops ${groupLabel}?`,
      competition,
      options: [...teams],
      status: 'open',
      pointsReward: 10,
      deadline: latestKickoff,
      createdBy: 'auto',
      createdAt: Date.now()
    });
    console.log(`+ Sfidë automatike: Who tops ${groupLabel}?`);
  }

  // ── 2. KNOCKOUT: "Who advances: Team A vs Team B?" ──
  for (const m of matches) {
    if (!KNOCKOUT_STAGES[m.stage]) continue;
    if (!m.homeTeam.name || !m.awayTeam.name) continue;

    const key = `auto_${m.competition.code}_${m.stage}_${m.id}`;
    const ref = db.collection('tournamentChallenges').doc(key);
    const existing = await ref.get();
    if (existing.exists) continue;

    const stageLabel = KNOCKOUT_STAGES[m.stage];
    const kickoff = new Date(m.utcDate).getTime();
    await ref.set({
      title: `${stageLabel}: ${m.homeTeam.name} vs ${m.awayTeam.name}`,
      competition: m.competition.name,
      options: [m.homeTeam.name, m.awayTeam.name],
      status: 'open',
      pointsReward: m.stage === 'FINAL' ? 25 : m.stage === 'SEMI_FINALS' ? 15 : 10,
      deadline: kickoff - 30 * 60 * 1000, // 30 min para fillimit
      createdBy: 'auto',
      createdAt: Date.now()
    });
    console.log(`+ Sfidë automatike: ${stageLabel}: ${m.homeTeam.name} vs ${m.awayTeam.name}`);
  }
}

async function gradeMatch(matchId: string, footballDataToken?: string): Promise<void> {
  const matchSnap = await db.collection('matches').doc(matchId).get();
  const match = matchSnap.data();
  if (!match || !match['result']) return;

  // Fetch match details: red card + first goalscorer (1 extra API call)
  let hasRedCard: boolean | null = null;
  let firstGoalscorer: string | null = null;
  if (footballDataToken) {
    const details = await fetchMatchDetails(parseInt(matchId), footballDataToken);
    hasRedCard = details.hasRedCard;
    firstGoalscorer = details.firstGoalscorer;
    const updates: Record<string, unknown> = {};
    if (hasRedCard !== null) updates['hasRedCard'] = hasRedCard;
    if (firstGoalscorer) updates['firstGoalscorer'] = firstGoalscorer;
    if (Object.keys(updates).length > 0) {
      await db.collection('matches').doc(matchId).update(updates);
    }
  }

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
      htFt?: string;
      btts?: boolean;
      redCard?: boolean;
      firstGoalscorer?: string;
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

    const halfTimeResult = match['halfTimeResult'] as MatchResult | undefined;
    const htFtPoints = (prediction.htFt && halfTimeResult)
      ? calculateHtFtPoints(prediction.htFt, halfTimeResult, match['result'] as MatchResult)
      : 0;

    const bttsPoints = prediction.btts !== undefined
      ? calculateBttsPoints(prediction.btts, match['result'] as MatchResult)
      : 0;

    const redCardPoints = (prediction.redCard !== undefined && hasRedCard !== null)
      ? calculateRedCardPoints(prediction.redCard, hasRedCard)
      : 0;

    const firstGoalscorerPoints = (prediction.firstGoalscorer && firstGoalscorer)
      ? calculateFirstGoalscorerPoints(prediction.firstGoalscorer, firstGoalscorer)
      : 0;

    const totalMatchPoints = points + ouPoints + htFtPoints + bttsPoints + redCardPoints + firstGoalscorerPoints;

    const outcomeCorrect = points > 0;
    const exactScoreCorrect = !!(
      prediction.exactScore &&
      prediction.exactScore.home === (match['result'] as MatchResult).homeGoals &&
      prediction.exactScore.away === (match['result'] as MatchResult).awayGoals
    );

    batch.update(predDoc.ref, {
      points,
      ...(prediction.overUnder !== undefined ? { ouPoints } : {}),
      ...(prediction.htFt !== undefined ? { htFtPoints } : {}),
      ...(prediction.btts !== undefined ? { bttsPoints } : {}),
      ...(prediction.redCard !== undefined && hasRedCard !== null ? { redCardPoints } : {}),
      ...(prediction.firstGoalscorer && firstGoalscorer ? { firstGoalscorerPoints } : {}),
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

/** Sets the player of the day. Runs every sync cycle but only creates if not already set for today. */
async function setDailyChallenge(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const docRef = db.collection('dailyChallenges').doc(today);
  const existing = await docRef.get();
  if (existing.exists) return;

  const fallback = pickPlayerForDate(today);

  // Try TheSportsDB first
  let player: Record<string, unknown> | null = null;
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(fallback.name)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { players?: Record<string, string>[] };
      const p = data.players?.[0];
      if (p) {
        const birthYear = p['dateBorn'] ? new Date(p['dateBorn']).getFullYear() : fallback.birthYear;
        player = {
          id: p['idPlayer'] ?? `api_${today}`,
          name: p['strPlayer'] ?? fallback.name,
          nationality: p['strNationality'] ?? fallback.nationality,
          nationalityEmoji: fallback.nationalityEmoji,
          position: p['strPosition'] ?? fallback.position,
          club: p['strTeam'] ?? fallback.club,
          birthYear,
          thumbnail: p['strThumb'] ?? null,
          source: 'api'
        };
      }
    }
  } catch {
    console.warn('TheSportsDB unavailable — using fallback player data.');
  }

  // Fallback if API failed or thumbnail is empty
  if (!player) {
    player = { ...fallback, id: `fallback_${today}`, thumbnail: null, source: 'fallback' };
  }

  // If still no thumbnail, try Wikipedia using the known article title
  if (!player['thumbnail']) {
    try {
      const wikiTitle = fallback.wikiTitle;
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json`;
      console.log(`  🔍 Fetching Wikipedia: ${wikiUrl}`);
      const wikiRes = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'FootballPredictor/1.0 (sync-script)' }
      });
      console.log(`  🌐 Wikipedia status: ${wikiRes.status}`);
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json() as { query?: { pages?: Record<string, unknown> } };
        const pages = wikiData.query?.pages ?? {};
        const pageKeys = Object.keys(pages);
        console.log(`  📄 Wikipedia pages: ${JSON.stringify(pageKeys)}`);
        const page = pages[pageKeys[0]] as Record<string, unknown> | undefined;
        console.log(`  📄 Wikipedia page data: ${JSON.stringify(page)}`);
        const thumb = (page?.['thumbnail'] as { source?: string } | undefined)?.source;
        if (thumb) {
          player['thumbnail'] = thumb;
          console.log(`  📸 Thumbnail: ${thumb.slice(0, 80)}`);
        } else {
          console.warn(`  ⚠️ No thumbnail in Wikipedia response for "${wikiTitle}"`);
        }
      }
    } catch (e) {
      console.warn('  ❌ Wikipedia fetch failed:', e);
    }
  }

  await docRef.set({ date: today, player, createdAt: Date.now() });
  console.log(`⭐ Daily challenge set: ${player['name']} (${player['source']})`);
}

const BADGE_COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1'];

async function setClubBadgeChallenge(footballDataToken: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const docRef = db.collection('challenges').doc(`${today}_badge`);
  if ((await docRef.get()).exists) return;

  const seed = parseInt(today.replace(/-/g, ''), 10);
  const comp = BADGE_COMPETITIONS[seed % BADGE_COMPETITIONS.length];

  try {
    await new Promise(r => setTimeout(r, 7000)); // rate limit buffer
    const res = await fetch(`https://api.football-data.org/v4/competitions/${comp}/teams`, {
      headers: { 'X-Auth-Token': footballDataToken }
    });
    if (!res.ok) { console.warn(`Badge challenge: could not fetch teams for ${comp}`); return; }
    const data = await res.json() as { teams?: Record<string, unknown>[] };
    const teams = data.teams ?? [];
    if (teams.length === 0) return;

    const team = teams[seed % teams.length] as Record<string, unknown>;
    const countryMap: Record<string, string> = {
      PL: 'England', PD: 'Spain', BL1: 'Germany', SA: 'Italy', FL1: 'France'
    };

    await docRef.set({
      type: 'badge',
      date: today,
      data: {
        teamId: team['id'],
        teamName: (team['shortName'] as string) ?? (team['name'] as string),
        crest: team['crest'],
        competition: comp,
        country: countryMap[comp] ?? comp,
        founded: (team['founded'] as number) ?? null,
        venue: (team['venue'] as string) ?? null,
      },
      createdAt: Date.now()
    });
    console.log(`🛡️ Badge challenge set: ${team['shortName'] ?? team['name']} (${comp})`);
  } catch (e) {
    console.warn('Badge challenge failed:', e);
  }
}



// ── SCORE FLASHBACK ──────────────────────────────────────────────────────────

async function setFlashbackChallenge(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const docRef = db.collection('challenges').doc(`${today}_flashback`);
  if ((await docRef.get()).exists) return;

  const seed = parseInt(today.replace(/-/g, ''), 10);
  // TODO: rikthe në 7 ditë ("sevenDaysAgo") pasi DB të ketë mjaftueshëm histori ndeshjesh të mbyllura.
  const minAgeDays = 1;
  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;

  try {
    // Use our own Firestore matches — no API call needed, no rate limit
    const matchesSnap = await db.collection('matches')
      .where('status', '==', 'finished')
      .where('kickoff', '<', cutoff)
      .limit(200)
      .get();

    if (matchesSnap.empty) {
      console.warn(`Flashback: no finished matches older than ${minAgeDays} day(s) found in Firestore`);
      return;
    }

    const candidates = matchesSnap.docs
      .map(d => d.data() as Record<string, unknown>)
      .filter(m => {
        const result = m['result'] as { homeGoals: number; awayGoals: number } | undefined;
        return result && typeof result.homeGoals === 'number';
      });

    if (candidates.length === 0) return;

    const match = candidates[seed % candidates.length];
    const result = match['result'] as { homeGoals: number; awayGoals: number };
    const htResult = match['halfTimeResult'] as { homeGoals: number; awayGoals: number } | undefined;

    await docRef.set({
      type: 'flashback',
      date: today,
      data: {
        homeTeam: match['homeTeam'],
        awayTeam: match['awayTeam'],
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        htHomeGoals: htResult?.homeGoals ?? null,
        htAwayGoals: htResult?.awayGoals ?? null,
        competition: match['competition'] ?? '',
        season: today.slice(0, 4),
        stage: `Matchday`,
        matchDate: new Date(match['kickoff'] as number).toISOString().slice(0, 10),
      },
      createdAt: Date.now()
    });
    console.log(`⚡ Flashback set: ${match['homeTeam']} vs ${match['awayTeam']} (${match['competition']})`);
  } catch (e) {
    console.warn('Flashback challenge failed:', e);
  }
}

// ── TOP SCORER ───────────────────────────────────────────────────────────────
const SCORER_COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1'];
const SCORER_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023];

async function setTopScorerChallenge(token: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const docRef = db.collection('challenges').doc(`${today}_topscorer`);
  if ((await docRef.get()).exists) return;

  const seed = parseInt(today.replace(/-/g, ''), 10) + 3;
  const comp = SCORER_COMPETITIONS[seed % SCORER_COMPETITIONS.length];

  // Try current season first (always available on free tier), then previous season
  const currentYear = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const seasonsToTry = [currentYear, currentYear - 1, currentYear - 2];

  const compNames: Record<string, string> = {
    PL: 'Premier League', PD: 'La Liga', BL1: 'Bundesliga', SA: 'Serie A', FL1: 'Ligue 1'
  };

  for (const season of seasonsToTry) {
    try {
      await new Promise(r => setTimeout(r, 7000)); // generous delay
      const res = await fetch(
        `https://api.football-data.org/v4/competitions/${comp}/scorers?season=${season}&limit=1`,
        { headers: { 'X-Auth-Token': token } }
      );

      if (!res.ok) {
        console.warn(`Top scorer: ${comp} ${season} returned ${res.status}, trying next season`);
        continue;
      }

      const data = await res.json() as { scorers?: Record<string, unknown>[] };
      const top = data.scorers?.[0];
      if (!top || !(top['goals'] as number)) continue;

      const player = top['player'] as Record<string, string>;
      const team   = top['team']   as Record<string, string>;

      await docRef.set({
        type: 'topscorer',
        date: today,
        data: {
          playerName: player['name'],
          team: team['shortName'] ?? team['name'],
          nationality: player['nationality'] ?? null,
          goals: top['goals'] as number,
          competition: compNames[comp] ?? comp,
          competitionCode: comp,
          season,
        },
        createdAt: Date.now()
      });
      console.log(`⚽ Top scorer set: ${player['name']} (${comp} ${season}, ${top['goals']} goals)`);
      return; // success
    } catch (e) {
      console.warn(`Top scorer attempt failed for ${comp} ${season}:`, e);
    }
  }
  console.warn(`Top scorer: could not set for any season of ${comp}`);
}

// ── PREDICT THE TABLE ────────────────────────────────────────────────────────
const TABLE_COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1'];
const TABLE_COMP_NAMES: Record<string, string> = {
  PL: 'Premier League', PD: 'La Liga', BL1: 'Bundesliga', SA: 'Serie A', FL1: 'Ligue 1'
};

export async function syncTablePredictions(token: string): Promise<void> {
  const currentSeason = new Date().getMonth() >= 6
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;

  for (const code of TABLE_COMPETITIONS) {
    await new Promise(r => setTimeout(r, 6500)); // rate limit

    const seasonDocRef = db.collection('tableSeasons').doc(`${code}_${currentSeason}`);
    const seasonSnap = await seasonDocRef.get();

    // ── 1. Init season if it doesn't exist yet ──────────────────────────────
    if (!seasonSnap.exists) {
      try {
        const teamsRes = await fetch(
          `https://api.football-data.org/v4/competitions/${code}/teams?season=${currentSeason}`,
          { headers: { 'X-Auth-Token': token } }
        );
        if (!teamsRes.ok) continue;
        const teamsData = await teamsRes.json() as { teams?: Record<string, unknown>[] };
        const teams = (teamsData.teams ?? []).map((t) => ({
          id: t['id'],
          name: t['name'],
          shortName: t['shortName'] ?? (t['name'] as string).split(' ')[0],
          crest: t['crest']
        }));
        if (teams.length === 0) continue;

        // Deadline: 1 week from now (admin can adjust)
        const deadline = Date.now() + 7 * 24 * 60 * 60 * 1000;
        await seasonDocRef.set({
          competition: TABLE_COMP_NAMES[code] ?? code,
          code, season: currentSeason, teams,
          deadline, currentStandings: [], active: true,
          lastUpdated: Date.now()
        });
        console.log(`📊 Table season created: ${code} ${currentSeason} (${teams.length} teams)`);
      } catch (e) {
        console.warn(`Table init failed for ${code}:`, e);
      }
      continue;
    }

    // ── 2. Update standings ────────────────────────────────────────────────
    try {
      await new Promise(r => setTimeout(r, 6500));
      const standRes = await fetch(
        `https://api.football-data.org/v4/competitions/${code}/standings?season=${currentSeason}`,
        { headers: { 'X-Auth-Token': token } }
      );
      if (!standRes.ok) continue;
      const standData = await standRes.json() as { standings?: { type: string; table: Record<string, unknown>[] }[] };
      const table = standData.standings?.find(s => s.type === 'TOTAL')?.table ?? [];
      if (table.length === 0) continue;

      const currentStandings = table.map((row) => {
        const team = row['team'] as Record<string, string>;
        return {
          position: row['position'] as number,
          teamId: team['id'],
          teamName: team['name'],
          teamShortName: team['shortName'] ?? (team['name'] as string).split(' ')[0],
          points: row['points'] as number,
          playedGames: row['playedGames'] as number,
          won: row['won'] as number,
          draw: row['draw'] as number,
          lost: row['lost'] as number,
          goalsFor: row['goalsFor'] as number,
          goalsAgainst: row['goalsAgainst'] as number,
        };
      });

      await seasonDocRef.update({ currentStandings, lastUpdated: Date.now() });

      // ── 3. Compute scores for all predictions ────────────────────────────
      const predsSnap = await db.collection('tablePredictions')
        .where('code', '==', code)
        .where('season', '==', currentSeason)
        .get();

      const scoreBatch = db.batch();
      for (const predDoc of predsSnap.docs) {
        const pred = predDoc.data();
        const prediction = pred['prediction'] as string[];
        let score = 0;
        currentStandings.forEach((entry, actualIndex) => {
          const predictedIndex = prediction.findIndex(
            n => n.toLowerCase() === entry.teamShortName.toLowerCase()
          );
          if (predictedIndex >= 0) {
            score += Math.max(0, 10 - Math.abs(predictedIndex - actualIndex));
          }
        });
        scoreBatch.update(predDoc.ref, { score, computedAt: Date.now() });
      }
      if (!predsSnap.empty) await scoreBatch.commit();
      console.log(`📊 Standings updated: ${code} ${currentSeason} (${predsSnap.size} predictions scored)`);
    } catch (e) {
      console.warn(`Standings update failed for ${code}:`, e);
    }
  }
}