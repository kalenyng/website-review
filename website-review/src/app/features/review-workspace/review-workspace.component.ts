import { Component, OnDestroy, OnInit, SecurityContext, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { DomAnchorService } from '../../core/annotation/dom-anchor.service';
import { CommentRepository } from '../../core/data/comment.repository';
import { ReviewRepository } from '../../core/data/review.repository';
import { CommentAnchor, ReviewComment, ReviewSession } from '../../core/models/review.models';
import { CommentThreadComponent } from './components/comment-thread/comment-thread.component';

@Component({
  selector: 'app-review-workspace',
  standalone: true,
  imports: [CommentThreadComponent],
  template: `
    <div class="workspace">
      <section class="viewer">
        @if (session()) {
          <header class="toolbar">
            <strong>Session:</strong> {{ session()?.id }}
            <span>|</span>
            <a [href]="session()?.targetUrl" target="_blank" rel="noopener">Open target</a>
            <span>|</span>
            <code>{{ shareUrl() }}</code>
          </header>
          @if (iframeBlocked()) {
            <div class="fallback">
              This URL cannot be embedded due to frame restrictions. Use "Open target" and continue
              commenting with fallback marker positions.
            </div>
          }
          <div class="frame-wrap" (click)="captureOverlayClick($event)">
            <iframe
              #pageFrame
              [src]="safeTargetUrl()"
              (error)="iframeBlocked.set(true)"
              sandbox="allow-forms allow-scripts allow-popups allow-same-origin"
              referrerpolicy="no-referrer"
              title="Review target"
            ></iframe>
            @for (comment of comments(); track comment.id) {
              <button
                type="button"
                class="pin"
                [style.left.%]="comment.x * 100"
                [style.top.%]="comment.y * 100"
                [class.resolved]="comment.status === 'resolved'"
                (click)="$event.preventDefault()"
              >
                {{ comment.status === 'open' ? '!' : '✓' }}
              </button>
            }
          </div>
          @if (commentError()) {
            <p class="error">{{ commentError() }}</p>
          }
        } @else {
          <p class="loading">Loading session...</p>
        }
      </section>

      <app-comment-thread
        [comments]="comments()"
        (add)="createComment($event.authorDisplayName, $event.body)"
        (addReply)="createReply($event.parentId, $event.authorDisplayName, $event.body)"
        (toggleStatus)="toggleStatus($event)"
      />
    </div>
  `,
  styles: `
    .workspace {
      display: grid;
      grid-template-columns: 1fr minmax(0, 320px);
      grid-template-rows: minmax(0, 1fr);
      min-height: 100dvh;
      height: 100dvh;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #ececec;
      align-items: center;
      font-size: 0.9rem;
      row-gap: 0.35rem;
    }
    .toolbar code {
      max-width: 100%;
      overflow: auto;
      font-size: 0.78rem;
    }
    .viewer {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-width: 0;
      min-height: 0;
    }
    .frame-wrap {
      position: relative;
      background: #eef2f6;
      overflow: hidden;
      min-height: 0;
    }
    iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }
    .pin {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 999px;
      border: none;
      background: #e62828;
      color: white;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .pin.resolved {
      background: #0d8b4b;
    }
    .fallback {
      padding: 0.5rem 1rem;
      background: #fff7d9;
      border-bottom: 1px solid #f5d67b;
      font-size: 0.875rem;
    }
    .loading {
      padding: 1rem;
    }
    .error {
      margin: 0;
      padding: 0.75rem 1rem;
      color: #b42318;
      background: #fef3f2;
      border-top: 1px solid #fcd8d4;
    }
    @media (max-width: 56rem) {
      .workspace {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
        height: auto;
        min-height: 100dvh;
      }
      .toolbar {
        padding: 0.45rem 0.75rem;
        font-size: 0.85rem;
        gap: 0.4rem 0.55rem;
      }
      .viewer {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .frame-wrap {
        position: relative;
        flex: 0 0 auto;
        height: min(58dvh, 30rem);
        min-height: min(50dvh, 22rem);
      }
      iframe {
        position: absolute;
        inset: 0;
      }
    }
  `,
})
export class ReviewWorkspaceComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly reviewRepository = inject(ReviewRepository);
  private readonly commentRepository = inject(CommentRepository);
  private readonly domAnchorService = inject(DomAnchorService);
  private readonly subscriptions = new Subscription();

  readonly session = signal<ReviewSession | null>(null);
  readonly comments = signal<ReviewComment[]>([]);
  readonly shareUrl = signal('');
  readonly iframeBlocked = signal(false);
  readonly commentError = signal<string | null>(null);
  readonly safeTargetUrl = signal(this.sanitizer.bypassSecurityTrustResourceUrl('about:blank'));

  private pendingAnchor: CommentAnchor | null = null;

  async ngOnInit(): Promise<void> {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!sessionId) {
      return;
    }

    const session = await this.reviewRepository.getSessionById(sessionId);
    if (!session) {
      return;
    }

    this.session.set(session);
    this.safeTargetUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(session.targetUrl));
    this.shareUrl.set(`${window.location.origin}/public-review/${session.shareToken}`);

    this.subscriptions.add(
      this.commentRepository
        .watchSessionComments(sessionId)
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

  captureOverlayClick(event: MouseEvent): void {
    const wrap = event.currentTarget as HTMLElement;
    const rect = wrap.getBoundingClientRect();
    this.pendingAnchor = {
      cssPath: '',
      textSnippet: '',
      rect: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: 0,
        height: 0,
      },
    };
  }

  async createComment(authorDisplayName: string, body: string): Promise<void> {
    const session = this.session();
    if (!session) {
      return;
    }

    const fallbackRect = {
      x: 40,
      y: 40,
      width: 0,
      height: 0,
    };

    const fallbackEl = document.createElement('div');
    fallbackEl.textContent = body;
    const generatedAnchor = this.domAnchorService.buildAnchor(fallbackEl);
    const anchor: CommentAnchor = {
      ...generatedAnchor,
      rect: this.pendingAnchor?.rect ?? fallbackRect,
    };

    try {
      await this.commentRepository.addComment({
        projectId: session.projectId,
        sessionId: session.id,
        createdBy: authorDisplayName,
        message: this.sanitizer.sanitize(SecurityContext.HTML, body) ?? body,
        x: anchor.rect.x,
        y: anchor.rect.y,
        anchor,
      });
      this.commentError.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.commentError.set(`Unable to post comment (${code}).`);
    }

    this.pendingAnchor = null;
  }

  async createReply(parentId: string, authorDisplayName: string, body: string): Promise<void> {
    const session = this.session();
    if (!session) return;

    const parent = this.comments().find((c) => c.id === parentId);
    const anchor: CommentAnchor = parent?.anchor ?? {
      cssPath: 'body',
      textSnippet: '',
      rect: { x: 0, y: 0, width: 0, height: 0 },
    };

    try {
      await this.commentRepository.addComment({
        projectId: session.projectId,
        sessionId: session.id,
        parentId,
        createdBy: authorDisplayName,
        message: this.sanitizer.sanitize(SecurityContext.HTML, body) ?? body,
        x: parent?.x ?? 0,
        y: parent?.y ?? 0,
        anchor,
      });
      this.commentError.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.commentError.set(`Unable to post reply (${code}).`);
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
