import { Injectable } from '@angular/core';
import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase-db';
import { Client } from '../models/review.models';

@Injectable({ providedIn: 'root' })
export class ClientRepository {
  watchClients(): Observable<Client[]> {
    const clientsRef = collection(db, 'clients');
    return new Observable((observer) =>
      onSnapshot(
        clientsRef,
        (snapshot) => {
          const clients = snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: String(data['name'] ?? ''),
                email: String(data['email'] ?? ''),
                notes: data['notes'] ? String(data['notes']) : undefined,
                createdAt: (data['createdAt'] as Timestamp).toDate(),
              } satisfies Client;
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          observer.next(clients);
        },
        (error) => observer.error(error),
      ),
    );
  }

  async createClient(input: { name: string; email: string; notes?: string }): Promise<void> {
    await addDoc(collection(db, 'clients'), {
      name: input.name,
      email: input.email,
      notes: input.notes ?? '',
      createdAt: Timestamp.now(),
    });
  }

  async deleteClient(clientId: string): Promise<void> {
    await deleteDoc(doc(db, 'clients', clientId));
  }
}
