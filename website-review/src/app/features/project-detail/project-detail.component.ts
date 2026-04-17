import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import { Subscription } from 'rxjs';
import { auth, db } from '../../core/data/firebase-db';
import { CommentRepository } from '../../core/data/comment.repository';
import { ReviewRepository } from '../../core/data/review.repository';
import { ReviewComment, ReviewProject } from '../../core/models/review.models';
import { CommentThreadComponent } from '../review-workspace/components/comment-thread/comment-thread.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, CommentThreadComponent],
  template: `
    <main class="page">
      <a class="back" routerLink="/projects">← Back to Projects</a>

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

      <section class="glass comments-section">
        <div class="comments-head">
          <h2>Comments</h2>
          <span class="muted">{{ comments().length }} total</span>
        </div>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <app-comment-thread
          [comments]="comments()"
          [currentUser]="currentUser()"
          [showComposer]="false"
          [allowDelete]="true"
          (addReply)="createReply($event.parentId, $event.authorDisplayName, $event.body)"
          (toggleStatus)="toggleStatus($event)"
          (deleteComment)="removeComment($event)"
        />
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
    .comments-section {
      padding: 1rem;
      overflow: hidden;
    }
    .comments-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .muted {
      color: var(--mist);
      font-size: 0.9rem;
    }
    .error {
      color: #ff6a4f;
      margin: 0 0 0.75rem;
    }
    /* Override CommentThreadComponent sidebar styles for page context */
    app-comment-thread {
      display: block;
    }
    :host ::ng-deep app-comment-thread .thread {
      width: 100%;
      max-height: none;
      border-left: none;
      padding: 0;
      background: transparent;
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
  readonly currentUser = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (uid) {
      const userSnap = await getDoc(doc(db, 'users', uid));
      const displayName = userSnap.exists()
        ? String(userSnap.data()['displayName'] ?? '')
        : null;
      this.currentUser.set(displayName || auth.currentUser?.email || null);
    }

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

  async createComment(authorDisplayName: string, body: string): Promise<void> {
    const project = this.project();
    if (!project) return;

    try {
      await this.commentRepository.addProjectComment({
        projectId: project.id,
        createdBy: authorDisplayName,
        message: body,
      });
      this.error.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Unable to post comment (${code}).`);
    }
  }

  async createReply(parentId: string, authorDisplayName: string, body: string): Promise<void> {
    const project = this.project();
    if (!project) return;

    try {
      await this.commentRepository.addProjectComment({
        projectId: project.id,
        createdBy: authorDisplayName,
        message: body,
        parentId,
      });
      this.error.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Unable to post reply (${code}).`);
    }
  }

  async removeComment(comment: ReviewComment): Promise<void> {
    try {
      await this.commentRepository.deleteComment(comment.id);
      this.error.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Unable to delete comment (${code}).`);
    }
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
