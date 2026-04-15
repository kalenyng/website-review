import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReviewRepository } from '../../core/data/review.repository';
import { normalizeHttpUrl } from '../../core/utils/url.util';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-create-review',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="wrap">
      <section class="card">
        <h1>Create website review</h1>
        <p>Enter a URL to start an annotation session.</p>
        <form [formGroup]="form" (ngSubmit)="createSession()">
          <label for="targetUrl">Website URL</label>
          <input id="targetUrl" formControlName="targetUrl" placeholder="https://example.com" />
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <button type="submit" [disabled]="isSubmitting()">Start review</button>
        </form>
      </section>
    </main>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f5f7fa;
      padding: 1rem;
    }
    .card {
      width: min(560px, 100%);
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    form {
      display: grid;
      gap: 0.75rem;
    }
    input {
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      padding: 0.65rem 0.75rem;
    }
    button {
      width: fit-content;
    }
    .error {
      color: #b42318;
      margin: 0;
    }
  `,
})
export class CreateReviewComponent {
  private readonly reviewRepository = inject(ReviewRepository);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    targetUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async createSession(): Promise<void> {
    const rawUrl = this.form.controls.targetUrl.value;
    const normalized = normalizeHttpUrl(rawUrl);
    if (!normalized) {
      this.error.set('Please enter a valid http(s) URL.');
      return;
    }

    this.error.set(null);
    this.isSubmitting.set(true);
    try {
      if (this.isFirebaseConfigPlaceholder()) {
        throw new Error('FIREBASE_CONFIG_MISSING');
      }
      const session = await this.reviewRepository.createSession(normalized);
      const navigated = await this.router.navigate(['/review-workspace', session.id]);
      if (!navigated) {
        this.error.set('Session was created, but navigation failed. Open /review-workspace/' + session.id);
      }
    } catch (err: unknown) {
      this.error.set(this.mapCreateError(err));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private isFirebaseConfigPlaceholder(): boolean {
    return Object.values(environment.firebase).some((value) => value === 'replace-me');
  }

  private mapCreateError(err: unknown): string {
    if (err instanceof Error && err.message === 'FIREBASE_CONFIG_MISSING') {
      return 'Firebase config is missing. Update src/environments/environment.ts with real project keys.';
    }

    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = String((err as { code?: string }).code);
      if (code.includes('permission-denied')) {
        return 'Permission denied by Firestore rules. Verify your rules and project configuration.';
      }
      if (code.includes('unavailable')) {
        return 'Firestore is unavailable right now. Check network/emulator and try again.';
      }
      return `Unable to create review session (${code}).`;
    }

    return 'Unable to create review session. Check Firebase settings and try again.';
  }
}
