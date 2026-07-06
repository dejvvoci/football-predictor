import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, addDoc, updateDoc,
  query, where, orderBy, getDocs, writeBatch, limit
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { Season, HallOfFameEntry } from '../models/season.model';
import { UserProfile } from '../models/user.model';
import { Prediction } from '../models/prediction.model';

@Injectable({ providedIn: 'root' })
export class SeasonService {
  private firestore = inject(Firestore);

  getActiveSeason(): Observable<Season[]> {
    const ref = collection(this.firestore, 'seasons');
    const q = query(ref, where('isActive', '==', true), limit(1));
    return collectionData(q, { idField: 'id' }) as Observable<Season[]>;
  }

  getAllSeasons(): Observable<Season[]> {
    const ref = collection(this.firestore, 'seasons');
    const q = query(ref, orderBy('startedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Season[]>;
  }

  getHallOfFame(seasonId: string): Observable<HallOfFameEntry[]> {
    const ref = collection(this.firestore, 'hallOfFame');
    const q = query(ref, where('seasonId', '==', seasonId), orderBy('rank', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<HallOfFameEntry[]>;
  }

  /** ADMIN: Fillo sezon të ri */
  async startNewSeason(name: string): Promise<string> {
    // Çaktivizo sezonate aktive
    const activeSnap = await getDocs(
      query(collection(this.firestore, 'seasons'), where('isActive', '==', true))
    );
    const deactivateBatch = writeBatch(this.firestore);
    activeSnap.docs.forEach((d) => deactivateBatch.update(d.ref, { isActive: false }));
    await deactivateBatch.commit();

    const ref = await addDoc(collection(this.firestore, 'seasons'), {
      name,
      startedAt: Date.now(),
      isActive: true
    });
    return ref.id;
  }

  /**
   * ADMIN: Mbyll sezonin aktual.
   * 1. Ruaj skoret aktuale te hallOfFame
   * 2. Resetoje totalPoints te 0 për të gjithë
   * 3. Shëno sezonin si të mbyllur
   */
  async endSeason(seasonId: string): Promise<number> {
    const usersSnap = await getDocs(
      query(collection(this.firestore, 'users'), orderBy('totalPoints', 'desc'))
    );

    const batch = writeBatch(this.firestore);
    let rank = 1;

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data() as UserProfile;
      if ((user.totalPoints ?? 0) === 0) continue;

      const entryRef = doc(this.firestore, 'hallOfFame', `${seasonId}_${user.uid}`);
      batch.set(entryRef, {
        seasonId,
        userId: user.uid,
        displayName: user.displayName,
        totalPoints: user.totalPoints,
        rank,
        achievements: user.achievements ?? []
      });

      batch.update(userDoc.ref, { totalPoints: 0, currentStreak: 0 });
      rank++;
    }

    batch.update(doc(this.firestore, 'seasons', seasonId), {
      endedAt: Date.now(),
      isActive: false
    });

    await batch.commit();
    await this.deleteUnsavedPredictions();

    return rank - 1; // numri i lojtarëve të regjistruar
  }

  /** Fshin të gjitha parashikimet e pa-ruajtura nga useri (yjet mbeten) */
  private async deleteUnsavedPredictions(): Promise<void> {
    const predictionsSnap = await getDocs(collection(this.firestore, 'predictions'));
    const toDelete = predictionsSnap.docs.filter((d) => !(d.data() as Prediction).saved);

    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = writeBatch(this.firestore);
      toDelete.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}