import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { auth } from '../data/firebase-db';

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

  getCurrentUser(): User | null | undefined {
    return this.userSubject.getValue();
  }

  ngOnDestroy(): void {
    this.unsubscribeAuthState();
  }
}
