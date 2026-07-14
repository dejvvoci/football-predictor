import { db, FieldValue } from './admin';
import { fetchUpcomingMatches, fetchMatchDetails, FootballDataMatch } from './football-data-client';
import { fetchOddsForCompetition, matchKey, OddsEntry } from './odds-client';
import { generateFallbackOdds } from './fallback-odds';
import { calculatePoints, calculateOverUnderPoints, calculateHtFtPoints, calculateBttsPoints, calculateRedCardPoints, calculateFirstGoalscorerPoints, MatchOdds, OverUnderOdds, MatchResult, PredictionChoice, ExactScoreGuess } from './scoring';
import { computeNewAchievements, UserProgress } from './achievement';
import { pickPlayerForDate, FAMOUS_PLAYERS } from './player-list';

type MatchStatus = 'scheduled' | 'live' | 'finished';

/** Fituesi i penallive — vetëm kur ndeshja u vendos në 'PENALTY_SHOOTOUT' pas barazimit në kohën e rregullt */
export function computePenaltyWinner(m: Pick<FootballDataMatch, 'score'>): 'home' | 'away' | undefined {
  if (m.score?.duration !== 'PENALTY_SHOOTOUT') return undefined;
  if (m.score.winner === 'HOME_TEAM') return 'home';
  if (m.score.winner === 'AWAY_TEAM') return 'away';
  return undefined;
}

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

    const penaltyWinner = computePenaltyWinner(m);

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
        ...(m.stage ? { stage: m.stage } : {}),
        ...(penaltyWinner ? { penaltyWinner } : {})
      });

      console.log(`+ Ndeshje e re: ${m.homeTeam.name} vs ${m.awayTeam.name}`);
    } else {
      const prevStatus = existing.data()?.['status'] as MatchStatus | undefined;

      await matchRef.set({
        status: newStatus,
        ...(result ? { result } : {}),
        ...(halfTimeResult ? { halfTimeResult } : {}),
        ...(m.stage ? { stage: m.stage } : {}),
        ...(penaltyWinner ? { penaltyWinner } : {})
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

  await runSafely('autoResolveKnockoutChallenges', () => autoResolveKnockoutChallenges(justFinished));

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
      await runSafely('checkPerfectDayBonus', () => checkPerfectDayBonus(dateStr));
    }
  }

  // Çdo hap më poshtë është i pavarur — një dështim (p.sh. index i munguar) nuk duhet
  // të bllokojë hapat e mëtejshëm (badge/flashback/topscorer/etj janë veçmas nga njëra-tjetra).
  await runSafely('autoCreateChallenges', () => autoCreateChallenges(matches));
  await runSafely('autoCreateBrackets', () => autoCreateBrackets());
  await runSafely('autoGradeBracketRounds', () => autoGradeBracketRounds());
  await runSafely('setDailyChallenge', () => setDailyChallenge());
  if (footballDataToken) await runSafely('setClubBadgeChallenge', () => setClubBadgeChallenge(footballDataToken));
  if (footballDataToken) await runSafely('seedHistoricMatches', () => seedHistoricMatches(footballDataToken));
  await runSafely('setFlashbackChallenge', () => setFlashbackChallenge());
  if (footballDataToken) await runSafely('setTopScorerChallenge', () => setTopScorerChallenge(footballDataToken));
  if (footballDataToken) await runSafely('syncTablePredictions', () => syncTablePredictions(footballDataToken));
}

async function runSafely(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn(`${label} dështoi (u anashkalua, sync-i vazhdon):`, e);
  }
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
  LAST_16:        'Round of 16',
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
      matchId: String(m.id),
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

// ── BRACKET-ET (fazë me eliminim direkt) ──────────────────────────────────────
const BRACKET_STARTING_ROUND = 'LAST_16';
const BRACKET_ROUNDS_FROM_LAST_16 = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];
const DEFAULT_BRACKET_POINTS: Record<string, number> = {
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 5,
  FINAL: 8
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Krijon automatikisht bracket-in për një kompeticion pasi rrethi i parë (Round of 16)
 * është plotësisht i njohur në 'matches' (numër ndeshjesh = fuqi e 2-shit). Idempotent —
 * kontrollon 'brackets/auto_{competition}_LAST_16' para se të krijojë.
 */
async function autoCreateBrackets(): Promise<void> {
  const snap = await db.collection('matches')
    .where('stage', '==', BRACKET_STARTING_ROUND)
    .get();

  if (snap.empty) return;

  const byCompetition = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const d of snap.docs) {
    const competition = d.data()['competition'] as string | undefined;
    if (!competition) continue;
    const list = byCompetition.get(competition) ?? [];
    list.push(d);
    byCompetition.set(competition, list);
  }

  for (const [competition, docs] of byCompetition.entries()) {
    const count = docs.length;
    const isPowerOfTwo = count >= 2 && (count & (count - 1)) === 0;
    if (!isPowerOfTwo) continue; // pritet ende ndonjë ndeshje ose numri s'përshtatet me bracket

    const key = `auto_${slugify(competition)}_${BRACKET_STARTING_ROUND}`;
    const ref = db.collection('brackets').doc(key);
    if ((await ref.get()).exists) continue;

    const sorted: Record<string, unknown>[] = docs
      .map((d): Record<string, unknown> => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .sort((a, b) => (a['kickoff'] as number) - (b['kickoff'] as number));

    const roundsCount = Math.log2(count) + 1; // p.sh. 8 ndeshje → 4 rrethe (LAST_16..FINAL)
    const rounds = BRACKET_ROUNDS_FROM_LAST_16.slice(0, roundsCount);

    const matchups = sorted.map((d, i) => ({
      id: `${BRACKET_STARTING_ROUND}_${i}`,
      round: BRACKET_STARTING_ROUND,
      slotIndex: i,
      home: { name: d['homeTeam'], ...(d['homeCrest'] ? { crest: d['homeCrest'] } : {}) },
      away: { name: d['awayTeam'], ...(d['awayCrest'] ? { crest: d['awayCrest'] } : {}) }
    }));

    const deadline = Math.min(...sorted.map((d) => d['kickoff'] as number));

    await ref.set({
      title: `${competition} — Bracket`,
      competition,
      rounds,
      pointsPerRound: Object.fromEntries(rounds.map((r) => [r, DEFAULT_BRACKET_POINTS[r]])),
      matchups,
      deadline,
      status: 'open',
      resolvedRounds: [],
      createdBy: 'auto',
      createdAt: Date.now()
    });
    console.log(`+ Bracket automatik: ${competition} — Bracket (${count} ndeshje te ${BRACKET_STARTING_ROUND})`);
  }
}

/**
 * Fituesi vendimtar i një ndeshjeje eliminatore — rezultati i rregullt, ose nëse ka barazim,
 * fituesi i penallive (fusha 'penaltyWinner' e ruajtur nga sync-i). Kthen undefined nëse
 * ende s'ka rezultat, ose barazoi por s'ka të dhëna penallish (rast i paprekshëm automatikisht).
 */
export function decisiveWinner(match: Record<string, unknown> | undefined): string | undefined {
  const result = match?.['result'] as { homeGoals: number; awayGoals: number } | undefined;
  if (!result) return undefined;

  if (result.homeGoals !== result.awayGoals) {
    return result.homeGoals > result.awayGoals ? (match?.['homeTeam'] as string) : (match?.['awayTeam'] as string);
  }

  const penaltyWinner = match?.['penaltyWinner'] as 'home' | 'away' | undefined;
  if (!penaltyWinner) return undefined; // barazim pa të dhëna penallish — s'gradohet automatikisht

  return penaltyWinner === 'home' ? (match?.['homeTeam'] as string) : (match?.['awayTeam'] as string);
}

/** ADMIN → AUTOMATIK: zgjidh sfidat knockout "Who advances: X vs Y?" sapo ndeshja reale mbaron */
async function autoResolveKnockoutChallenges(justFinished: string[]): Promise<void> {
  for (const matchId of justFinished) {
    const challengesSnap = await db.collection('tournamentChallenges')
      .where('matchId', '==', matchId)
      .where('status', '==', 'open')
      .get();
    if (challengesSnap.empty) continue;

    const matchSnap = await db.collection('matches').doc(matchId).get();
    const match = matchSnap.data();
    const winner = decisiveWinner(match);
    if (!winner) continue;

    for (const challengeDoc of challengesSnap.docs) {
      const challenge = challengeDoc.data() as { pointsReward: number };
      await challengeDoc.ref.update({ status: 'resolved', result: winner });

      const predictionsSnap = await db.collection('tournamentPredictions')
        .where('challengeId', '==', challengeDoc.id)
        .get();
      const batch = db.batch();
      for (const predDoc of predictionsSnap.docs) {
        const pred = predDoc.data() as { choice: string };
        batch.update(predDoc.ref, { tournamentPoints: pred.choice === winner ? challenge.pointsReward : 0 });
      }
      await batch.commit();
      console.log(`+ Sfidë e zgjidhur automatikisht: ${challengeDoc.id} → ${winner}`);
    }
  }
}

interface ServerBracketTeam {
  name: string;
  crest?: string;
}

interface ServerBracketMatchup {
  id: string;
  round: string;
  slotIndex: number;
  home: ServerBracketTeam;
  away: ServerBracketTeam;
}

function bracketPairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** Mirror i bracket-utils.ts (Angular) — propagon fituesit rreth pas rrethi, pastron picks "fantazmë" */
function buildServerBracketRounds(
  bracket: { matchups: ServerBracketMatchup[]; rounds: string[] },
  rawPicks: Record<string, string>
): ServerBracketMatchup[][] {
  const teamsByName = new Map<string, ServerBracketTeam>();
  for (const m of bracket.matchups) {
    teamsByName.set(m.home.name, m.home);
    teamsByName.set(m.away.name, m.away);
  }

  const cleanedPicks: Record<string, string> = {};
  const rounds: ServerBracketMatchup[][] = [];
  let current = [...bracket.matchups].sort((a, b) => a.slotIndex - b.slotIndex);
  rounds.push(current);

  for (const m of current) {
    const p = rawPicks[m.id];
    if (p === m.home.name || p === m.away.name) cleanedPicks[m.id] = p;
  }

  for (let i = 1; i < bracket.rounds.length; i++) {
    const round = bracket.rounds[i];
    const next: ServerBracketMatchup[] = [];

    for (let j = 0; j < current.length; j += 2) {
      const left = current[j];
      const right = current[j + 1];
      const homeName = left ? cleanedPicks[left.id] : undefined;
      const awayName = right ? cleanedPicks[right.id] : undefined;

      const matchup: ServerBracketMatchup = {
        id: `${round}_${j / 2}`,
        round,
        slotIndex: j / 2,
        home: homeName ? (teamsByName.get(homeName) ?? { name: homeName }) : { name: '' },
        away: awayName ? (teamsByName.get(awayName) ?? { name: awayName }) : { name: '' }
      };
      next.push(matchup);

      const p = rawPicks[matchup.id];
      if (p && (p === matchup.home.name || p === matchup.away.name)) cleanedPicks[matchup.id] = p;
    }

    rounds.push(next);
    current = next;
  }

  return rounds;
}

/**
 * ADMIN → AUTOMATIK: llogarit pikët e një rrethi bracket-i sapo të gjitha ndeshjet reale
 * të atij rrethi (kompeticion + stage) kanë mbaruar — pa asnjë veprim admini.
 */
async function autoGradeBracketRounds(): Promise<void> {
  const bracketsSnap = await db.collection('brackets').where('status', '==', 'open').get();

  for (const bracketDoc of bracketsSnap.docs) {
    const bracketId = bracketDoc.id;
    const bracket = bracketDoc.data() as {
      competition: string;
      rounds: string[];
      matchups: ServerBracketMatchup[];
      pointsPerRound: Record<string, number>;
      resolvedRounds?: string[];
      deadline: number;
    };

    if (bracket.deadline > Date.now()) continue; // bracket-i ende s'ka filluar

    const resolvedRounds = bracket.resolvedRounds ?? [];

    for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex++) {
      const round = bracket.rounds[roundIndex];
      if (resolvedRounds.includes(round)) continue;

      const expectedCount = bracket.matchups.length / (2 ** roundIndex);

      const realMatchesSnap = await db.collection('matches')
        .where('competition', '==', bracket.competition)
        .where('stage', '==', round)
        .get();

      const finished = realMatchesSnap.docs.filter((d) => d.data()['status'] === 'finished');
      if (finished.length < expectedCount) continue; // rrethi real ende s'ka mbaruar plotësisht

      const actualWinnerByPair = new Map<string, string>();
      for (const d of finished) {
        const m = d.data();
        const home = m['homeTeam'] as string;
        const away = m['awayTeam'] as string;
        const winner = decisiveWinner(m);
        if (!winner) continue;
        actualWinnerByPair.set(bracketPairKey(home, away), winner);
      }

      const predictionsSnap = await db.collection('bracketPredictions').where('bracketId', '==', bracketId).get();
      const pointsForRound = bracket.pointsPerRound[round] ?? 0;
      const batch = db.batch();

      for (const predDoc of predictionsSnap.docs) {
        const prediction = predDoc.data() as { picks: Record<string, string>; roundPoints?: Record<string, number> };
        const rounds = buildServerBracketRounds(bracket, prediction.picks);
        const roundMatchups = rounds[roundIndex] ?? [];

        let earned = 0;
        for (const matchup of roundMatchups) {
          if (!matchup.home.name || !matchup.away.name) continue;
          const actualWinner = actualWinnerByPair.get(bracketPairKey(matchup.home.name, matchup.away.name));
          if (actualWinner && prediction.picks[matchup.id] === actualWinner) {
            earned += pointsForRound;
          }
        }

        const roundPoints = { ...(prediction.roundPoints ?? {}), [round]: earned };
        const totalPoints = Object.values(roundPoints).reduce((sum, v) => sum + (v ?? 0), 0);
        batch.update(predDoc.ref, { roundPoints, totalPoints });
      }

      const newResolvedRounds = Array.from(new Set([...resolvedRounds, round]));
      const isLastRound = roundIndex === bracket.rounds.length - 1;
      batch.update(bracketDoc.ref, {
        resolvedRounds: newResolvedRounds,
        ...(isLastRound ? { status: 'resolved' } : {})
      });

      await batch.commit();
      resolvedRounds.push(round);
      console.log(`+ Bracket ${bracketId}: rrethi ${round} u llogarit automatikisht (${predictionsSnap.size} parashikime).`);
    }
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



// ── HISTORIC MATCHES (pool shtesë për Score Flashback) ───────────────────────
// Sezone të kaluara madhore — sillen NJË HERË (jo çdo sync) dhe ruhen në koleksion
// të veçantë 'historicMatches', të ndarë nga 'matches' (që përdoret nga bracket-et/
// sfidat aktive) për të mos rrezikuar përzierje me logjikën e tyre (të njëjtin
// competition+stage por nga vite të ndryshme).
const HISTORIC_SOURCES: { code: string; season: number; competitionName: string }[] = [
  { code: 'WC', season: 2022, competitionName: 'FIFA World Cup' },
  { code: 'WC', season: 2018, competitionName: 'FIFA World Cup' },
  { code: 'EC', season: 2024, competitionName: 'UEFA European Championship' },
  { code: 'EC', season: 2020, competitionName: 'UEFA European Championship' },
];

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinal',
  SEMI_FINALS: 'Semifinal',
  FINAL: 'Final',
  THIRD_PLACE: 'Third Place Playoff'
};

function prettyStage(stage: string | undefined): string {
  if (!stage) return 'Matchday';
  return STAGE_LABELS[stage] ?? 'Matchday';
}

async function seedHistoricMatches(token: string): Promise<void> {
  const markerRef = db.collection('meta').doc('historicMatchesSeed');
  if ((await markerRef.get()).exists) return; // vetëm një herë — jo çdo cikël sync-i

  let totalSeeded = 0;

  for (const source of HISTORIC_SOURCES) {
    try {
      await new Promise(r => setTimeout(r, 7000)); // rate limit i bujshëm, si te top scorer
      const res = await fetch(
        `https://api.football-data.org/v4/competitions/${source.code}/matches?season=${source.season}&status=FINISHED`,
        { headers: { 'X-Auth-Token': token } }
      );

      if (!res.ok) {
        console.warn(`Historic matches: ${source.code} ${source.season} ktheu ${res.status}, po anashkalohet`);
        continue;
      }

      const data = await res.json() as { matches?: Record<string, unknown>[] };
      const batch = db.batch();
      let count = 0;

      for (const m of data.matches ?? []) {
        const score = m['score'] as Record<string, unknown> | undefined;
        const fullTime = score?.['fullTime'] as { home: number | null; away: number | null } | undefined;
        if (!fullTime || fullTime.home === null || fullTime.away === null) continue;

        const halfTime = score?.['halfTime'] as { home: number | null; away: number | null } | undefined;
        const homeTeam = (m['homeTeam'] as Record<string, string> | undefined)?.['name'];
        const awayTeam = (m['awayTeam'] as Record<string, string> | undefined)?.['name'];
        if (!homeTeam || !awayTeam) continue;

        const ref = db.collection('historicMatches').doc(`${source.code}_${source.season}_${m['id']}`);
        batch.set(ref, {
          homeTeam,
          awayTeam,
          result: { homeGoals: fullTime.home, awayGoals: fullTime.away },
          ...(halfTime && halfTime.home !== null && halfTime.away !== null
            ? { halfTimeResult: { homeGoals: halfTime.home, awayGoals: halfTime.away } }
            : {}),
          competition: source.competitionName,
          season: source.season,
          stage: m['stage'] ?? 'Matchday',
          kickoff: new Date(m['utcDate'] as string).getTime()
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        totalSeeded += count;
        console.log(`📚 Historic matches seeded: ${source.competitionName} ${source.season} (${count} ndeshje)`);
      }
    } catch (e) {
      console.warn(`Historic matches seeding failed for ${source.code} ${source.season}:`, e);
    }
  }

  await markerRef.set({ seededAt: Date.now(), totalSeeded });
}

// ── SCORE FLASHBACK ──────────────────────────────────────────────────────────

async function setFlashbackChallenge(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const docRef = db.collection('challenges').doc(`${today}_flashback`);
  if ((await docRef.get()).exists) return;

  const seed = parseInt(today.replace(/-/g, ''), 10);
  const minAgeDays = 1;
  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;

  try {
    // Pool 1: ndeshjet tona të fundit (Firestore 'matches') + Pool 2: pool historik i seed-uar
    const [matchesSnap, historicSnap] = await Promise.all([
      db.collection('matches')
        .where('status', '==', 'finished')
        .where('kickoff', '<', cutoff)
        .limit(200)
        .get(),
      db.collection('historicMatches').limit(300).get()
    ]);

    const historicCandidates = historicSnap.docs.map(d => d.data() as Record<string, unknown>);

    if (matchesSnap.empty && historicCandidates.length === 0) {
      console.warn(`Flashback: no finished matches older than ${minAgeDays} day(s), and no historic pool found`);
      return;
    }

    const recentCandidates = matchesSnap.docs
      .map(d => d.data() as Record<string, unknown>)
      .filter(m => {
        const result = m['result'] as { homeGoals: number; awayGoals: number } | undefined;
        return result && typeof result.homeGoals === 'number';
      });

    const candidates = [...recentCandidates, ...historicCandidates];
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
        season: match['season']
          ? String(match['season'])
          : new Date(match['kickoff'] as number).toISOString().slice(0, 4),
        stage: prettyStage(match['stage'] as string | undefined),
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
        const teamsData = await teamsRes.json() as {
          teams?: Record<string, unknown>[];
          season?: { startDate?: string };
        };
        const teams = (teamsData.teams ?? []).map((t) => ({
          id: t['id'],
          name: t['name'],
          shortName: t['shortName'] ?? (t['name'] as string).split(' ')[0],
          crest: t['crest']
        }));
        if (teams.length === 0) continue;

        // Deadline: dita e fillimit real të sezonit (kur nis ndeshja e parë) — jo një afat arbitrar
        const deadline = teamsData.season?.startDate
          ? new Date(`${teamsData.season.startDate}T00:00:00Z`).getTime()
          : Date.now() + 7 * 24 * 60 * 60 * 1000; // fallback nëse API s'e kthen startDate
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

    // ── 1b. Korrigjo afatin nëse dokumenti ekzistues e ka të vjetëruar (bug i mëparshëm
    // që vendoste "7 ditë nga krijimi" në vend të fillimit real të sezonit) — rimerr
    // startDate-in real dhe rifresko, vetëm kur duket i gabuar (evitohet thirrje shtesë API).
    const existingDeadline = seasonSnap.data()?.['deadline'] as number | undefined;
    if (existingDeadline !== undefined && existingDeadline <= Date.now()) {
      try {
        await new Promise(r => setTimeout(r, 6500));
        const teamsRes = await fetch(
          `https://api.football-data.org/v4/competitions/${code}/teams?season=${currentSeason}`,
          { headers: { 'X-Auth-Token': token } }
        );
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json() as { season?: { startDate?: string } };
          if (teamsData.season?.startDate) {
            const correctedDeadline = new Date(`${teamsData.season.startDate}T00:00:00Z`).getTime();
            if (correctedDeadline !== existingDeadline) {
              await seasonDocRef.update({ deadline: correctedDeadline });
              console.log(`📊 Table deadline corrected: ${code} ${currentSeason} → ${teamsData.season.startDate}`);
            }
          }
        }
      } catch (e) {
        console.warn(`Table deadline correction failed for ${code}:`, e);
      }
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