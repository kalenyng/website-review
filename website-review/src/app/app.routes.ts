import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth',
    children: [
      {
        path: 'action',
        loadComponent: () =>
          import('./features/auth-action/auth-action.component').then(
            (m) => m.AuthActionComponent,
          ),
      },
    ],
  },
  {
    path: 'review-workspace/:sessionId',
    loadComponent: () =>
      import('./features/review-workspace/review-workspace.component').then(
        (m) => m.ReviewWorkspaceComponent,
      ),
  },
  {
    path: 'public-review/:shareToken',
    loadComponent: () =>
      import('./features/public-review/public-review.component').then(
        (m) => m.PublicReviewComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'workspace',
        pathMatch: 'full',
        redirectTo: '',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'projects/:projectId',
        loadComponent: () =>
          import('./features/project-detail/project-detail.component').then(
            (m) => m.ProjectDetailComponent,
          ),
      },
      {
        path: 'workspace/:clientId',
        redirectTo: 'client/:clientId',
        pathMatch: 'full',
      },
      {
        path: 'client/:clientId',
        loadComponent: () =>
          import('./features/client-detail/client-detail.component').then(
            (m) => m.ClientDetailComponent,
          ),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/invoices/invoices.component').then((m) => m.InvoicesComponent),
      },
      {
        path: 'care-plans',
        loadComponent: () =>
          import('./features/care-plans/care-plans.component').then((m) => m.CarePlansComponent),
      },
      {
        path: 'settings',
        component: SettingsComponent,
      },
    ],
  },
];
