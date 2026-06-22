import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, query, where } from '@angular/fire/firestore';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';
import { Prediction } from '../models/prediction.model';
import { UserProfile } from '../models/user.model';

export interface CompetitionStat {
  competition: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface UserStatistics {
  totalPredictions: number;
  correctOutcomes: number;
  accuracy: number;
  totalExact: number;
  exactAccuracy: number;
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  byCompetition: CompetitionStat[];
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private firestore = inject(Firestore);

  getProfile(userId: string): Observable<UserProfile | undefined> {
    const ref = doc(this.firestore, 'users', userId);
    return docData(ref, { idField: 'uid' }) as Observable<UserProfile | undefined>;
  }

  getUserStatistics(userId: string): Observable<UserStatistics> {
    const predictionsRef = collection(this.firestore, 'predictions');
    const q = query(predictionsRef, where('userId', '==', userId), where('points', '>=', 0));
    const gradedPredictions$ = collectionData(q, { idField: 'id' }) as Observable<(Prediction & { competition?: string; exactScoreCorrect?: boolean })[]>;

    return combineLatest([gradedPredictions$, this.getProfile(userId)]).pipe(
      map(([predictions, profile]) => {
        const total = predictions.length;
        const correct = predictions.filter((p) => (p.points ?? 0) > 0).length;
        const exact = predictions.filter((p) => p.exactScoreCorrect).length;

        const competitionMap = new Map<string, { total: number; correct: number }>();
        for (const p of predictions) {
          const comp = p['competition'] as string | undefined;
          if (!comp) continue;
          const entry = competitionMap.get(comp) ?? { total: 0, correct: 0 };
          entry.total++;
          if ((p.points ?? 0) > 0) entry.correct++;
          competitionMap.set(comp, entry);
        }

        const byCompetition: CompetitionStat[] = Array.from(competitionMap.entries())
          .map(([competition, s]) => ({
            competition,
            total: s.total,
            correct: s.correct,
            accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
          }))
          .sort((a, b) => b.total - a.total);

        return {
          totalPredictions: total,
          correctOutcomes: correct,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
          totalExact: exact,
          exactAccuracy: total > 0 ? Math.round((exact / total) * 100) : 0,
          currentStreak: profile?.currentStreak ?? 0,
          bestStreak: profile?.bestStreak ?? 0,
          totalPoints: profile?.totalPoints ?? 0,
          byCompetition
        };
      })
    );
  }
}
