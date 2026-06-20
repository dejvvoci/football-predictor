import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  collection,
  collectionData,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Prediction, PredictionChoice, ExactScoreGuess } from '../models/prediction.model';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  async submitPrediction(
    matchId: string,
    choice: PredictionChoice,
    exactScore?: ExactScoreGuess
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
}