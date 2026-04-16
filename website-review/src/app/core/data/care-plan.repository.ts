import { Injectable } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { CarePlan } from '../models/billing.models';
import { db } from './firebase-db';

function mapCarePlan(id: string, data: Record<string, unknown>): CarePlan {
  return {
    id,
    clientId: String(data['clientId'] ?? ''),
    name: String(data['name'] ?? ''),
    amount: Number(data['amount'] ?? 0),
    billingCycle: data['billingCycle'] === 'yearly' ? 'yearly' : 'monthly',
    nextDueDate: (data['nextDueDate'] as Timestamp).toDate(),
    active: Boolean(data['active'] ?? true),
  };
}

@Injectable({ providedIn: 'root' })
export class CarePlanRepository {
  watchAll(): Observable<CarePlan[]> {
    const q = query(collection(db, 'carePlans'), orderBy('nextDueDate', 'asc'));
    return new Observable((observer) =>
      onSnapshot(
        q,
        (snapshot) => observer.next(snapshot.docs.map((d) => mapCarePlan(d.id, d.data()))),
        (error) => observer.error(error),
      ),
    );
  }

  watchByClient(clientId: string): Observable<CarePlan[]> {
    const q = query(
      collection(db, 'carePlans'),
      where('clientId', '==', clientId),
    );
    return new Observable((observer) =>
      onSnapshot(
        q,
        (snapshot) => {
          const plans = snapshot.docs
            .map((d) => mapCarePlan(d.id, d.data()))
            .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
          observer.next(plans);
        },
        (error) => observer.error(error),
      ),
    );
  }

  async create(input: {
    clientId: string;
    name: string;
    amount: number;
    billingCycle: 'monthly' | 'yearly';
    nextDueDate: Date;
  }): Promise<void> {
    await addDoc(collection(db, 'carePlans'), {
      clientId: input.clientId,
      name: input.name,
      amount: input.amount,
      billingCycle: input.billingCycle,
      nextDueDate: Timestamp.fromDate(input.nextDueDate),
      active: true,
    });
  }

  async toggleActive(planId: string, active: boolean): Promise<void> {
    await updateDoc(doc(db, 'carePlans', planId), { active });
  }
}
