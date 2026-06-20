import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Match } from '../models/match.model';

/**
 * Implementohet plotësisht në hapin "MatchService + lista e ndeshjeve".
 * Lexon koleksionin `matches` (plotësuar nga Cloud Function që merr
 * të dhëna nga football-data.org).
 */
@Injectable({ providedIn: 'root' })
export class MatchService {
  private firestore = inject(Firestore);

  getTodayMatches(): Observable<Match[]> {
    throw new Error('TODO: query mbi koleksionin matches, filtruar sipas dates së sotme');
  }

  getMatchById(matchId: string): Observable<Match | undefined> {
    throw new Error('TODO: docData mbi matches/{matchId}');
  }
}
