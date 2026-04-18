import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  User,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { auth, db } from '../data/firebase-db';

/**
 * undefined = Firebase has not yet resolved the auth state (initial page load)
 * null      = resolved, no user logged in
 * User      = resolved, user is logged in
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly userSubject = new BehaviorSubject<User | null | undefined>(undefined);
  readonly user$ = this.userSubject.asObservable();

  private readonly unsubscribeAuthState: () => void;

  constructor(private readonly router: Router) {
    this.unsubscribeAuthState = onAuthStateChanged(auth, (user) => {
      this.userSubject.next(user);
    });
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(auth);
    await this.router.navigate(['/login']);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email, {
      url: `${environment.appUrl}/auth/action`,
      handleCodeInApp: true,
    });
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }

    const trimmedName = displayName.trim();
    await updateProfile(user, { displayName: trimmedName });
    await setDoc(
      doc(db, 'users', user.uid),
      {
        displayName: trimmedName,
        email: user.email ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    this.userSubject.next(auth.currentUser);
  }

  getCurrentUser(): User | null | undefined {
    return this.userSubject.getValue();
  }

  ngOnDestroy(): void {
    this.unsubscribeAuthState();
  }
}
