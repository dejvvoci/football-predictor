import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, addDoc, deleteDoc, doc, query, where, orderBy
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { GroupComment } from '../models/comment.model';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getComments(groupId: string): Observable<GroupComment[]> {
    const ref = collection(this.firestore, 'groupComments');
    const q = query(ref, where('groupId', '==', groupId), orderBy('createdAt', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<GroupComment[]>;
  }

  async addComment(groupId: string, text: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('You must be logged in.');
    if (!text.trim()) return;

    await addDoc(collection(this.firestore, 'groupComments'), {
      groupId,
      userId: user.uid,
      displayName: user.displayName ?? user.email ?? 'User',
      text: text.trim(),
      createdAt: Date.now()
    });
  }

  async deleteComment(commentId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'groupComments', commentId));
  }
}