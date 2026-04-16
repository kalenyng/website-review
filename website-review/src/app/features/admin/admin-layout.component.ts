import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminNavComponent],
  template: `
    <header class="admin-header">
      <div class="header-left">
        <img src="LogoNew.svg" alt="Logo" class="brand-logo" />
        <app-admin-nav />
      </div>
      <div class="header-right">
        @if (currentUser()?.email) {
          <span class="user-email">{{ currentUser()!.email }}</span>
        }
        <button class="btn-logout" type="button" (click)="logout()">Sign out</button>
      </div>
    </header>
    <div class="layout-body">
      <router-outlet />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    .admin-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 1.5rem;
      background: color-mix(in srgb, var(--paper) 92%, transparent 8%);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .brand-logo {
      height: 2rem;
      width: auto;
      display: block;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .user-email {
      font-size: 0.82rem;
      color: var(--mist);
    }
    .btn-logout {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.35rem 0.75rem;
      background: transparent;
      color: var(--mist);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-logout:hover {
      color: var(--ink);
      border-color: var(--ink);
    }
    .layout-body {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  `,
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  readonly currentUser = toSignal(this.authService.user$);

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
