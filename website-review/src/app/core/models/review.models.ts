export interface DomRectAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CommentAnchor {
  cssPath: string;
  textSnippet: string;
  rect: DomRectAnchor;
}

export type CommentStatus = 'open' | 'resolved';

export interface ReviewProject {
  id: string;
  name: string;
  targetUrl: string;
  token: string;
  ownerId?: string;
  createdAt: Date;
}

export interface ReviewSession {
  id: string;
  projectId: string;
  targetUrl: string;
  shareToken: string;
  createdAt: Date;
  createdBy?: string;
  lastSnapshot?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  notes?: string;
  createdAt: Date;
}

export interface ReviewComment {
  id: string;
  projectId: string;
  sessionId?: string;
  parentId?: string;
  createdBy: string;
  message: string;
  status: CommentStatus;
  x: number;
  y: number;
  anchor?: CommentAnchor;
  createdAt: Date;
  updatedAt: Date;
}
