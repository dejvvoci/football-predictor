import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
  orderBy,
  getDocs,
  documentId
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Match } from '../models/match.model';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private firestore = inject(Firestore);

  /** Ndeshjet e javës së ardhshme (që nga tani), të renditura sipas orarit */
  getUpcomingMatches(): Observable<Match[]> {
    const now = Date.now();
    const windowEnd = now + 7 * 24 * 60 * 60 * 1000;

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

  /** Merr disa ndeshje njëherësh (lexim i vetëm, jo real-time) — përdoret për kërkimin te Historiku */
  async getMatchesByIdsOnce(matchIds: string[]): Promise<Match[]> {
    const uniqueIds = Array.from(new Set(matchIds));
    if (uniqueIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 30) {
      chunks.push(uniqueIds.slice(i, i + 30));
    }

    const matchesRef = collection(this.firestore, 'matches');
    const snapshots = await Promise.all(
      chunks.map((ids) => getDocs(query(matchesRef, where(documentId(), 'in', ids))))
    );

    return snapshots.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match));
  }
}