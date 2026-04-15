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
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase-db';
import { ReviewProject, ReviewSession } from '../models/review.models';

function generateToken(length = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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
                token: String(data['token'] ?? ''),
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
    const token = generateToken();
    const projectRef = await addDoc(collection(db, 'projects'), {
      name: input.name,
      targetUrl: input.targetUrl,
      token,
      createdAt: now,
    });

    return {
      id: projectRef.id,
      name: input.name,
      targetUrl: input.targetUrl,
      token,
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
      token: String(data['token'] ?? ''),
      ownerId: data['ownerId'] ? String(data['ownerId']) : undefined,
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    };
  }

  async updateProject(
    projectId: string,
    input: { name: string; targetUrl: string },
  ): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), {
      name: input.name,
      targetUrl: input.targetUrl,
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', projectId));
  }

  async getProjectByToken(token: string): Promise<ReviewProject | null> {
    const q = query(collection(db, 'projects'), where('token', '==', token));
    const snapshot = await getDocs(q);
    const first = snapshot.docs[0];
    if (!first) {
      return null;
    }
    const data = first.data();
    return {
      id: first.id,
      name: String(data['name'] ?? 'Untitled project'),
      targetUrl: String(data['targetUrl'] ?? ''),
      token: String(data['token'] ?? ''),
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
