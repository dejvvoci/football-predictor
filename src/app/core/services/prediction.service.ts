import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Prediction, PredictionChoice, ExactScoreGuess } from '../models/prediction.model';

/**
 * Implementohet plotësisht në hapin "PredictionService + faqja e historikut".
 */
@Injectable({ providedIn: 'root' })
export class PredictionService {
  private firestore = inject(Firestore);

  submitPrediction(
    matchId: string,
    choice: PredictionChoice,
    exactScore?: ExactScoreGuess
  ): Promise<void> {
    throw new Error('TODO: setDoc mbi predictions/{userId}_{matchId}');
  }

  getUserPredictions(userId: string): Observable<Prediction[]> {
    throw new Error('TODO: query mbi predictions where userId == ...');
  }
}
