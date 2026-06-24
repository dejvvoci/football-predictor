import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, docData,
  query, where, orderBy, getDocs
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, of } from 'rxjs';
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
  expertCompetition: CompetitionStat | null; // best accuracy (min 3 predictions)
}

export interface WeeklyFormPoint {
  weekLabel: string;
  points: number;
  weekStart: number;
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private firestore = inject(Firestore);

  getProfile(userId: string): Observable<UserProfile | undefined> {
    const ref = doc(this.firestore, 'users', userId);
    return docData(ref, { idField: 'uid' }) as Observable<UserProfile | undefined>;
  }

  getAllUsers(): Observable<UserProfile[]> {
    const ref = collection(this.firestore, 'users');
    return collectionData(ref, { idField: 'uid' }) as Observable<UserProfile[]>;
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

        const expertCompetition = byCompetition
          .filter((c) => c.total >= 3)
          .sort((a, b) => b.accuracy - a.accuracy)[0] ?? null;

        return {
          totalPredictions: total,
          correctOutcomes: correct,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
          totalExact: exact,
          exactAccuracy: total > 0 ? Math.round((exact / total) * 100) : 0,
          currentStreak: profile?.currentStreak ?? 0,
          bestStreak: profile?.bestStreak ?? 0,
          totalPoints: profile?.totalPoints ?? 0,
          byCompetition,
          expertCompetition
        };
      })
    );
  }

  /** Last 8 weeks of points for the form chart */
  getWeeklyForm(userId: string): Observable<WeeklyFormPoint[]> {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const eightWeeksAgo = Date.now() - 8 * WEEK_MS;

    const predictionsRef = collection(this.firestore, 'predictions');
    const q = query(
      predictionsRef,
      where('userId', '==', userId),
      where('points', '>=', 0),
      where('createdAt', '>=', eightWeeksAgo),
      orderBy('createdAt', 'asc')
    );

    return (collectionData(q, { idField: 'id' }) as Observable<Prediction[]>).pipe(
      map((predictions) => {
        // Build 8 weekly buckets (Mon–Sun)
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // current Monday
        monday.setHours(0, 0, 0, 0);

        const weeks: WeeklyFormPoint[] = [];
        for (let i = 7; i >= 0; i--) {
          const weekStart = new Date(monday.getTime() - i * WEEK_MS);
          const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
          const label = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          const weekPts = predictions
            .filter((p) => p.createdAt >= weekStart.getTime() && p.createdAt < weekEnd.getTime())
            .reduce((sum, p) => {
              const total = (p.points ?? 0) + (p.ouPoints ?? 0) + (p.htFtPoints ?? 0)
                + (p.bttsPoints ?? 0) + (p.redCardPoints ?? 0);
              return sum + total;
            }, 0);
          weeks.push({ weekLabel: label, points: weekPts, weekStart: weekStart.getTime() });
        }
        return weeks;
      })
    );
  }
}