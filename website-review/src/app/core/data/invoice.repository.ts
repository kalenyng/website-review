import { Injectable } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { Observable } from 'rxjs';
import { Invoice } from '../models/billing.models';
import { db, storage } from './firebase-db';

function mapInvoice(id: string, data: Record<string, unknown>): Invoice {
  return {
    id,
    clientId: String(data['clientId'] ?? ''),
    invoiceNumber: String(data['invoiceNumber'] ?? ''),
    description: String(data['description'] ?? ''),
    amount: Number(data['amount'] ?? 0),
    amountPaid: data['amountPaid'] != null ? Number(data['amountPaid']) : undefined,
    issueDate: (data['issueDate'] as Timestamp).toDate(),
    dueDate: (data['dueDate'] as Timestamp).toDate(),
    paidDate: data['paidDate'] ? (data['paidDate'] as Timestamp).toDate() : undefined,
    fileUrl: data['fileUrl'] ? String(data['fileUrl']) : undefined,
    type: data['type'] === 'recurring' ? 'recurring' : 'one-off',
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

@Injectable({ providedIn: 'root' })
export class InvoiceRepository {
  watchAll(): Observable<Invoice[]> {
    const q = query(collection(db, 'invoices'), orderBy('issueDate', 'desc'));
    return new Observable((observer) =>
      onSnapshot(
        q,
        (snapshot) => observer.next(snapshot.docs.map((d) => mapInvoice(d.id, d.data()))),
        (error) => observer.error(error),
      ),
    );
  }

  watchByClient(clientId: string): Observable<Invoice[]> {
    const q = query(
      collection(db, 'invoices'),
      where('clientId', '==', clientId),
    );
    return new Observable((observer) =>
      onSnapshot(
        q,
        (snapshot) => {
          const invoices = snapshot.docs
            .map((d) => mapInvoice(d.id, d.data()))
            .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
          observer.next(invoices);
        },
        (error) => observer.error(error),
      ),
    );
  }

  async create(
    input: {
      clientId: string;
      invoiceNumber: string;
      description: string;
      amount: number;
      issueDate: Date;
      dueDate: Date;
      type: 'one-off' | 'recurring';
    },
    file?: File,
  ): Promise<void> {
    const invoiceRef = await addDoc(collection(db, 'invoices'), {
      clientId: input.clientId,
      invoiceNumber: input.invoiceNumber,
      description: input.description,
      amount: input.amount,
      issueDate: Timestamp.fromDate(input.issueDate),
      dueDate: Timestamp.fromDate(input.dueDate),
      type: input.type,
      createdAt: Timestamp.now(),
    });

    if (file) {
      const path = `invoices/${input.clientId}/${invoiceRef.id}.pdf`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);
      await updateDoc(invoiceRef, { fileUrl });
    }
  }

  async update(
    invoiceId: string,
    input: {
      invoiceNumber: string;
      description: string;
      amount: number;
      issueDate: Date;
      dueDate: Date;
      type: 'one-off' | 'recurring';
      clientId: string;
    },
    file?: File,
  ): Promise<void> {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    await updateDoc(invoiceRef, {
      invoiceNumber: input.invoiceNumber,
      description: input.description,
      amount: input.amount,
      issueDate: Timestamp.fromDate(input.issueDate),
      dueDate: Timestamp.fromDate(input.dueDate),
      type: input.type,
    });

    if (file) {
      const path = `invoices/${input.clientId}/${invoiceId}.pdf`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);
      await updateDoc(invoiceRef, { fileUrl });
    }
  }

  async markPaid(invoiceId: string): Promise<void> {
    await updateDoc(doc(db, 'invoices', invoiceId), {
      paidDate: Timestamp.now(),
    });
  }

  async markUnpaid(invoiceId: string): Promise<void> {
    await updateDoc(doc(db, 'invoices', invoiceId), {
      paidDate: null,
    });
  }

  async delete(invoiceId: string): Promise<void> {
    await deleteDoc(doc(db, 'invoices', invoiceId));
  }
}
