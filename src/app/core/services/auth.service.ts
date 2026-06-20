import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  /** Stream me userin e loguar (ose null), e dëgjon authGuard dhe navbar-i */
  readonly user$: Observable<User | null> = authState(this.auth);

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(credential.user, { displayName });

    const profile: UserProfile = {
      uid: credential.user.uid,
      displayName,
      email,
      totalPoints: 0,
      groupIds: [],
      createdAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'users', credential.user.uid), profile);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}