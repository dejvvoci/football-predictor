import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, setDoc, deleteDoc, doc,
  query, where
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of, map } from 'rxjs';
import {
  PredictionReaction, ReactionEmoji, ReactionSummary, REACTION_EMOJIS
} from '../models/reaction.model';

@Injectable({ providedIn: 'root' })
export class ReactionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  /** Të gjitha reagimet për një parashikim specifik */
  getReactions(predictionId: string): Observable<PredictionReaction[]> {
    const ref = collection(this.firestore, 'reactions');
    const q = query(ref, where('predictionId', '==', predictionId));
    return collectionData(q, { idField: 'id' }) as Observable<PredictionReaction[]>;
  }

  /** Reagimet e përmbledhura (count + a ka reaguar useri aktual) */
  getReactionSummary(predictionId: string): Observable<ReactionSummary[]> {
    const myId = this.auth.currentUser?.uid ?? '';
    return this.getReactions(predictionId).pipe(
      map((reactions) =>
        REACTION_EMOJIS.map((emoji) => ({
          emoji,
          count: reactions.filter((r) => r.emoji === emoji).length,
          myReaction: reactions.some((r) => r.emoji === emoji && r.reactorId === myId)
        }))
      )
    );
  }

  /** Toggle — shton nëse s'ekziston, fshin nëse ekziston */
  async toggleReaction(predictionId: string, groupId: string, emoji: ReactionEmoji): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('You must be logged in.');

    const reactionId = `${user.uid}_${predictionId}_${emoji}`;
    const ref = doc(this.firestore, 'reactions', reactionId);

    // Fetch nëse ekziston (pa Observer — query i thjeshtë)
    const allReactions = await new Promise<PredictionReaction[]>((resolve) => {
      const q = query(
        collection(this.firestore, 'reactions'),
        where('predictionId', '==', predictionId),
        where('reactorId', '==', user.uid),
        where('emoji', '==', emoji)
      );
      const sub = (collectionData(q, { idField: 'id' }) as Observable<PredictionReaction[]>)
        .subscribe((data) => { resolve(data); sub.unsubscribe(); });
    });

    if (allReactions.length > 0) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        predictionId,
        groupId,
        reactorId: user.uid,
        emoji,
        createdAt: Date.now()
      } satisfies Omit<PredictionReaction, 'id'>);
    }
  }
}