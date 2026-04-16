import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
              placeholder="••••••••"
              autocomplete="current-password"
            />
          </div>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button class="btn-primary" type="submit" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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

    try {
      await this.authService.login(
        this.form.controls.email.value,
        this.form.controls.password.value,
      );
      await this.router.navigate(['/workspace']);
    } catch (err: unknown) {
      this.error.set(this.parseFirebaseError(err));
    } finally {
      this.loading.set(false);
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
}
