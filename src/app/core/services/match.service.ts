import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, query, where, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Match } from '../models/match.model';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private firestore = inject(Firestore);

  /** Ndeshjet e sotme (00:00–23:59, ora lokale), të renditura sipas orarit */
  getTodayMatches(): Observable<Match[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const matchesRef = collection(this.firestore, 'matches');
    const q = query(
      matchesRef,
      where('kickoff', '>=', start.getTime()),
      where('kickoff', '<=', end.getTime()),
      orderBy('kickoff', 'asc')
    );

    return collectionData(q, { idField: 'id' }) as Observable<Match[]>;
  }

  getMatchById(matchId: string): Observable<Match | undefined> {
    const matchRef = doc(this.firestore, 'matches', matchId);
    return docData(matchRef, { idField: 'id' }) as Observable<Match | undefined>;
  }
}