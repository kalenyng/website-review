import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommentRepository } from '../../core/data/comment.repository';
import { ReviewRepository } from '../../core/data/review.repository';
import { ReviewComment, ReviewProject } from '../../core/models/review.models';

@Component({
  selector: 'app-project-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="layout">
      <section class="viewer">
        <header class="viewer-header">
          <h2>{{ project()?.name || 'Project review' }}</h2>
          <p>{{ project()?.targetUrl }}</p>
          <div class="mode-toggle" [class.view-mode]="interactionMode() === 'view'">
            <span class="mode-label">Comment</span>
            <button
              type="button"
              class="ios-switch"
              role="switch"
              [attr.aria-checked]="interactionMode() === 'view'"
              [attr.aria-label]="
                interactionMode() === 'view' ? 'Switch to comment mode' : 'Switch to view mode'
              "
              (click)="toggleMode()"
            >
              <span class="switch-thumb"></span>
            </button>
            <span class="mode-label">View</span>
          </div>
        </header>

        <div class="canvas">
          <iframe [src]="safeTargetUrl()" title="Project content"></iframe>
          @if (interactionMode() === 'comment') {
            <button
              type="button"
              class="pin pending"
              [style.left.%]="draftPosition.x * 100"
              [style.top.%]="draftPosition.y * 100"
              aria-label="Pending pin location"
            >
              +
            </button>
            <button
              type="button"
              class="click-overlay"
              aria-label="Click to place comment pin"
              (click)="capturePinPosition($event)"
            ></button>
          }

          @for (comment of comments(); track comment.id; let i = $index) {
            <button
              type="button"
              class="pin"
              [style.left.%]="comment.x * 100"
              [style.top.%]="comment.y * 100"
              [class.active]="selectedCommentId() === comment.id"
              (click)="selectComment(comment.id, $event)"
            >
              {{ i + 1 }}
            </button>
          }
        </div>
      </section>

      <aside class="sidebar">
        <h3>Comments</h3>
        <p class="hint">
          @if (interactionMode() === 'comment') {
            Click on the page to place a pin, then submit a comment.
          } @else {
            View mode is active: scroll and use the site normally.
          }
        </p>

        <form (ngSubmit)="submitComment()">
          <textarea
            [(ngModel)]="draftMessage"
            name="draftMessage"
            placeholder="Type your feedback..."
            required
          ></textarea>
          <button type="submit" [disabled]="!draftMessage.trim()">Add comment</button>
        </form>

        <ul>
          @for (comment of comments(); track comment.id) {
            <li [class.active]="selectedCommentId() === comment.id" (click)="selectedCommentId.set(comment.id)">
              <header>
                <strong>{{ comment.createdBy }}</strong>
                <small>{{ comment.createdAt | date: 'MMM d, y h:mm a' }}</small>
              </header>
              <p>{{ comment.message }}</p>
              <button type="button" (click)="toggleStatus(comment, $event)">
                {{ comment.status === 'open' ? 'Resolve' : 'Reopen' }}
              </button>
            </li>
          } @empty {
            <li class="empty">No comments yet.</li>
          }
        </ul>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </aside>
    </main>

    @if (!reviewUserName()) {
      <div class="modal-backdrop">
        <section class="modal">
          <h3>Enter your name</h3>
          <p>This will be shown on your comments.</p>
          <input [(ngModel)]="nameInput" placeholder="Your name" />
          <button type="button" (click)="saveReviewUserName()" [disabled]="!nameInput.trim()">
            Continue
          </button>
        </section>
      </div>
    }
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      height: 100vh;
      overflow: hidden;
    }
    .viewer {
      min-width: 0;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      background: #f8fafc;
    }
    .viewer-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e4e7ec;
      background: #fff;
    }
    .viewer-header h2,
    .viewer-header p {
      margin: 0;
    }
    .viewer-header p {
      color: #667085;
      font-size: 0.9rem;
    }
    .mode-toggle {
      margin-top: 0.5rem;
      display: flex;
      gap: 0.55rem;
      align-items: center;
    }
    .mode-label {
      font-size: 0.82rem;
      color: #475467;
      user-select: none;
    }
    .mode-toggle.view-mode .mode-label:last-child,
    .mode-toggle:not(.view-mode) .mode-label:first-child {
      color: #101828;
      font-weight: 600;
    }
    .ios-switch {
      border: 1px solid #d0d5dd;
      border-radius: 999px;
      width: 48px;
      height: 28px;
      padding: 2px;
      background: #f2f4f7;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .mode-toggle.view-mode .ios-switch {
      background: #34c759;
      border-color: #34c759;
    }
    .switch-thumb {
      display: block;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.2);
      transform: translateX(0);
      transition: transform 0.2s ease;
    }
    .mode-toggle.view-mode .switch-thumb {
      transform: translateX(20px);
    }
    .canvas {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
    }
    .pin {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 2px solid #fff;
      background: #d92d20;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      z-index: 3;
    }
    .pin.pending {
      background: #475467;
      cursor: default;
      z-index: 2;
    }
    .pin.active {
      background: #b42318;
      box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.2);
    }
    .click-overlay {
      position: absolute;
      inset: 0;
      border: 0;
      background: transparent;
      cursor: crosshair;
      z-index: 1;
    }
    .sidebar {
      border-left: 1px solid #e4e7ec;
      background: #fff;
      padding: 1rem;
      overflow: auto;
    }
    .hint {
      margin-top: 0;
      color: #667085;
      font-size: 0.9rem;
    }
    form {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    textarea {
      min-height: 90px;
      resize: vertical;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.6rem;
    }
    li {
      border: 1px solid #eaecf0;
      border-radius: 8px;
      padding: 0.6rem;
      cursor: pointer;
    }
    li.active {
      border-color: #d92d20;
      background: #fff5f4;
    }
    li header {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    li p {
      margin: 0 0 0.5rem;
      white-space: pre-wrap;
    }
    .empty {
      color: #667085;
      text-align: center;
    }
    .error {
      color: #b42318;
      margin-top: 0.75rem;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(16, 24, 40, 0.45);
      display: grid;
      place-items: center;
      z-index: 10;
    }
    .modal {
      background: #fff;
      width: min(360px, 92vw);
      border-radius: 10px;
      padding: 1rem;
      display: grid;
      gap: 0.5rem;
    }
    .modal h3,
    .modal p {
      margin: 0;
    }
  `,
})
export class ProjectReviewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly reviewRepository = inject(ReviewRepository);
  private readonly commentRepository = inject(CommentRepository);
  private readonly subscriptions = new Subscription();

  readonly project = signal<ReviewProject | null>(null);
  readonly comments = signal<ReviewComment[]>([]);
  readonly selectedCommentId = signal<string | null>(null);
  readonly interactionMode = signal<'comment' | 'view'>('comment');
  readonly safeTargetUrl = signal(this.sanitizer.bypassSecurityTrustResourceUrl('about:blank'));
  readonly reviewUserName = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  nameInput = '';
  draftMessage = '';
  draftPosition = { x: 0.5, y: 0.5 };

  async ngOnInit(): Promise<void> {
    const storedName = localStorage.getItem('reviewUser');
    this.reviewUserName.set(storedName);
    if (storedName) {
      this.nameInput = storedName;
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
    this.safeTargetUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(project.targetUrl));
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

  saveReviewUserName(): void {
    const name = this.nameInput.trim();
    if (!name) {
      return;
    }
    localStorage.setItem('reviewUser', name);
    this.reviewUserName.set(name);
  }

  capturePinPosition(event: MouseEvent): void {
    if (this.interactionMode() !== 'comment') {
      return;
    }
    const container = event.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    this.draftPosition = {
      x: Math.min(Math.max(x, 0), 1),
      y: Math.min(Math.max(y, 0), 1),
    };
  }

  selectComment(commentId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedCommentId.set(commentId);
  }

  setMode(mode: 'comment' | 'view'): void {
    this.interactionMode.set(mode);
  }

  toggleMode(): void {
    this.interactionMode.set(this.interactionMode() === 'comment' ? 'view' : 'comment');
  }

  async submitComment(): Promise<void> {
    const project = this.project();
    const createdBy = this.reviewUserName();
    const message = this.draftMessage.trim();
    if (!project || !createdBy || !message) {
      return;
    }

    try {
      await this.commentRepository.addProjectComment({
        projectId: project.id,
        createdBy,
        message,
        x: this.draftPosition.x,
        y: this.draftPosition.y,
      });
      this.draftMessage = '';
      this.error.set(null);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';
      this.error.set(`Unable to save comment (${code}).`);
    }
  }

  async toggleStatus(comment: ReviewComment, event: MouseEvent): Promise<void> {
    event.stopPropagation();
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
      this.error.set(`Unable to update comment (${code}).`);
    }
  }
}
