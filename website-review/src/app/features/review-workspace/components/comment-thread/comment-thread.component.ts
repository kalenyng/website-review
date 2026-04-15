import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReviewComment } from '../../../../core/models/review.models';

@Component({
  selector: 'app-comment-thread',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="thread">
      <h3>Comments</h3>
      <form (ngSubmit)="submitComment()" class="composer">
        <input
          type="text"
          [(ngModel)]="authorDisplayName"
          name="authorDisplayName"
          placeholder="Your name"
          required
        />
        <textarea [(ngModel)]="body" name="body" placeholder="Add a note..." required></textarea>
        <button type="submit" [disabled]="!body.trim()">Post note</button>
      </form>
      <ul>
        @for (comment of comments; track comment.id) {
          <li [class.resolved]="comment.status === 'resolved'">
            <header>
              <span class="author">{{ comment.createdBy }}</span>
              <button type="button" (click)="toggleStatus.emit(comment)">
                {{ comment.status === 'open' ? 'Resolve' : 'Reopen' }}
              </button>
            </header>
            <p>{{ comment.message }}</p>
          </li>
        } @empty {
          <li class="empty">No comments yet.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .thread {
      border-left: 1px solid #d9d9d9;
      padding: 1rem;
      width: 320px;
      max-height: 100vh;
      overflow: auto;
      background: #fff;
    }
    .composer {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    textarea {
      min-height: 80px;
      resize: vertical;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.75rem;
    }
    li {
      border: 1px solid #ececec;
      border-radius: 8px;
      padding: 0.75rem;
    }
    li.resolved {
      opacity: 0.6;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .author {
      font-weight: 600;
    }
    .empty {
      text-align: center;
      color: #666;
    }
  `,
})
export class CommentThreadComponent {
  @Input({ required: true }) comments: ReviewComment[] = [];
  @Output() add = new EventEmitter<{ authorDisplayName: string; body: string }>();
  @Output() toggleStatus = new EventEmitter<ReviewComment>();

  authorDisplayName = '';
  body = '';

  submitComment(): void {
    const cleanBody = this.body.trim();
    if (!cleanBody) {
      return;
    }

    this.add.emit({
      authorDisplayName: this.authorDisplayName.trim() || 'Guest',
      body: cleanBody,
    });
    this.body = '';
  }
}
