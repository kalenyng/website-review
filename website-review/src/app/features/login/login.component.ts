import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="login-page">
      <div class="glass login-card">
        <img src="LogoNew.svg" alt="Logo" class="brand-logo" />
        <p class="eyebrow">Admin Control Panel</p>
        <h1 class="gradient-text">Sign In</h1>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="admin@example.com"
              autocomplete="email"
            />
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="********"
              autocomplete="current-password"
            />
          </div>

          <button class="forgot-link" type="button" (click)="onForgotPassword()" [disabled]="resetLoading()">
            {{ resetLoading() ? 'Sending reset link...' : 'Forgot password?' }}
          </button>

          @if (resetError()) {
            <p class="error">{{ resetError() }}</p>
          }

          @if (resetSuccess()) {
            <p class="success">{{ resetSuccess() }}</p>
          }

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button class="btn-primary" type="submit" [disabled]="loading()">
            {{ loading() ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>
    </main>
  `,
  styles: `
    .login-page {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    .login-card {
      width: 100%;
      max-width: 24rem;
      padding: 2rem;
      display: grid;
      gap: 1.5rem;
    }
    .brand-logo {
      height: 3rem;
      width: auto;
      justify-self: center;
    }
    .eyebrow {
      margin: 0;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.75rem;
    }
    h1 {
      margin: 0;
      font-size: 1.75rem;
    }
    form {
      display: grid;
      gap: 1rem;
    }
    .field {
      display: grid;
      gap: 0.35rem;
    }
    label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--mist);
    }
    input {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.75rem;
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
      color: var(--ink);
      font-size: 1rem;
      width: 100%;
      box-sizing: border-box;
    }
    input::placeholder {
      color: var(--mist);
    }
    .error {
      margin: 0;
      color: #ff6a4f;
      font-size: 0.875rem;
    }
    .success {
      margin: 0;
      color: #3aa06b;
      font-size: 0.875rem;
    }
    .forgot-link {
      justify-self: start;
      border: 0;
      background: transparent;
      color: var(--alpine);
      font-size: 0.85rem;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .forgot-link:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-primary {
      border: 0;
      border-radius: var(--radius-md);
      padding: 0.7rem 1rem;
      background: var(--ember);
      color: var(--paper);
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    this.authService.user$.pipe(
      filter((user) => user !== undefined),
      take(1),
    ).subscribe((user) => {
      if (user) this.router.navigate(['/']);
    });
  }

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resetLoading = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetSuccess = signal<string | null>(null);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.resetError.set(null);
    this.resetSuccess.set(null);

    try {
      await this.authService.login(
        this.form.controls.email.value,
        this.form.controls.password.value,
      );
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      this.error.set(this.parseFirebaseError(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onForgotPassword(): Promise<void> {
    const emailControl = this.form.controls.email;
    this.resetError.set(null);
    this.resetSuccess.set(null);

    if (emailControl.invalid) {
      emailControl.markAsTouched();
      this.resetError.set('Enter a valid email first, then request a reset link.');
      return;
    }

    this.resetLoading.set(true);
    try {
      const email = emailControl.value.trim();
      await this.authService.sendPasswordReset(email);
      this.resetSuccess.set(`Email sent! Remember to check your spam.`);
    } catch (err: unknown) {
      this.resetError.set(this.parseResetError(err));
    } finally {
      this.resetLoading.set(false);
    }
  }

  private parseFirebaseError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = String((err as { code?: string }).code);
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        return 'Invalid email or password.';
      }
      if (code === 'auth/too-many-requests') {
        return 'Too many attempts. Please try again later.';
      }
      if (code === 'auth/network-request-failed') {
        return 'Network error. Check your connection and try again.';
      }
    }
    return 'Sign in failed. Please try again.';
  }

  private parseResetError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = String((err as { code?: string }).code);
      if (code === 'auth/invalid-email') {
        return 'Please enter a valid email address.';
      }
      if (code === 'auth/user-not-found') {
        return 'If that account exists, a reset email will arrive shortly.';
      }
      if (code === 'auth/too-many-requests') {
        return 'Too many requests. Please try again later.';
      }
      if (code === 'auth/network-request-failed') {
        return 'Network error. Check your connection and try again.';
      }
    }
    return 'Could not send reset email. Please try again.';
  }
}
