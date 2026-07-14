import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  updateDoc,
  addDoc,
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
import { TournamentChallenge, TournamentPrediction } from '../models/tournament-challenge.model';

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getChallenges(): Observable<TournamentChallenge[]> {
    const ref = collection(this.firestore, 'tournamentChallenges');
    const q = query(ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<TournamentChallenge[]>;
  }

  getUserPrediction(challengeId: string): Observable<TournamentPrediction | undefined> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(undefined);
    const ref = doc(this.firestore, 'tournamentPredictions', `${userId}_${challengeId}`);
    return docData(ref, { idField: 'id' }) as Observable<TournamentPrediction | undefined>;
  }

  getMyPredictions(): Observable<TournamentPrediction[]> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of([]);
    const ref = collection(this.firestore, 'tournamentPredictions');
    const q = query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<TournamentPrediction[]>;
  }

  async submitPrediction(challengeId: string, choice: string): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('You must be logged in.');

    const predId = `${userId}_${challengeId}`;
    const prediction: TournamentPrediction = {
      id: predId,
      userId,
      challengeId,
      choice,
      claimed: false,
      createdAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'tournamentPredictions', predId), prediction, { merge: true });
  }

  /** ADMIN: Krijo sfidë të re */
  async createChallenge(
    data: Omit<TournamentChallenge, 'id' | 'createdBy' | 'createdAt' | 'status'>
  ): Promise<string> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('You must be logged in.');

    const ref = collection(this.firestore, 'tournamentChallenges');
    const docRef = await addDoc(ref, {
      ...data,
      status: 'open',
      createdBy: userId,
      createdAt: Date.now()
    });
    return docRef.id;
  }

  /** ADMIN: Zgjidh sfidën — vendos rezultatin dhe llogarit pikët */
  async resolveChallenge(challengeId: string, result: string): Promise<number> {
    const challengeRef = doc(this.firestore, 'tournamentChallenges', challengeId);
    const challengeSnap = await getDoc(challengeRef);

    if (!challengeSnap.exists()) throw new Error('Sfida nuk u gjet.');
    const challenge = challengeSnap.data() as TournamentChallenge;

    await updateDoc(challengeRef, { status: 'resolved', result });

    const predictionsSnap = await getDocs(
      query(collection(this.firestore, 'tournamentPredictions'), where('challengeId', '==', challengeId))
    );

    const batch = writeBatch(this.firestore);
    let winners = 0;

    for (const predDoc of predictionsSnap.docs) {
      const pred = predDoc.data() as TournamentPrediction;
      batch.update(predDoc.ref, {
        tournamentPoints: pred.choice === result ? challenge.pointsReward : 0
      });
      if (pred.choice === result) winners++;
    }

    await batch.commit();
    return winners;
  }

  /** USER: Kërko pikët e fituara (self-service — shton tournamentPoints te profili i vet) */
  async claimPoints(predictionId: string, points: number): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('You must be logged in.');

    const predRef = doc(this.firestore, 'tournamentPredictions', predictionId);
    const userRef = doc(this.firestore, 'users', userId);

    const batch = writeBatch(this.firestore);
    batch.update(predRef, { claimed: true });
    batch.update(userRef, { tournamentPoints: increment(points) });
    await batch.commit();
  }
}