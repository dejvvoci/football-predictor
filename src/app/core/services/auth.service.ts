import { Injectable, inject } from '@angular/core';
import { Auth, authState, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

/**
 * Implementohet plotësisht në hapin "AuthService + login/register".
 * Këtu vendoset vetëm forma e shërbimit, që routing-u dhe guard-i
 * (që e përdorin tashmë) të kenë diçka konkrete për t'u injektuar.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);

  readonly user$: Observable<User | null> = authState(this.auth);

  login(email: string, password: string): Promise<unknown> {
    throw new Error('TODO: implementohet me signInWithEmailAndPassword');
  }

  register(email: string, password: string, displayName: string): Promise<unknown> {
    throw new Error('TODO: implementohet me createUserWithEmailAndPassword + krijimi i UserProfile në Firestore');
  }

  logout(): Promise<void> {
    throw new Error('TODO: implementohet me signOut');
  }
}
