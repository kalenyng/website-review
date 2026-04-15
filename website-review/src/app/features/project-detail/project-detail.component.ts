import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommentRepository } from '../../core/data/comment.repository';
import { ReviewRepository } from '../../core/data/review.repository';
import { ReviewComment, ReviewProject } from '../../core/models/review.models';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="page">
      <a class="back" routerLink="/admin">← Back to projects</a>

      @if (project()) {
        <section class="glass header">
          <div>
            <h1>{{ project()?.name }}</h1>
            <p>
              Live site:
              <a [href]="project()?.targetUrl" target="_blank" rel="noopener">{{ project()?.targetUrl }}</a>
            </p>
          </div>
          <a class="btn" [href]="project()?.targetUrl" target="_blank" rel="noopener">Open live site</a>
        </section>
      }

      <section class="glass comments">
        <div class="comments-head">
          <h2>Comments</h2>
          <span class="muted">{{ comments().length }} total</span>
        </div>
        <ul>
          @for (comment of comments(); track comment.id) {
            <li [class.resolved]="comment.status === 'resolved'">
              <div class="meta">
                <strong>{{ comment.createdBy }}</strong>
                <small>{{ comment.createdAt | date: 'MMM d, y h:mm a' }}</small>
              </div>
              <p>{{ comment.message }}</p>
              <div class="actions">
                <span class="status">{{ comment.status }}</span>
                <button type="button" (click)="toggleStatus(comment)">
                  {{ comment.status === 'open' ? 'Resolve' : 'Reopen' }}
                </button>
              </div>
            </li>
          } @empty {
            <li class="empty">No comments for this project yet.</li>
          }
        </ul>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </section>
    </main>
  `,
  styles: `
    .page {
      max-width: 80rem;
      margin: 0 auto;
      padding: 5rem 1rem;
      display: grid;
      gap: 1rem;
    }
    .back {
      color: var(--mist);
      text-decoration: none;
      width: fit-content;
    }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
      transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .glass:hover {
      transform: translateY(-2px);
    }
    .header {
      padding: 1rem 1.1rem;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .header a {
      color: var(--alpine);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .btn {
      border-radius: var(--radius-md);
      padding: 0.55rem 0.9rem;
      background: var(--ember);
      color: var(--paper) !important;
      font-weight: 600;
    }
    .comments {
      padding: 1rem;
    }
    .comments-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.8rem;
    }
    .muted {
      color: var(--mist);
      font-size: 0.9rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.7rem;
    }
    li {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.75rem;
      background: color-mix(in srgb, var(--paper) 88%, white 12%);
    }
    li.resolved {
      opacity: 0.7;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    small {
      color: var(--mist);
    }
    p {
      line-height: 1.6;
      color: var(--ink);
    }
    .actions {
      margin-top: 0.55rem;
      display: flex;
      justify-content: space-between;
      gap: 0.7rem;
      align-items: center;
    }
    .status {
      color: var(--mist);
      text-transform: capitalize;
      font-size: 0.85rem;
    }
    button {
      border: 1px solid var(--ember);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--ember);
      padding: 0.4rem 0.7rem;
      cursor: pointer;
      font-weight: 600;
    }
    .empty {
      color: var(--mist);
      text-align: center;
    }
    .error {
      color: #ff6a4f;
      margin: 0.75rem 0 0;
    }
  `,
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly reviewRepository = inject(ReviewRepository);
  private readonly commentRepository = inject(CommentRepository);
  private readonly subscriptions = new Subscription();

  readonly project = signal<ReviewProject | null>(null);
  readonly comments = signal<ReviewComment[]>([]);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (!projectId) {
      this.error.set('Missing project id.');
      return;
    }

    const project = await this.reviewRepository.getProjectById(projectId);
    if (!project) {
      this.error.set('Project not found.');
      return;
    }
    this.project.set(project);

    this.subscriptions.add(
      this.commentRepository.watchProjectComments(projectId).subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.error.set(null);
        },
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

  async toggleStatus(comment: ReviewComment): Promise<void> {
    try {
      await this.commentRepository.setCommentStatus(
        comment.id,
        comment.status === 'open' ? 'resolved' : 'open',
      );
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Unable to update status (${code}).`);
    }
  }
}
