import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="admin-nav">
      <a routerLink="/workspace" routerLinkActive="active" class="nav-link">Workspace</a>
      <a routerLink="/projects" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">Projects</a>
      <a routerLink="/billing" routerLinkActive="active" class="nav-link">Billing</a>
      <a routerLink="/care-plans" routerLinkActive="active" class="nav-link">Care Plans</a>
      <a routerLink="/settings" routerLinkActive="active" class="nav-link">Settings</a>
    </nav>
  `,
  styles: `
    .admin-nav {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    .nav-link {
      padding: 0.45rem 0.9rem;
      border-radius: var(--radius-md);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--mist);
      transition: color 0.15s, background 0.15s;
    }
    .nav-link:hover,
    .nav-link.active {
      color: var(--ink);
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
    }
  `,
})
export class AdminNavComponent {}
