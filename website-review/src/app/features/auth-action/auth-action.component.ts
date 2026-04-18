import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '../../core/data/firebase-db';

type PageState = 'loading' | 'reset-form' | 'success' | 'error';

@Component({
  selector: 'app-auth-action',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="action-page">
      <div class="glass action-card">
        <img src="LogoNew.svg" alt="Logo" class="brand-logo" />

        @switch (state()) {
          @case ('loading') {
            <p class="status-text muted">Verifying link…</p>
          }

          @case ('reset-form') {
            <p class="eyebrow">Password Reset</p>
            <h1 class="gradient-text">New Password</h1>
            @if (resetEmail()) {
              <p class="hint-email">{{ resetEmail() }}</p>
            }
            <form (ngSubmit)="submitReset()">
              <div class="field">
                <label for="password">New password</label>
                <input
                  id="password"
                  type="password"
                  [formControl]="passwordControl"
                  placeholder="Min. 8 chars, 1 uppercase, 1 special"
                  autocomplete="new-password"
                />
                @if (passwordControl.touched) {
                  @if (passwordControl.hasError('minlength')) {
                    <span class="field-error">Must be at least 8 characters</span>
                  } @else if (passwordControl.hasError('missingUppercase')) {
                    <span class="field-error">Must contain at least one uppercase letter</span>
                  } @else if (passwordControl.hasError('missingSpecial')) {
                    <span class="field-error">Must contain at least one special character</span>
                  }
                }
              </div>
              @if (errorMsg()) {
                <p class="error">{{ errorMsg() }}</p>
              }
              <button class="btn-primary" type="submit" [disabled]="submitting()">
                {{ submitting() ? 'Saving…' : 'Set new password' }}
              </button>
            </form>
          }

          @case ('success') {
            <p class="eyebrow">All done</p>
            <h1 class="gradient-text">{{ successHeading() }}</h1>
            <p class="hint-text">{{ successBody() }}</p>
            <a routerLink="/login" class="btn-primary">Go to sign in</a>
          }

          @case ('error') {
            <p class="eyebrow">Something went wrong</p>
            <h1 class="gradient-text">Link Invalid</h1>
            <p class="hint-text">{{ errorMsg() }}</p>
            <a routerLink="/login" class="btn-primary">Back to sign in</a>
          }
        }
      </div>
    </main>
  `,
  styles: `
    .action-page {
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
    .action-card {
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
    .hint-email {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mist);
    }
    .hint-text {
      margin: 0;
      font-size: 0.9rem;
      color: var(--mist);
      line-height: 1.5;
    }
    .status-text {
      margin: 0;
      font-size: 0.9rem;
    }
    .muted { color: var(--mist); }
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
    input::placeholder { color: var(--mist); }
    .field-error {
      font-size: 0.78rem;
      color: #ff6a4f;
    }
    .error {
      margin: 0;
      color: #ff6a4f;
      font-size: 0.875rem;
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
      text-align: center;
      text-decoration: none;
      display: block;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class AuthActionComponent implements OnInit {
  private readonly router = inject(Router);

  readonly state = signal<PageState>('loading');
  readonly resetEmail = signal<string | null>(null);
  readonly successHeading = signal('');
  readonly successBody = signal('');
  readonly errorMsg = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly passwordControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(8),
      (c: AbstractControl): ValidationErrors | null =>
        /[A-Z]/.test(c.value) ? null : { missingUppercase: true },
      (c: AbstractControl): ValidationErrors | null =>
        /[^A-Za-z0-9]/.test(c.value) ? null : { missingSpecial: true },
    ],
  });

  private oobCode = '';

  async ngOnInit(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    this.oobCode = params.get('oobCode') ?? '';

    if (!mode || !this.oobCode) {
      this.errorMsg.set('This link is missing required parameters. Please request a new one.');
      this.state.set('error');
      return;
    }

    try {
      switch (mode) {
        case 'resetPassword':
          await this.initResetPassword();
          break;
        case 'verifyEmail':
          await this.handleVerifyEmail();
          break;
        case 'recoverEmail':
          await this.handleRecoverEmail();
          break;
        default:
          this.errorMsg.set('Unknown action type. Please request a new link.');
          this.state.set('error');
      }
    } catch (err: unknown) {
      this.errorMsg.set(this.parseError(err));
      this.state.set('error');
    }
  }

  private async initResetPassword(): Promise<void> {
    const email = await verifyPasswordResetCode(auth, this.oobCode);
    this.resetEmail.set(email);
    this.state.set('reset-form');
  }

  private async handleVerifyEmail(): Promise<void> {
    await applyActionCode(auth, this.oobCode);
    this.successHeading.set('Email Verified');
    this.successBody.set('Your email address has been verified. You can now sign in.');
    this.state.set('success');
  }

  private async handleRecoverEmail(): Promise<void> {
    await applyActionCode(auth, this.oobCode);
    this.successHeading.set('Email Recovered');
    this.successBody.set('Your email address has been restored. You can now sign in with your original address.');
    this.state.set('success');
  }

  async submitReset(): Promise<void> {
    this.passwordControl.markAsTouched();
    if (this.passwordControl.invalid) return;

    this.submitting.set(true);
    this.errorMsg.set(null);

    try {
      await confirmPasswordReset(auth, this.oobCode, this.passwordControl.value);
      this.successHeading.set('Password Updated');
      this.successBody.set('Your password has been changed. You can now sign in with your new password.');
      this.state.set('success');
    } catch (err: unknown) {
      this.errorMsg.set(this.parseError(err));
    } finally {
      this.submitting.set(false);
    }
  }

  private parseError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = String((err as { code?: string }).code);
      if (code === 'auth/expired-action-code') return 'This link has expired. Please request a new one.';
      if (code === 'auth/invalid-action-code') return 'This link is invalid or has already been used.';
      if (code === 'auth/user-disabled') return 'This account has been disabled.';
      if (code === 'auth/user-not-found') return 'No account found for this link.';
      if (code === 'auth/weak-password') return 'Password is too weak. Please choose a stronger one.';
    }
    return 'Something went wrong. Please request a new link.';
  }
}
