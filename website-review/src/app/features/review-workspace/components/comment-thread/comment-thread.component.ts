import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReviewComment } from '../../../../core/models/review.models';

interface CommentThread {
  parent: ReviewComment;
  replies: ReviewComment[];
}

@Component({
  selector: 'app-comment-thread',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="thread">
      <h3>Comments</h3>
      @if (showComposer) {
        <form (ngSubmit)="submitComment()" class="composer">
          @if (!currentUser) {
            <input
              type="text"
              [(ngModel)]="authorDisplayName"
              name="authorDisplayName"
              placeholder="Your name"
            />
          }
          <textarea [(ngModel)]="body" name="body" placeholder="Add a note..." required></textarea>
          <button type="submit" [disabled]="!body.trim()">Post note</button>
        </form>
      }
      <ul class="comment-list">
        @for (thread of threads(); track thread.parent.id) {
          <li [class.resolved]="thread.parent.status === 'resolved'">
            <header>
              <span class="author">{{ thread.parent.createdBy }}</span>
              <div class="header-actions">
                <button type="button" class="status-btn" (click)="toggleStatus.emit(thread.parent)">
                  {{ thread.parent.status === 'open' ? 'Resolve' : 'Reopen' }}
                </button>
                @if (allowDelete && thread.parent.status === 'resolved') {
                  <button
                    type="button"
                    class="delete-btn"
                    title="Delete comment"
                    (click)="deleteComment.emit(thread.parent)"
                  >
                    ✕
                  </button>
                }
              </div>
            </header>
            <p>{{ thread.parent.message }}</p>

            @if (thread.replies.length > 0) {
              <ul class="replies">
                @for (reply of thread.replies; track reply.id) {
                  <li class="reply">
                    <span class="author">{{ reply.createdBy }}</span>
                    <p>{{ reply.message }}</p>
                  </li>
                }
              </ul>
            }

            @if (activeReplyId() === thread.parent.id) {
              <form class="reply-composer" (ngSubmit)="submitReply(thread.parent.id)">
                @if (!currentUser) {
                  <input
                    type="text"
                    [(ngModel)]="authorDisplayName"
                    name="replyAuthor"
                    placeholder="Your name"
                  />
                }
                <textarea
                  [(ngModel)]="replyBody"
                  name="replyBody"
                  placeholder="Write a reply..."
                  required
                ></textarea>
                <div class="reply-actions">
                  <button type="submit" [disabled]="!replyBody.trim()">Post reply</button>
                  <button type="button" class="cancel-btn" (click)="cancelReply()">Cancel</button>
                </div>
              </form>
            } @else {
              <button
                type="button"
                class="reply-btn"
                (click)="activeReplyId.set(thread.parent.id)"
              >
                Reply
              </button>
            }
          </li>
        } @empty {
          <li class="empty">No comments yet.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .thread {
      border-left: 1px solid var(--border);
      padding: 1rem;
      width: 320px;
      max-height: 100vh;
      overflow: auto;
      background: transparent;
      color: var(--ink);
    }
    h3 {
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--ink);
    }
    .composer {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    input, textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 0.875rem;
      font-family: inherit;
      background: var(--card, #1a1f2e);
      color: var(--ink);
    }
    input::placeholder, textarea::placeholder {
      color: var(--mist);
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: var(--ember);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--ember) 20%, transparent);
    }
    textarea {
      min-height: 72px;
      resize: vertical;
    }
    button[type="submit"] {
      justify-self: start;
      padding: 0.35rem 0.85rem;
      border: none;
      border-radius: 6px;
      background: var(--ember);
      color: #fff;
      font-size: 0.875rem;
      font-family: inherit;
      cursor: pointer;
    }
    button[type="submit"]:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .comment-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.75rem;
    }
    .comment-list > li {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      background: color-mix(in srgb, var(--paper, #0a0e16) 80%, white 20%);
    }
    .comment-list > li.resolved {
      opacity: 0.5;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .author {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--ink);
    }
    .status-btn {
      font-size: 0.75rem;
      padding: 0.2rem 0.55rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: transparent;
      color: var(--mist);
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    .status-btn:hover {
      border-color: var(--ember);
      color: var(--ember);
    }
    .delete-btn {
      font-size: 0.7rem;
      padding: 0.2rem 0.45rem;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: var(--mist);
      font-family: inherit;
      cursor: pointer;
      line-height: 1;
    }
    .delete-btn:hover {
      border-color: #e53935;
      color: #e53935;
    }
    p {
      margin: 0.25rem 0 0.5rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--ink);
    }
    .replies {
      list-style: none;
      padding: 0 0 0 0.75rem;
      margin: 0.5rem 0 0.5rem 0.75rem;
      border-left: 2px solid var(--border);
      display: grid;
      gap: 0.5rem;
    }
    .reply {
      font-size: 0.85rem;
    }
    .reply .author {
      font-size: 0.8rem;
    }
    .reply p {
      margin: 0.15rem 0 0;
      color: color-mix(in srgb, var(--ink) 80%, transparent);
    }
    .reply-btn {
      font-size: 0.775rem;
      color: var(--alpine);
      background: none;
      border: none;
      padding: 0;
      font-family: inherit;
      cursor: pointer;
    }
    .reply-btn:hover {
      text-decoration: underline;
      color: var(--ember);
    }
    .reply-composer {
      margin-top: 0.5rem;
      display: grid;
      gap: 0.4rem;
    }
    .reply-actions {
      display: flex;
      gap: 0.5rem;
    }
    .cancel-btn {
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--mist);
      font-size: 0.875rem;
      font-family: inherit;
      cursor: pointer;
    }
    .cancel-btn:hover {
      border-color: var(--mist);
      color: var(--ink);
    }
    .empty {
      text-align: center;
      color: var(--mist);
      font-size: 0.875rem;
      padding: 1rem 0;
    }
  `,
})
export class CommentThreadComponent {
  @Input({ required: true }) set comments(value: ReviewComment[]) {
    this.threads.set(this.buildThreads(value));
  }
  @Input() currentUser: string | null = null;
  @Input() showComposer = true;
  @Input() allowDelete = false;

  @Output() add = new EventEmitter<{ authorDisplayName: string; body: string }>();
  @Output() addReply = new EventEmitter<{
    parentId: string;
    authorDisplayName: string;
    body: string;
  }>();
  @Output() toggleStatus = new EventEmitter<ReviewComment>();
  @Output() deleteComment = new EventEmitter<ReviewComment>();

  readonly threads = signal<CommentThread[]>([]);
  readonly activeReplyId = signal<string | null>(null);

  authorDisplayName = '';
  body = '';
  replyBody = '';

  private buildThreads(comments: ReviewComment[]): CommentThread[] {
    const topLevel = comments.filter((c) => !c.parentId);
    const replies = comments.filter((c) => !!c.parentId);
    return topLevel.map((parent) => ({
      parent,
      replies: replies
        .filter((r) => r.parentId === parent.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    }));
  }

  submitComment(): void {
    const cleanBody = this.body.trim();
    if (!cleanBody) return;
    this.add.emit({
      authorDisplayName: this.currentUser ?? (this.authorDisplayName.trim() || 'Guest'),
      body: cleanBody,
    });
    this.body = '';
  }

  submitReply(parentId: string): void {
    const cleanBody = this.replyBody.trim();
    if (!cleanBody) return;
    this.addReply.emit({
      parentId,
      authorDisplayName: this.currentUser ?? (this.authorDisplayName.trim() || 'Guest'),
      body: cleanBody,
    });
    this.replyBody = '';
    this.activeReplyId.set(null);
  }

  cancelReply(): void {
    this.replyBody = '';
    this.activeReplyId.set(null);
  }
}
