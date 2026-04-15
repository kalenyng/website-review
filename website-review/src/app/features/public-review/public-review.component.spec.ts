import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PublicReviewComponent } from './public-review.component';
import { ReviewRepository } from '../../core/data/review.repository';
import { CommentRepository } from '../../core/data/comment.repository';

describe('PublicReviewComponent', () => {
  it('creates and resolves comment from shared link', async () => {
    const addComment = vi.fn().mockResolvedValue(undefined);
    const setCommentStatus = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PublicReviewComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ shareToken: 'token' }) } },
        },
        {
          provide: ReviewRepository,
          useValue: {
            getSessionByToken: vi.fn().mockResolvedValue({
              id: 'session-1',
              projectId: 'project-1',
              targetUrl: 'https://example.com',
              shareToken: 'token',
              createdAt: new Date(),
            }),
          },
        },
        {
          provide: CommentRepository,
          useValue: {
            watchSessionComments: vi.fn().mockReturnValue(of([])),
            addComment,
            setCommentStatus,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PublicReviewComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();

    await component.createComment('Guest', 'LGTM');
    await component.toggleStatus({
      id: 'comment-1',
      sessionId: 'session-1',
      authorDisplayName: 'Guest',
      body: 'LGTM',
      status: 'open',
      anchor: { cssPath: 'body', textSnippet: 'LGTM', rect: { x: 0, y: 0, width: 0, height: 0 } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(addComment).toHaveBeenCalledTimes(1);
    expect(setCommentStatus).toHaveBeenCalledWith('comment-1', 'resolved');
  });
});
