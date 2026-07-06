import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  writeBatch,
  increment
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import {
  Bracket,
  BracketMatchup,
  BracketPrediction,
  BracketRoundName,
  BRACKET_ROUND_ORDER
} from '../models/bracket.model';
import { buildBracketRounds } from '../utils/bracket-utils';

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

@Injectable({ providedIn: 'root' })
export class BracketService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getBrackets(): Observable<Bracket[]> {
    const ref = collection(this.firestore, 'brackets');
    const q = query(ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Bracket[]>;
  }

  getBracket(bracketId: string): Observable<Bracket | undefined> {
    const ref = doc(this.firestore, 'brackets', bracketId);
    return docData(ref, { idField: 'id' }) as Observable<Bracket | undefined>;
  }

  getMyPrediction(bracketId: string): Observable<BracketPrediction | undefined> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(undefined);
    const ref = doc(this.firestore, 'bracketPredictions', `${userId}_${bracketId}`);
    return docData(ref, { idField: 'id' }) as Observable<BracketPrediction | undefined>;
  }

  getLeaderboard(bracketId: string): Observable<BracketPrediction[]> {
    const ref = collection(this.firestore, 'bracketPredictions');
    const q = query(ref, where('bracketId', '==', bracketId), orderBy('totalPoints', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<BracketPrediction[]>;
  }

  /** Ruaj/përditëso bracket-in e plotë të userit (i lejuar vetëm para deadline-it) */
  async submitBracket(bracketId: string, picks: Record<string, string>): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    const user = this.auth.currentUser;
    if (!userId || !user) throw new Error('Duhet të jesh i loguar.');

    const bracketSnap = await getDoc(doc(this.firestore, 'brackets', bracketId));
    if (!bracketSnap.exists()) throw new Error('Bracket-i nuk u gjet.');
    const bracket = bracketSnap.data() as Bracket;
    if (bracket.deadline <= Date.now()) throw new Error('Parashikimet janë mbyllur për këtë bracket.');

    const predId = `${userId}_${bracketId}`;
    const existing = await getDoc(doc(this.firestore, 'bracketPredictions', predId));

    const prediction: BracketPrediction = {
      id: predId,
      userId,
      displayName: user.displayName ?? user.email ?? 'Player',
      bracketId,
      picks,
      createdAt: existing.exists() ? (existing.data() as BracketPrediction).createdAt : Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'bracketPredictions', predId), prediction);
  }

  /** ADMIN: krijo bracket të ri duke lexuar rrethin e parë direkt nga koleksioni 'matches' */
  async createBracketFromMatches(data: {
    title: string;
    competition: string;
    startRound: BracketRoundName;
    pointsPerRound: Partial<Record<BracketRoundName, number>>;
  }): Promise<string> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('Duhet të jesh i loguar.');

    const startIndex = BRACKET_ROUND_ORDER.indexOf(data.startRound);
    if (startIndex === -1) throw new Error('Rreth fillestar i panjohur.');
    const rounds = BRACKET_ROUND_ORDER.slice(startIndex);
    const expectedMatches = 2 ** (rounds.length - 1);

    const matchesSnap = await getDocs(
      query(
        collection(this.firestore, 'matches'),
        where('competition', '==', data.competition),
        where('stage', '==', data.startRound)
      )
    );

    if (matchesSnap.empty) {
      throw new Error(`S'u gjet asnjë ndeshje për "${data.competition}" te rrethi ${data.startRound}.`);
    }

    const docs: Record<string, unknown>[] = matchesSnap.docs
      .map((d): Record<string, unknown> => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .sort((a, b) => (a['kickoff'] as number) - (b['kickoff'] as number));

    if (docs.length !== expectedMatches) {
      throw new Error(
        `Gjetën ${docs.length} ndeshje te ${data.startRound}, por duhen saktësisht ${expectedMatches} ` +
        `(fuqi e 2-shit) që bracket-i të mund të ndërtohet deri te finalja.`
      );
    }

    const matchups: BracketMatchup[] = docs.map((d, i) => ({
      id: `${data.startRound}_${i}`,
      round: data.startRound,
      slotIndex: i,
      home: { name: d['homeTeam'] as string, ...(d['homeCrest'] ? { crest: d['homeCrest'] as string } : {}) },
      away: { name: d['awayTeam'] as string, ...(d['awayCrest'] ? { crest: d['awayCrest'] as string } : {}) }
    }));

    const deadline = Math.min(...docs.map((d) => d['kickoff'] as number));

    const bracket: Omit<Bracket, 'id'> = {
      title: data.title,
      competition: data.competition,
      rounds,
      pointsPerRound: data.pointsPerRound,
      matchups,
      deadline,
      status: 'open',
      resolvedRounds: [],
      createdBy: userId,
      createdAt: Date.now()
    };

    const ref = await addDoc(collection(this.firestore, 'brackets'), bracket);
    return ref.id;
  }

  /**
   * ADMIN: llogarit pikët për një rreth pasi ndeshjet reale të atij rrethi kanë mbaruar.
   * Krahason parashikimin e çdo useri (çift ekipesh + fitues) me ndeshjet reale të gjetura
   * në koleksionin 'matches' për po atë kompeticion/rreth.
   */
  async gradeRound(bracketId: string, round: BracketRoundName): Promise<number> {
    const bracketRef = doc(this.firestore, 'brackets', bracketId);
    const bracketSnap = await getDoc(bracketRef);
    if (!bracketSnap.exists()) throw new Error('Bracket-i nuk u gjet.');
    const bracket = { id: bracketId, ...(bracketSnap.data() as Omit<Bracket, 'id'>) };

    const roundIndex = bracket.rounds.indexOf(round);
    if (roundIndex === -1) throw new Error('Ky rreth nuk bën pjesë në këtë bracket.');

    const realMatchesSnap = await getDocs(
      query(
        collection(this.firestore, 'matches'),
        where('competition', '==', bracket.competition),
        where('stage', '==', round),
        where('status', '==', 'finished')
      )
    );

    const actualWinnerByPair = new Map<string, string>();
    for (const d of realMatchesSnap.docs) {
      const m = d.data() as Record<string, unknown>;
      const result = m['result'] as { homeGoals: number; awayGoals: number } | undefined;
      const home = m['homeTeam'] as string;
      const away = m['awayTeam'] as string;
      if (!result || result.homeGoals === result.awayGoals) continue; // barazim/penallti — s'mund të gradohet automatikisht
      const winner = result.homeGoals > result.awayGoals ? home : away;
      actualWinnerByPair.set(pairKey(home, away), winner);
    }

    const predictionsSnap = await getDocs(
      query(collection(this.firestore, 'bracketPredictions'), where('bracketId', '==', bracketId))
    );

    const pointsForRound = bracket.pointsPerRound[round] ?? 0;
    const batch = writeBatch(this.firestore);
    let gradedCount = 0;

    for (const predDoc of predictionsSnap.docs) {
      const prediction = predDoc.data() as BracketPrediction;
      const rounds = buildBracketRounds(bracket, prediction.picks);
      const roundMatchups = rounds[roundIndex] ?? [];

      let earned = 0;
      for (const matchup of roundMatchups) {
        if (!matchup.home.name || !matchup.away.name) continue;
        const actualWinner = actualWinnerByPair.get(pairKey(matchup.home.name, matchup.away.name));
        if (actualWinner && prediction.picks[matchup.id] === actualWinner) {
          earned += pointsForRound;
        }
      }

      const roundPoints = { ...(prediction.roundPoints ?? {}), [round]: earned };
      const totalPoints = Object.values(roundPoints).reduce((sum, v) => sum + (v ?? 0), 0);
      batch.update(predDoc.ref, { roundPoints, totalPoints });
      gradedCount++;
    }

    const resolvedRounds = Array.from(new Set([...(bracket.resolvedRounds ?? []), round]));
    const isLastRound = roundIndex === bracket.rounds.length - 1;
    batch.update(bracketRef, {
      resolvedRounds,
      ...(isLastRound ? { status: 'resolved' } : {})
    });

    await batch.commit();
    return gradedCount;
  }

  /** USER: kërko pikët e fituara — vetë-shërbim, i shton totalPoints globale të profilit */
  async claimPoints(predictionId: string, points: number): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('Duhet të jesh i loguar.');

    const predRef = doc(this.firestore, 'bracketPredictions', predictionId);
    const userRef = doc(this.firestore, 'users', userId);

    const batch = writeBatch(this.firestore);
    batch.update(predRef, { claimed: true });
    batch.update(userRef, { totalPoints: increment(points) });
    await batch.commit();
  }
}
