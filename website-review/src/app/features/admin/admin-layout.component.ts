import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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
        <app-admin-nav layout="inline" class="nav-desktop" />
      </div>
      <div class="header-right">
        <button
          #menuToggle
          type="button"
          class="menu-toggle"
          [attr.aria-label]="menuOpen() ? 'Close menu' : 'Open menu'"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="admin-nav-drawer"
          (click)="toggleMenu()"
        >
          <span class="menu-icon" aria-hidden="true"></span>
        </button>
        @if (currentUser()?.email) {
          <span class="user-email user-email--desktop">{{ currentUser()!.email }}</span>
        }
        <button class="btn-logout btn-logout--desktop" type="button" (click)="logout()">Sign out</button>
      </div>
    </header>

    <div
      class="drawer-backdrop"
      [class.drawer-backdrop--visible]="menuOpen()"
      (click)="closeMenu()"
      aria-hidden="true"
    ></div>

    <aside
      id="admin-nav-drawer"
      class="drawer-panel"
      [class.drawer-panel--open]="menuOpen()"
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
      [attr.inert]="menuOpen() ? null : ''"
    >
      <div class="drawer-header">
        <span class="drawer-title">Menu</span>
        <button #drawerClose type="button" class="btn-drawer-close" (click)="closeMenu()">Close</button>
      </div>
      <div class="drawer-nav">
        <div class="drawer-nav-scroll">
          <app-admin-nav layout="drawer" />
        </div>
        <div class="drawer-nav-actions">
          <button type="button" class="btn-logout btn-logout--drawer" (click)="logoutFromDrawer()">Sign out</button>
        </div>
      </div>
    </aside>

    <div class="layout-body">
      <router-outlet />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      width: 100%;
      max-width: 100%;
      overflow-x: clip;
      box-sizing: border-box;
    }
    .admin-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.6rem 1rem;
      padding: max(0.6rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right))
        max(0.6rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left));
      max-width: 100%;
      box-sizing: border-box;
      background: color-mix(in srgb, var(--paper) 92%, transparent 8%);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
      flex-wrap: wrap;
      flex: 1 1 auto;
    }
    .brand-logo {
      height: 2rem;
      width: auto;
      max-width: min(9rem, 42vw);
      object-fit: contain;
      display: block;
      flex-shrink: 0;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: auto;
      flex-shrink: 0;
    }
    .user-email {
      font-size: 0.82rem;
      color: var(--mist);
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn-logout {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.45rem 0.85rem;
      min-height: 40px;
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
    .menu-toggle {
      display: none;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      margin: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--ember);
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      -webkit-tap-highlight-color: transparent;
      outline: none !important;
      outline-offset: 0;
      box-shadow: none !important;
    }
    .menu-toggle::-moz-focus-inner {
      border: 0;
      padding: 0;
    }
    .menu-toggle:hover,
    .menu-toggle:focus,
    .menu-toggle:focus-visible,
    .menu-toggle:active {
      border: none;
      background: transparent;
      color: var(--ember);
      outline: none !important;
      outline-offset: 0;
      box-shadow: none !important;
    }
    .menu-icon {
      position: relative;
      width: 1.125rem;
      height: 2px;
      background: currentColor;
      border-radius: 1px;
    }
    .menu-icon::before,
    .menu-icon::after {
      content: '';
      position: absolute;
      left: 0;
      width: 100%;
      height: 2px;
      background: currentColor;
      border-radius: 1px;
    }
    .menu-icon::before {
      top: -6px;
    }
    .menu-icon::after {
      top: 6px;
    }
    .drawer-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 18;
      background: rgba(0, 0, 0, 0.45);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .drawer-backdrop--visible {
      opacity: 1;
    }
    .drawer-panel {
      display: none;
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 19;
      width: min(18rem, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
      max-width: 100%;
      flex-direction: column;
      padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
        max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
      background: color-mix(in srgb, var(--paper) 96%, transparent 4%);
      border-left: 1px solid var(--border);
      box-shadow: -12px 0 40px rgba(0, 0, 0, 0.35);
      transform: translateX(100%);
      transition: transform 0.22s ease;
    }
    .drawer-panel--open {
      transform: translateX(0);
    }
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .drawer-title {
      font-weight: 600;
      font-size: 1rem;
      color: var(--ink);
    }
    .btn-drawer-close {
      min-height: 44px;
      padding: 0 1rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--mist);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-drawer-close:hover {
      color: var(--ink);
      border-color: var(--ink);
    }
    .drawer-nav {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .drawer-nav-scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .drawer-nav-actions {
      flex-shrink: 0;
      padding-top: 0.75rem;
      margin-top: 0.5rem;
      border-top: 1px solid var(--border);
    }
    .btn-logout--drawer {
      width: 100%;
      min-height: 48px;
      font-size: 0.95rem;
    }
    .layout-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      max-width: 100%;
      overflow-x: clip;
    }
    @media (max-width: 54rem) {
      .admin-header {
        padding-inline: max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-left));
        flex-wrap: nowrap;
        gap: 0.5rem;
      }
      .user-email--desktop,
      .btn-logout--desktop {
        display: none !important;
      }
      .header-left {
        flex: 1 1 auto;
        min-width: 0;
        flex-wrap: nowrap;
      }
      .brand-logo {
        max-width: min(7rem, 36vw);
      }
      .header-right {
        flex-shrink: 0;
        margin-left: 0;
      }
      .nav-desktop {
        display: none;
      }
      .menu-toggle {
        display: inline-flex;
      }
      .drawer-backdrop,
      .drawer-panel {
        display: block;
      }
      .drawer-panel {
        display: flex;
      }
      .drawer-backdrop {
        display: block;
      }
      .drawer-backdrop:not(.drawer-backdrop--visible) {
        pointer-events: none;
        opacity: 0;
      }
      .header-right {
        width: auto;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
    }
    @media (min-width: 54.0625rem) {
      .drawer-backdrop,
      .drawer-panel {
        display: none !important;
      }
    }
  `,
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = toSignal(this.authService.user$);
  readonly menuOpen = signal(false);

  private readonly menuToggleRef = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');
  private readonly drawerCloseRef = viewChild<ElementRef<HTMLButtonElement>>('drawerClose');

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.menuOpen.set(false));

    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 54.0625rem)');
      const onChange = (): void => {
        if (mq.matches) {
          this.menuOpen.set(false);
        }
      };
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    }
  }

  toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    } else {
      this.menuOpen.set(true);
      queueMicrotask(() => this.drawerCloseRef()?.nativeElement.focus());
    }
  }

  closeMenu(): void {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    queueMicrotask(() => this.menuToggleRef()?.nativeElement?.focus());
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  async logoutFromDrawer(): Promise<void> {
    this.closeMenu();
    await this.authService.logout();
  }
}
