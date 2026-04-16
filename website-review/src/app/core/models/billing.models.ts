export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  amountPaid?: number; // reserved for partial payments
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  fileUrl?: string;
  type: 'one-off' | 'recurring';
  createdAt: Date;
}

export interface CarePlan {
  id: string;
  clientId: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextDueDate: Date;
  active: boolean;
}

export type InvoiceStatus = 'paid' | 'overdue' | 'pending';
export type CarePlanStatus = 'active' | 'due-soon' | 'overdue' | 'inactive';

export function invoiceStatus(inv: Invoice): InvoiceStatus {
  if (inv.paidDate) return 'paid';
  if (new Date() > inv.dueDate) return 'overdue';
  return 'pending';
}

export function carePlanStatus(plan: CarePlan): CarePlanStatus {
  if (!plan.active) return 'inactive';
  const daysUntilDue = (plan.nextDueDate.getTime() - Date.now()) / 86_400_000;
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'due-soon';
  return 'active';
}
