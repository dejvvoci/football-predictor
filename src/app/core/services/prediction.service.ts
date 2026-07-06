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
  orderBy,
  limit
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
    overUnder?: 'over' | 'under',
    htFt?: string,
    btts?: boolean,
    redCard?: boolean,
    firstGoalscorer?: string
  ): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('Must be logged in to submit a prediction.');

    const predictionId = `${userId}_${matchId}`;
    const prediction: Prediction = {
      id: predictionId,
      userId,
      matchId,
      choice,
      ...(exactScore ? { exactScore } : {}),
      ...(overUnder ? { overUnder } : {}),
      ...(htFt ? { htFt } : {}),
      ...(btts !== undefined ? { btts } : {}),
      ...(redCard !== undefined ? { redCard } : {}),
      ...(firstGoalscorer?.trim() ? { firstGoalscorer: firstGoalscorer.trim() } : {}),
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

  /** 20 parashikimet më të fundit të userit (për tabin e Historikut) */
  getUserPredictions(userId: string, count = 20): Observable<Prediction[]> {
    const predictionsRef = collection(this.firestore, 'predictions');
    const q = query(
      predictionsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<Prediction[]>;
  }

  /** Gjithë historiku i parashikimeve të userit, pa limit — përdoret për kërkim */
  getAllUserPredictions(userId: string): Observable<Prediction[]> {
    const predictionsRef = collection(this.firestore, 'predictions');
    const q = query(predictionsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Prediction[]>;
  }

  /** Ruaj/hiq nga të ruajturat — parashikimet e ruajtura mbijetojnë resetimin e fund-sezonit */
  async setPredictionSaved(predictionId: string, saved: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'predictions', predictionId), { saved });
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