import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, query, where, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Match } from '../models/match.model';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private firestore = inject(Firestore);

  /** Ndeshjet në 24 orët e ardhshme (që nga tani), të renditura sipas orarit */
  getUpcomingMatches(): Observable<Match[]> {
    const now = Date.now();
    const windowEnd = now + 24 * 60 * 60 * 1000;

    const matchesRef = collection(this.firestore, 'matches');
    const q = query(
      matchesRef,
      where('kickoff', '>=', now),
      where('kickoff', '<=', windowEnd),
      orderBy('kickoff', 'asc')
    );

    return collectionData(q, { idField: 'id' }) as Observable<Match[]>;
  }

  getMatchById(matchId: string): Observable<Match | undefined> {
    const matchRef = doc(this.firestore, 'matches', matchId);
    return docData(matchRef, { idField: 'id' }) as Observable<Match | undefined>;
  }
}