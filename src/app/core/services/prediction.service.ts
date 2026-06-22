import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  updateDoc,
  collection,
  collectionData,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Prediction, PredictionChoice, ExactScoreGuess } from '../models/prediction.model';
import { GroupPrediction } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  async submitPrediction(
    matchId: string,
    choice: PredictionChoice,
    exactScore?: ExactScoreGuess,
    overUnder?: 'over' | 'under'
  ): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) {
      throw new Error('Duhet të jesh i loguar për të dhënë parashikim.');
    }

    const predictionId = `${userId}_${matchId}`;
    const prediction: Prediction = {
      id: predictionId,
      userId,
      matchId,
      choice,
      ...(exactScore ? { exactScore } : {}),
      ...(overUnder ? { overUnder } : {}),
      createdAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'predictions', predictionId), prediction);
  }

  /** Parashikimi ekzistues i userit aktual për një ndeshje specifike (nëse ka) */
  getPredictionForMatch(matchId: string): Observable<Prediction | undefined> {
    const userId = this.auth.currentUser?.uid;
    const predictionId = `${userId}_${matchId}`;
    const ref = doc(this.firestore, 'predictions', predictionId);
    return docData(ref, { idField: 'id' }) as Observable<Prediction | undefined>;
  }

  /** Gjithë historiku i parashikimeve të një useri, më të rejat së pari */
  getUserPredictions(userId: string): Observable<Prediction[]> {
    const predictionsRef = collection(this.firestore, 'predictions');
    const q = query(predictionsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Prediction[]>;
  }

  /** Parashikime globale të graduara që s'i janë shfaqur ende userit si njoftim */
  getUnseenGradedPredictions(userId: string): Observable<Prediction[]> {
    const predictionsRef = collection(this.firestore, 'predictions');
    const q = query(predictionsRef, where('userId', '==', userId), where('seen', '==', false));
    return collectionData(q, { idField: 'id' }) as Observable<Prediction[]>;
  }

  async markPredictionsSeen(predictionIds: string[]): Promise<void> {
    await Promise.all(
      predictionIds.map((id) => updateDoc(doc(this.firestore, 'predictions', id), { seen: true }))
    );
  }

  /** Parashikim i veçantë brenda një grupi — pikët shkojnë vetëm te leaderboard i atij grupi */
  async submitGroupPrediction(
    groupId: string,
    matchId: string,
    choice: PredictionChoice,
    exactScore?: ExactScoreGuess
  ): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) {
      throw new Error('Duhet të jesh i loguar për të dhënë parashikim.');
    }

    const predictionId = `${groupId}_${userId}_${matchId}`;
    const prediction: GroupPrediction = {
      id: predictionId,
      groupId,
      userId,
      matchId,
      choice,
      ...(exactScore ? { exactScore } : {}),
      createdAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'groupPredictions', predictionId), prediction);
  }

  getGroupPredictionForMatch(groupId: string, matchId: string): Observable<GroupPrediction | undefined> {
    const userId = this.auth.currentUser?.uid;
    const predictionId = `${groupId}_${userId}_${matchId}`;
    const ref = doc(this.firestore, 'groupPredictions', predictionId);
    return docData(ref, { idField: 'id' }) as Observable<GroupPrediction | undefined>;
  }

  /** Historiku i parashikimeve të userit brenda një grupi specifik, më të rejat së pari */
  getUserGroupPredictions(groupId: string, userId: string): Observable<GroupPrediction[]> {
    const ref = collection(this.firestore, 'groupPredictions');
    const q = query(
      ref,
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<GroupPrediction[]>;
  }
}