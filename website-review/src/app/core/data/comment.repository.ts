import { Injectable } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase-db';
import { CommentAnchor, CommentStatus, ReviewComment } from '../models/review.models';
import { sanitizeCommentBody } from '../utils/sanitize.util';

@Injectable({ providedIn: 'root' })
export class CommentRepository {
  watchAllComments(): Observable<ReviewComment[]> {
    const commentsRef = collection(db, 'comments');
    return new Observable((observer) =>
      onSnapshot(
        commentsRef,
        (snapshot) => {
          const comments = snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                projectId: String(data['projectId'] ?? ''),
                sessionId: data['sessionId'] ? String(data['sessionId']) : undefined,
                createdBy: String(data['createdBy'] ?? data['authorDisplayName'] ?? 'Guest'),
                message: String(data['message'] ?? data['body'] ?? ''),
                status: (data['status'] as CommentStatus) ?? 'open',
                x: Number(data['x'] ?? data['anchor']?.rect?.x ?? 0.5),
                y: Number(data['y'] ?? data['anchor']?.rect?.y ?? 0.5),
                anchor: data['anchor'] as CommentAnchor | undefined,
                createdAt: (data['createdAt'] as Timestamp).toDate(),
                updatedAt: (data['updatedAt'] as Timestamp).toDate(),
              } satisfies ReviewComment;
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          observer.next(comments);
        },
        (error) => observer.error(error),
      ),
    );
  }

  watchProjectComments(projectId: string): Observable<ReviewComment[]> {
    const commentsQuery = query(collection(db, 'comments'), where('projectId', '==', projectId));
    return new Observable((observer) =>
      onSnapshot(
        commentsQuery,
        (snapshot) => {
          const comments = snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                projectId: String(data['projectId']),
                sessionId: data['sessionId'] ? String(data['sessionId']) : undefined,
                createdBy: String(data['createdBy'] ?? data['authorDisplayName'] ?? 'Guest'),
                message: String(data['message'] ?? data['body'] ?? ''),
                status: (data['status'] as CommentStatus) ?? 'open',
                x: Number(data['x'] ?? data['anchor']?.rect?.x ?? 0.5),
                y: Number(data['y'] ?? data['anchor']?.rect?.y ?? 0.5),
                anchor: data['anchor'] as CommentAnchor | undefined,
                createdAt: (data['createdAt'] as Timestamp).toDate(),
                updatedAt: (data['updatedAt'] as Timestamp).toDate(),
              } satisfies ReviewComment;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          observer.next(comments);
        },
        (error) => observer.error(error),
      ),
    );
  }

  watchSessionComments(sessionId: string): Observable<ReviewComment[]> {
    const commentsQuery = query(collection(db, 'comments'), where('sessionId', '==', sessionId));
    return new Observable((observer) =>
      onSnapshot(
        commentsQuery,
        (snapshot) => {
          const comments = snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                projectId: String(data['projectId'] ?? ''),
                sessionId: String(data['sessionId']),
                createdBy: String(data['createdBy'] ?? data['authorDisplayName'] ?? 'Guest'),
                message: String(data['message'] ?? data['body'] ?? ''),
                status: (data['status'] as CommentStatus) ?? 'open',
                x: Number(data['x'] ?? data['anchor']?.rect?.x ?? 0.5),
                y: Number(data['y'] ?? data['anchor']?.rect?.y ?? 0.5),
                anchor: data['anchor'] as CommentAnchor | undefined,
                createdAt: (data['createdAt'] as Timestamp).toDate(),
                updatedAt: (data['updatedAt'] as Timestamp).toDate(),
              } satisfies ReviewComment;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          observer.next(comments);
        },
        (error) => observer.error(error),
      ),
    );
  }

  async addComment(input: {
    projectId?: string;
    sessionId: string;
    authorDisplayName?: string;
    createdBy?: string;
    body?: string;
    message?: string;
    x?: number;
    y?: number;
    anchor: CommentAnchor;
  }): Promise<void> {
    const now = Timestamp.now();
    const createdBy = sanitizeCommentBody(input.createdBy ?? input.authorDisplayName ?? 'Guest');
    const message = sanitizeCommentBody(input.message ?? input.body ?? '');
    await addDoc(collection(db, 'comments'), {
      sessionId: input.sessionId,
      projectId: input.projectId ?? '',
      createdBy,
      authorDisplayName: createdBy,
      message,
      body: message,
      status: 'open',
      x: input.x ?? 0.5,
      y: input.y ?? 0.5,
      anchor: input.anchor,
      createdAt: now,
      updatedAt: now,
    });
  }

  async addProjectComment(input: {
    projectId: string;
    createdBy: string;
    message: string;
    x: number;
    y: number;
  }): Promise<void> {
    const now = Timestamp.now();
    const createdBy = sanitizeCommentBody(input.createdBy);
    const message = sanitizeCommentBody(input.message);
    await addDoc(collection(db, 'comments'), {
      projectId: input.projectId,
      createdBy,
      authorDisplayName: createdBy,
      message,
      body: message,
      status: 'open',
      x: input.x,
      y: input.y,
      createdAt: now,
      updatedAt: now,
    });
  }

  async setCommentStatus(commentId: string, status: CommentStatus): Promise<void> {
    await updateDoc(doc(db, 'comments', commentId), {
      status,
      updatedAt: Timestamp.now(),
    });
  }
}
