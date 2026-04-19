import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="admin-nav" [class.admin-nav--drawer]="layout === 'drawer'" [class.admin-nav--inline]="layout === 'inline'">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">Workspace</a>
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
    }
    .admin-nav--inline {
      flex-wrap: wrap;
    }
    .admin-nav--drawer {
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
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
    .admin-nav--drawer .nav-link {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 0.65rem 1rem;
      font-size: 1rem;
    }
    .nav-link:hover,
    .nav-link.active {
      color: var(--ink);
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
    }
  `,
})
export class AdminNavComponent {
  @Input() layout: 'inline' | 'drawer' = 'inline';
}
