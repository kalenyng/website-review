import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { CommentRepository } from '../../core/data/comment.repository';
import { ReviewRepository } from '../../core/data/review.repository';
import { ReviewComment, ReviewSession } from '../../core/models/review.models';
import { CommentThreadComponent } from '../review-workspace/components/comment-thread/comment-thread.component';

@Component({
  selector: 'app-public-review',
  standalone: true,
  imports: [CommentThreadComponent],
  template: `
    <div class="workspace">
      <section class="viewer">
        @if (session()) {
          <header class="toolbar">
            <strong>Public review</strong>
            <span>{{ session()?.targetUrl }}</span>
          </header>
          <iframe [src]="safeTargetUrl()" title="Public review target"></iframe>
        } @else {
          <p class="loading">Loading shared session...</p>
        }
      </section>

      <app-comment-thread
        [comments]="comments()"
        (add)="createComment($event.authorDisplayName, $event.body)"
        (toggleStatus)="toggleStatus($event)"
      />
      @if (commentError()) {
        <p class="error">{{ commentError() }}</p>
      }
    </div>
  `,
  styles: `
    .workspace {
      display: grid;
      grid-template-columns: 1fr 320px;
      min-height: 100vh;
    }
    .toolbar {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #ececec;
      display: flex;
      gap: 0.75rem;
      font-size: 0.9rem;
    }
    iframe {
      width: 100%;
      height: calc(100vh - 40px);
      border: none;
    }
    .loading {
      padding: 1rem;
    }
    .error {
      margin: 0;
      padding: 0.75rem;
      color: #b42318;
      background: #fef3f2;
      border-top: 1px solid #fcd8d4;
      grid-column: 1 / -1;
    }
  `,
})
export class PublicReviewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly reviewRepository = inject(ReviewRepository);
  private readonly commentRepository = inject(CommentRepository);
  private readonly subscriptions = new Subscription();

  readonly session = signal<ReviewSession | null>(null);
  readonly comments = signal<ReviewComment[]>([]);
  readonly commentError = signal<string | null>(null);
  readonly safeTargetUrl = signal(this.sanitizer.bypassSecurityTrustResourceUrl('about:blank'));

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('shareToken');
    if (!token) {
      return;
    }

    const session = await this.reviewRepository.getSessionByToken(token);
    if (!session) {
      return;
    }

    this.session.set(session);
    this.safeTargetUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(session.targetUrl));
    this.subscriptions.add(
      this.commentRepository
        .watchSessionComments(session.id)
        .subscribe({
          next: (comments) => {
            this.commentError.set(null);
            this.comments.set(comments);
          },
          error: (error: unknown) => {
            const code =
              typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code?: string }).code)
                : 'unknown';
            this.commentError.set(`Unable to load comments (${code}).`);
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async createComment(authorDisplayName: string, body: string): Promise<void> {
    const session = this.session();
    if (!session) {
      return;
    }

    try {
      await this.commentRepository.addComment({
        projectId: session.projectId,
        sessionId: session.id,
        createdBy: authorDisplayName,
        message: body,
        x: 0.3,
        y: 0.3,
        anchor: {
          cssPath: 'body',
          textSnippet: body.slice(0, 120),
          rect: { x: 30, y: 30, width: 0, height: 0 },
        },
      });
      this.commentError.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.commentError.set(`Unable to post comment (${code}).`);
    }
  }

  async toggleStatus(comment: ReviewComment): Promise<void> {
    try {
      await this.commentRepository.setCommentStatus(
        comment.id,
        comment.status === 'open' ? 'resolved' : 'open',
      );
      this.commentError.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.commentError.set(`Unable to update comment (${code}).`);
    }
  }
}
