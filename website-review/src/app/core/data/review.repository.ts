import { Injectable } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase-db';
import { ReviewProject, ReviewSession } from '../models/review.models';

@Injectable({ providedIn: 'root' })
export class ReviewRepository {
  watchProjects(): Observable<ReviewProject[]> {
    const projectsRef = collection(db, 'projects');
    return new Observable((observer) =>
      onSnapshot(
        projectsRef,
        (snapshot) => {
          const projects = snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: String(data['name'] ?? 'Untitled project'),
                targetUrl: String(data['targetUrl'] ?? ''),
                ownerId: data['ownerId'] ? String(data['ownerId']) : undefined,
                createdAt: (data['createdAt'] as Timestamp).toDate(),
              } satisfies ReviewProject;
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          observer.next(projects);
        },
        (error) => observer.error(error),
      ),
    );
  }

  async createProject(input: { name: string; targetUrl: string }): Promise<ReviewProject> {
    const now = Timestamp.now();
    const projectRef = await addDoc(collection(db, 'projects'), {
      name: input.name,
      targetUrl: input.targetUrl,
      createdAt: now,
    });

    return {
      id: projectRef.id,
      name: input.name,
      targetUrl: input.targetUrl,
      createdAt: now.toDate(),
    };
  }

  async getProjectById(projectId: string): Promise<ReviewProject | null> {
    const snapshot = await getDoc(doc(db, 'projects', projectId));
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data();
    return {
      id: snapshot.id,
      name: String(data['name'] ?? 'Untitled project'),
      targetUrl: String(data['targetUrl'] ?? ''),
      ownerId: data['ownerId'] ? String(data['ownerId']) : undefined,
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    };
  }

  async createSession(targetUrl: string): Promise<ReviewSession> {
    const now = Timestamp.now();
    const projectRef = await addDoc(collection(db, 'projects'), {
      name: `Review ${new Date().toISOString()}`,
      targetUrl,
      createdAt: now,
    });

    const shareToken = crypto.randomUUID().replace(/-/g, '');
    const sessionRef = await addDoc(collection(db, 'reviewSessions'), {
      projectId: projectRef.id,
      targetUrl,
      shareToken,
      createdAt: now,
    });

    return {
      id: sessionRef.id,
      projectId: projectRef.id,
      targetUrl,
      shareToken,
      createdAt: now.toDate(),
    };
  }

  async getSessionById(sessionId: string): Promise<ReviewSession | null> {
    const snapshot = await getDoc(doc(db, 'reviewSessions', sessionId));
    if (!snapshot.exists()) {
      return null;
    }
    return this.mapSession(snapshot.id, snapshot.data());
  }

  async getSessionByToken(token: string): Promise<ReviewSession | null> {
    const sessionsQuery = query(collection(db, 'reviewSessions'), where('shareToken', '==', token));
    const snapshots = await getDocs(sessionsQuery);
    const first = snapshots.docs[0];
    return first ? this.mapSession(first.id, first.data()) : null;
  }

  private mapSession(id: string, data: Record<string, unknown>): ReviewSession {
    return {
      id,
      projectId: String(data['projectId']),
      targetUrl: String(data['targetUrl']),
      shareToken: String(data['shareToken']),
      createdAt: (data['createdAt'] as Timestamp).toDate(),
      createdBy: data['createdBy'] ? String(data['createdBy']) : undefined,
      lastSnapshot: data['lastSnapshot'] ? String(data['lastSnapshot']) : undefined,
    };
  }
}
