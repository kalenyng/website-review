import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ReviewWorkspaceComponent } from './review-workspace.component';
import { ReviewRepository } from '../../core/data/review.repository';
import { CommentRepository } from '../../core/data/comment.repository';

describe('ReviewWorkspaceComponent', () => {
  it('creates a comment then resolves it', async () => {
    const addComment = vi.fn().mockResolvedValue(undefined);
    const setCommentStatus = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [ReviewWorkspaceComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ sessionId: 'session-1' }) } },
        },
        {
          provide: ReviewRepository,
          useValue: {
            getSessionById: vi.fn().mockResolvedValue({
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

    const fixture = TestBed.createComponent(ReviewWorkspaceComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();
    const container = document.createElement('div');
    document.body.appendChild(container);
    component.captureOverlayClick({
      clientX: 80,
      clientY: 60,
      currentTarget: container,
    } as unknown as MouseEvent);

    await component.createComment('Tester', 'Looks good');
    await component.toggleStatus({
      id: 'comment-1',
      sessionId: 'session-1',
      authorDisplayName: 'Tester',
      body: 'Looks good',
      status: 'open',
      anchor: { cssPath: 'body', textSnippet: 'Looks good', rect: { x: 0, y: 0, width: 0, height: 0 } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(addComment).toHaveBeenCalledTimes(1);
    expect(setCommentStatus).toHaveBeenCalledWith('comment-1', 'resolved');
  });
});
