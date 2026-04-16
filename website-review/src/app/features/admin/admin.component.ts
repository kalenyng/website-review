import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommentRepository } from '../../core/data/comment.repository';
import { ReviewRepository } from '../../core/data/review.repository';
import { ReviewComment, ReviewProject } from '../../core/models/review.models';
import { normalizeHttpUrl } from '../../core/utils/url.util';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard">
      <div class="page-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1 class="gradient-text">Projects</h1>
          <p class="lead">Create projects, track live feedback, and manage client sites.</p>
        </div>
      </div>

      <section class="glass create-card">
        <h2>Create New Project</h2>
        <form [formGroup]="form" (ngSubmit)="createProject()">
          <input id="projectName" formControlName="projectName" placeholder="Project name" />
          <input id="targetUrl" formControlName="targetUrl" placeholder="https://client-site.com" />
          <button class="btn-primary" type="submit" [disabled]="submitting()">Create project</button>
        </form>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </section>

      <section class="projects">
        <div class="projects-head">
          <h2>Active Projects</h2>
          <span class="muted">{{ projectCards().length }} projects</span>
        </div>
        <div class="project-grid">
          @for (project of projectCards(); track project.id) {
            <article class="glass project-card">
              @if (editingProjectId() === project.id) {
                <form class="edit-form" (ngSubmit)="saveEdit(project.id)">
                  <input [formControl]="editForm.controls.name" placeholder="Project name" />
                  <input [formControl]="editForm.controls.targetUrl" placeholder="https://client-site.com" />
                  @if (editError()) {
                    <p class="error">{{ editError() }}</p>
                  }
                  <div class="edit-actions">
                    <button class="btn-primary" type="submit" [disabled]="editSaving()">Save</button>
                    <button type="button" class="btn-ghost" (click)="cancelEdit()">Cancel</button>
                  </div>
                </form>
              } @else {
                <div class="card-header">
                  <h3><a class="clickable" [routerLink]="['/projects', project.id]">{{ project.name }}</a></h3>
                  <div class="card-controls">
                    <button type="button" class="icon-btn" title="Edit" (click)="startEdit(project)">✎</button>
                    @if (confirmingDeleteId() === project.id) {
                      <span class="delete-confirm">
                        <button type="button" class="btn-danger-sm" (click)="confirmDelete(project.id)">Delete</button>
                        <button type="button" class="btn-ghost-sm" (click)="cancelDelete()">Cancel</button>
                      </span>
                    } @else {
                      <button type="button" class="icon-btn danger" title="Delete" (click)="requestDelete(project.id)">✕</button>
                    }
                  </div>
                </div>
                <p class="project-id">
                  <span>ID:</span>
                  <code>{{ project.id }}</code>
                  <button type="button" class="copy-btn" (click)="copyProjectId(project.id)">Copy</button>
                  @if (copiedProjectId() === project.id) {
                    <span class="copy-confirm">Copied!</span>
                  }
                </p>
                <p class="review-link">
                  <span>Review link:</span>
                  <code>{{ project.targetUrl }}?review={{ project.token }}</code>
                  <button type="button" class="copy-btn" (click)="copyReviewLink(project.id, project.targetUrl, project.token)">Copy</button>
                  @if (copiedReviewLink() === project.id) {
                    <span class="copy-confirm">Copied!</span>
                  }
                </p>
                <p class="site">
                  <a [href]="project.targetUrl" target="_blank" rel="noopener">{{ project.targetUrl }}</a>
                </p>
                <div class="stats">
                  <span>{{ project.commentCount }} comments</span>
                  <span>{{ project.openCount }} open</span>
                  <span>{{ project.resolvedCount }} resolved</span>
                </div>
                <div class="actions">
                  <a class="clickable" [routerLink]="['/projects', project.id]">Manage comments</a>
                  <a class="clickable" [href]="project.targetUrl" target="_blank" rel="noopener">Open live site</a>
                </div>
              }
            </article>
          } @empty {
            <article class="glass empty">No projects yet. Create one above to start.</article>
          }
        </div>
      </section>
    </main>
  `,
  styles: `
    .dashboard {
      max-width: 72rem;
      margin: 0 auto;
      padding: 3rem 1.5rem 5rem;
      display: grid;
      gap: 1.5rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .eyebrow {
      margin: 0;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
    }
    .page-header h1 {
      margin: 0.2rem 0 0.3rem;
      font-size: clamp(1.75rem, 3.5vw, 2.5rem);
      line-height: 1.1;
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
    .create-card {
      padding: 1.2rem;
    }
    .create-card h2 {
      margin: 0 0 0.9rem;
    }
    form {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: 1fr 1fr auto;
    }
    @media (max-width: 900px) {
      form {
        grid-template-columns: 1fr;
      }
    }
    input {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.75rem;
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
      color: var(--ink);
    }
    input::placeholder {
      color: var(--mist);
    }
    .btn-primary {
      width: fit-content;
      border: 0;
      border-radius: var(--radius-md);
      padding: 0.65rem 1rem;
      background: var(--ember);
      color: var(--paper);
      font-weight: 600;
      cursor: pointer;
    }
    .error {
      margin: 0.75rem 0 0;
      color: #ff6a4f;
    }
    .projects {
      display: grid;
      gap: 1rem;
    }
    .projects-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .projects-head h2 {
      margin: 0;
    }
    .muted {
      color: var(--mist);
      font-size: 0.9rem;
    }
    .project-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(1, minmax(0, 1fr));
    }
    @media (min-width: 768px) {
      .project-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (min-width: 1080px) {
      .project-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    .project-card {
      padding: 1rem;
      display: grid;
      gap: 0.6rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .project-card h3 {
      margin: 0;
      font-size: 1.1rem;
      flex: 1;
    }
    .card-controls {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex-shrink: 0;
    }
    .icon-btn {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.2rem 0.4rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.85rem;
      line-height: 1;
      transition: color 0.15s, border-color 0.15s;
    }
    .icon-btn:hover {
      color: var(--ink);
      border-color: var(--ink);
    }
    .icon-btn.danger:hover {
      color: #ff6a4f;
      border-color: #ff6a4f;
    }
    .delete-confirm {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .btn-danger-sm {
      border: 1px solid #ff6a4f;
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: #ff6a4f;
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .btn-ghost-sm {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.78rem;
    }
    .edit-form {
      display: grid;
      gap: 0.6rem;
    }
    .edit-actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn-ghost {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 1rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.9rem;
    }
    .project-id {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
      color: var(--mist);
      font-size: 0.82rem;
    }
    .project-id code {
      color: var(--ink);
      background: color-mix(in srgb, var(--paper) 72%, white 28%);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.2rem 0.4rem;
      overflow-wrap: anywhere;
    }
    .copy-btn {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: var(--alpine);
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .copy-confirm {
      color: var(--ember);
      font-weight: 600;
      font-size: 0.78rem;
    }
    .review-link {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
      color: var(--mist);
      font-size: 0.82rem;
    }
    .review-link code {
      color: var(--ink);
      background: color-mix(in srgb, var(--paper) 72%, white 28%);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.2rem 0.4rem;
      overflow-wrap: anywhere;
    }
    .site {
      margin: 0;
      min-height: 2.5rem;
    }
    .site a {
      color: var(--alpine);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .stats {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      color: var(--mist);
      font-size: 0.82rem;
    }
    .actions {
      display: flex;
      gap: 0.9rem;
      flex-wrap: wrap;
    }
    .actions a {
      font-weight: 600;
      font-size: 0.9rem;
    }
    .empty {
      padding: 1rem;
      color: var(--mist);
    }
  `,
})
export class AdminComponent implements OnInit, OnDestroy {
  private readonly reviewRepository = inject(ReviewRepository);
  private readonly commentRepository = inject(CommentRepository);
  private readonly subscriptions = new Subscription();

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly projects = signal<ReviewProject[]>([]);
  readonly comments = signal<ReviewComment[]>([]);
  readonly copiedProjectId = signal<string | null>(null);
  readonly copiedReviewLink = signal<string | null>(null);
  readonly editingProjectId = signal<string | null>(null);
  readonly editSaving = signal(false);
  readonly editError = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);

  readonly editForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    targetUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly projectCards = computed(() =>
    this.projects().map((project) => {
      const projectComments = this.comments().filter((comment) => comment.projectId === project.id);
      return {
        ...project,
        commentCount: projectComments.length,
        openCount: projectComments.filter((comment) => comment.status === 'open').length,
        resolvedCount: projectComments.filter((comment) => comment.status === 'resolved').length,
      };
    }),
  );

  readonly form = new FormGroup({
    projectName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    targetUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.subscriptions.add(
      this.reviewRepository.watchProjects().subscribe({
        next: (projects) => this.projects.set(projects),
        error: (error: unknown) => {
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { code?: string }).code)
              : 'unknown';
          this.error.set(`Unable to load projects (${code}).`);
        },
      }),
    );
    this.subscriptions.add(
      this.commentRepository.watchAllComments().subscribe({
        next: (comments) => this.comments.set(comments),
        error: (error: unknown) => {
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { code?: string }).code)
              : 'unknown';
          this.error.set(`Unable to load comments (${code}).`);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async createProject(): Promise<void> {
    const name = this.form.controls.projectName.value.trim();
    const targetUrl = normalizeHttpUrl(this.form.controls.targetUrl.value);
    if (!name || !targetUrl) {
      this.error.set('Please enter a project name and valid http(s) URL.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.reviewRepository.createProject({ name, targetUrl });
      this.form.reset({ projectName: '', targetUrl: '' });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Could not create project (${code}).`);
    } finally {
      this.submitting.set(false);
    }
  }

  async copyProjectId(projectId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(projectId);
      this.copiedProjectId.set(projectId);
      window.setTimeout(() => {
        if (this.copiedProjectId() === projectId) {
          this.copiedProjectId.set(null);
        }
      }, 1600);
    } catch {
      this.error.set('Could not copy project ID.');
    }
  }

  async copyReviewLink(projectId: string, targetUrl: string, token: string): Promise<void> {
    const link = `${targetUrl}?review=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      this.copiedReviewLink.set(projectId);
      window.setTimeout(() => {
        if (this.copiedReviewLink() === projectId) {
          this.copiedReviewLink.set(null);
        }
      }, 1600);
    } catch {
      this.error.set('Could not copy review link.');
    }
  }

  startEdit(project: ReviewProject): void {
    this.editForm.reset({ name: project.name, targetUrl: project.targetUrl });
    this.editError.set(null);
    this.confirmingDeleteId.set(null);
    this.editingProjectId.set(project.id);
  }

  cancelEdit(): void {
    this.editingProjectId.set(null);
    this.editError.set(null);
  }

  async saveEdit(projectId: string): Promise<void> {
    const name = this.editForm.controls.name.value.trim();
    const targetUrl = normalizeHttpUrl(this.editForm.controls.targetUrl.value);
    if (!name || !targetUrl) {
      this.editError.set('Please enter a valid name and http(s) URL.');
      return;
    }

    this.editSaving.set(true);
    this.editError.set(null);
    try {
      await this.reviewRepository.updateProject(projectId, { name, targetUrl });
      this.editingProjectId.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.editError.set(`Could not save changes (${code}).`);
    } finally {
      this.editSaving.set(false);
    }
  }

  requestDelete(projectId: string): void {
    this.editingProjectId.set(null);
    this.confirmingDeleteId.set(projectId);
  }

  cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  async confirmDelete(projectId: string): Promise<void> {
    try {
      await this.reviewRepository.deleteProject(projectId);
      this.confirmingDeleteId.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Could not delete project (${code}).`);
    }
  }
}
