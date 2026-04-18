import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="settings-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1 class="gradient-text">Settings</h1>
          <p class="lead">Manage your account details and sign-in access.</p>
        </div>
      </div>

      <section class="glass section-card">
        <h2>Account Details</h2>
        <dl class="details-grid">
          <div>
            <dt>Email</dt>
            <dd>{{ userEmail() || 'Not available' }}</dd>
          </div>
          <div>
            <dt>Display Name</dt>
            <dd>{{ displayedName() || 'Not set' }}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd class="mono">{{ currentUser()?.uid || 'Not available' }}</dd>
          </div>
        </dl>
      </section>

      <section class="glass section-card">
        <h2>Profile</h2>
        <form [formGroup]="displayNameForm" (ngSubmit)="saveDisplayName()">
          <label for="displayName">Display name</label>
          <input
            id="displayName"
            type="text"
            formControlName="displayName"
            placeholder="Your display name"
            autocomplete="name"
          />
          @if (displayNameError()) {
            <p class="error">{{ displayNameError() }}</p>
          }
          @if (displayNameSuccess()) {
            <p class="success">{{ displayNameSuccess() }}</p>
          }
          <button class="btn-primary" type="submit" [disabled]="savingDisplayName() || displayNameForm.invalid">
            {{ savingDisplayName() ? 'Saving…' : 'Save display name' }}
          </button>
        </form>
      </section>

      <section class="glass section-card">
        <h2>Password</h2>
        <p class="muted">
          Send a password reset link to <strong>{{ userEmail() || 'your account email' }}</strong>.
        </p>
        @if (resetError()) {
          <p class="error">{{ resetError() }}</p>
        }
        @if (resetSuccess()) {
          <p class="success">{{ resetSuccess() }}</p>
        }
        <button class="btn-secondary" type="button" (click)="sendResetPassword()" [disabled]="sendingReset() || !userEmail()">
          {{ sendingReset() ? 'Sending…' : 'Send reset password email' }}
        </button>
      </section>
    </main>
  `,
  styles: `
    .settings-page {
      max-width: 60rem;
      margin: 0 auto;
      padding: 3rem 1.5rem 5rem;
      display: grid;
      gap: 1.2rem;
      align-content: start;
    }
    .page-header h1 {
      margin: 0.2rem 0 0.3rem;
      font-size: clamp(1.75rem, 3.5vw, 2.5rem);
      line-height: 1.1;
    }
    .eyebrow {
      margin: 0;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
    }
    .lead {
      margin: 0;
      color: var(--mist);
      font-size: 0.9rem;
      line-height: 1.55;
    }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    .section-card {
      padding: 1.25rem;
      display: grid;
      gap: 0.8rem;
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .details-grid {
      margin: 0;
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    }
    dt {
      font-size: 0.78rem;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.2rem;
    }
    dd {
      margin: 0;
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    }
    form {
      display: grid;
      gap: 0.75rem;
      max-width: 30rem;
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
    .muted {
      margin: 0;
      color: var(--mist);
      font-size: 0.9rem;
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
    .btn-primary,
    .btn-secondary {
      justify-self: start;
      border-radius: var(--radius-md);
      padding: 0.6rem 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-primary {
      border: 0;
      background: var(--ember);
      color: var(--paper);
    }
    .btn-secondary {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--ink);
    }
    .btn-primary:disabled,
    .btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class SettingsComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly subscriptions = new Subscription();
  readonly currentUser = toSignal(this.authService.user$);

  readonly savingDisplayName = signal(false);
  readonly displayNameError = signal<string | null>(null);
  readonly displayNameSuccess = signal<string | null>(null);
  readonly sendingReset = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetSuccess = signal<string | null>(null);

  readonly displayNameForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
  });

  readonly userEmail = computed(() => this.currentUser()?.email ?? null);
  readonly displayedName = signal<string | null>(null);

  constructor() {
    this.subscriptions.add(
      this.authService.user$.subscribe((user) => {
        const authName = user?.displayName?.trim() ?? '';
        if (authName) {
          this.displayedName.set(authName);
          const currentValue = this.displayNameForm.controls.displayName.value.trim();
          if (!currentValue) {
            this.displayNameForm.controls.displayName.setValue(authName);
          }
        }
      }),
    );
  }

  async saveDisplayName(): Promise<void> {
    if (this.displayNameForm.invalid) {
      this.displayNameForm.markAllAsTouched();
      return;
    }

    this.savingDisplayName.set(true);
    this.displayNameError.set(null);
    this.displayNameSuccess.set(null);

    try {
      const displayName = this.displayNameForm.controls.displayName.value.trim();
      await this.authService.updateDisplayName(displayName);
      this.displayNameForm.controls.displayName.setValue(displayName);
      this.displayedName.set(displayName);
      this.displayNameSuccess.set('Display name updated.');
    } catch (error: unknown) {
      this.displayNameError.set(this.parseError(error, 'Could not update display name.'));
    } finally {
      this.savingDisplayName.set(false);
    }
  }

  async sendResetPassword(): Promise<void> {
    const email = this.userEmail();
    if (!email) {
      this.resetError.set('No account email is available for this user.');
      this.resetSuccess.set(null);
      return;
    }

    this.sendingReset.set(true);
    this.resetError.set(null);
    this.resetSuccess.set(null);

    try {
      await this.authService.sendPasswordReset(email);
      this.resetSuccess.set(`Email sent! Remember to check your spam.`);
    } catch (error: unknown) {
      this.resetError.set(this.parseError(error, 'Could not send password reset email.'));
    } finally {
      this.sendingReset.set(false);
    }
  }

  private parseError(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = String((error as { code?: string }).code);
      if (code === 'auth/too-many-requests') {
        return 'Too many requests. Please try again later.';
      }
      if (code === 'auth/network-request-failed') {
        return 'Network error. Check your connection and try again.';
      }
      if (code === 'auth/invalid-email') {
        return 'Please enter a valid email address.';
      }
    }
    return fallback;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
