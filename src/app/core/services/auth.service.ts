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
import { Firestore, doc, getDoc, runTransaction, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/user.model';

// Domen fiktiv — përdoret vetëm si "email" i brendshëm te Firebase Auth për llogaritë me username,
// asnjëherë s'i dërgohet email dhe s'shfaqet te useri (email/password provider kërkon domosdo një email).
const USERNAME_EMAIL_DOMAIN = 'predvictor-users.app';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  /** Stream me userin e loguar (ose null), e dëgjon authGuard dhe navbar-i */
  readonly user$: Observable<User | null> = authState(this.auth);

  /** Pranon si email ashtu edhe username — dallohet nga prania e '@' */
  async login(identifier: string, password: string): Promise<void> {
    const email = identifier.includes('@')
      ? identifier
      : await this.resolveUsernameEmail(identifier);
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
      tournamentPoints: 0,
      currentStreak: 0,
      bestStreak: 0,
      achievements: [],
      groupIds: [],
      createdAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'users', credential.user.uid), profile);
  }

  /** Regjistrim me username (pa email) — username-i duhet të jetë unik në 'usernames/{username}' */
  async registerWithUsername(username: string, password: string, displayName: string): Promise<void> {
    const normalised = username.toLowerCase();
    const syntheticEmail = `${normalised}@${USERNAME_EMAIL_DOMAIN}`;

    // Krijo llogarinë Auth PARA rezervimit të username-it — kështu rezervimi bëhet i autentikuar
    // (rregullat Firestore mund të verifikojnë request.auth.uid), pasi lexim-i i 'usernames' për
    // login duhet të mbetet publik (ende s'ka auth kur useri po hyn me username).
    const credential = await createUserWithEmailAndPassword(this.auth, syntheticEmail, password);
    const usernameRef = doc(this.firestore, 'usernames', normalised);

    try {
      await runTransaction(this.firestore, async (tx) => {
        const snap = await tx.get(usernameRef);
        if (snap.exists()) {
          throw { code: 'username/taken' };
        }
        tx.set(usernameRef, { uid: credential.user.uid, email: syntheticEmail });
      });

      await updateProfile(credential.user, { displayName });

      const profile: UserProfile = {
        uid: credential.user.uid,
        displayName,
        email: syntheticEmail,
        username: normalised,
        totalPoints: 0,
        tournamentPoints: 0,
        currentStreak: 0,
        bestStreak: 0,
        achievements: [],
        groupIds: [],
        createdAt: Date.now()
      };

      await setDoc(doc(this.firestore, 'users', credential.user.uid), profile);
    } catch (e) {
      await credential.user.delete().catch(() => {}); // username i zënë (ose gabim) — hiq llogarinë e porsakrijuar
      throw e;
    }
  }

  /** Kthen email-in (real ose fiktiv) të lidhur me një username, për ta përdorur te signInWithEmailAndPassword */
  private async resolveUsernameEmail(username: string): Promise<string> {
    const ref = doc(this.firestore, 'usernames', username.toLowerCase());
    const snap = await getDoc(ref);
    if (!snap.exists() || !snap.data()?.['email']) {
      throw { code: 'auth/user-not-found' };
    }
    return snap.data()!['email'] as string;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /** Përditëson emrin e shfaqur — edhe te Firebase Auth, edhe te dokumenti users/{uid} (që përdoret te leaderboard/grupe) */
  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in.');
    }

    await updateProfile(user, { displayName });
    await setDoc(doc(this.firestore, 'users', user.uid), { displayName }, { merge: true });
  }
}
