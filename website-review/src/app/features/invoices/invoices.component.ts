import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClientRepository } from '../../core/data/client.repository';
import { InvoiceRepository } from '../../core/data/invoice.repository';
import { Invoice, InvoiceStatus, invoiceStatus } from '../../core/models/billing.models';
import { Client } from '../../core/models/review.models';
type InvoiceCard = Invoice & { status: InvoiceStatus; clientName: string };

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe],
  template: `
    <main class="dashboard">
      <div class="page-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1 class="gradient-text">Billing</h1>
          <p class="lead">All invoices across every client.</p>
        </div>
        <button class="btn-primary" type="button" (click)="openCreateModal()">New Invoice</button>
      </div>

      <div class="filter-tabs">
        <button class="tab" [class.active]="filter() === 'all'" (click)="filter.set('all')">All <span class="count">{{ invoiceCards().length }}</span></button>
        <button class="tab" [class.active]="filter() === 'pending'" (click)="filter.set('pending')">Pending <span class="count">{{ pendingCount() }}</span></button>
        <button class="tab" [class.active]="filter() === 'overdue'" (click)="filter.set('overdue')">Overdue <span class="count">{{ overdueCount() }}</span></button>
        <button class="tab" [class.active]="filter() === 'paid'" (click)="filter.set('paid')">Paid <span class="count">{{ paidCount() }}</span></button>
      </div>

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else {
        <div class="invoice-list">
          @for (inv of filteredInvoices(); track inv.id) {
            <article class="glass invoice-row" [class.is-paid]="inv.status === 'paid'" [class.is-overdue]="inv.status === 'overdue'">
              <div class="inv-left">
                <span class="inv-num">{{ inv.invoiceNumber }}</span>
                <div class="inv-body">
                  <a [routerLink]="['/workspace', inv.clientId]" [queryParams]="{from: 'billing'}" class="clickable inv-client">{{ inv.clientName }}</a>
                  <span class="inv-desc">{{ inv.description }}</span>
                </div>
              </div>
              <div class="inv-right">
                <span class="inv-amount">{{ inv.amount | currency: 'GBP' }}</span>
                <div class="inv-dates">
                  <span>Issued {{ inv.issueDate | date: 'd MMM y' }}</span>
                  @if (inv.paidDate) {
                    <span>Paid {{ inv.paidDate | date: 'd MMM y' }}</span>
                  } @else {
                    <span>Due {{ inv.dueDate | date: 'd MMM y' }}</span>
                  }
                </div>
                  <div class="inv-actions">
                  <span class="badge" [class]="'badge-' + inv.status">{{ inv.status }}</span>
                  @if (inv.status === 'paid') {
                    <button class="btn-action" type="button" (click)="markUnpaid(inv.id)">Unmark paid</button>
                  } @else {
                    <button class="btn-action" type="button" (click)="markPaid(inv.id)">Mark paid</button>
                  }
                  <button class="btn-action" type="button" (click)="openEditModal(inv)">Edit</button>
                  @if (inv.fileUrl) {
                    <a [href]="inv.fileUrl" target="_blank" rel="noopener" class="btn-pdf">PDF</a>
                  }
                </div>
              </div>
            </article>
          } @empty {
            <p class="glass empty">No invoices found.</p>
          }
        </div>
      }

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </main>

    <!-- Create / Edit modal -->
    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal glass" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId() ? 'Edit Invoice' : 'New Invoice' }}</h2>
            <button type="button" class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveInvoice()">
            @if (!editingId()) {
              <select formControlName="clientId">
                <option value="">Select client…</option>
                @for (client of clients(); track client.id) {
                  <option [value]="client.id">{{ client.name }}</option>
                }
              </select>
            }
            <input formControlName="invoiceNumber" placeholder="Invoice number (e.g. INV-001)" />
            <input formControlName="description" placeholder="Description" />
            <input formControlName="amount" type="number" min="0" step="0.01" placeholder="Amount (£)" />
            <div class="date-row">
              <div class="field">
                <label>Issue date</label>
                <input formControlName="issueDate" type="date" />
              </div>
              <div class="field">
                <label>Due date</label>
                <input formControlName="dueDate" type="date" />
              </div>
            </div>
            <select formControlName="type">
              <option value="one-off">One-off</option>
              <option value="recurring">Recurring</option>
            </select>
            @if (formError()) {
              <p class="error">{{ formError() }}</p>
            }
            <div class="modal-actions">
              <button class="btn-primary" type="submit" [disabled]="submitting()">
                {{ submitting() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create Invoice') }}
              </button>
              <button type="button" class="btn-ghost" (click)="closeModal()">Cancel</button>
              @if (editingId()) {
                <div class="modal-delete">
                  @if (confirmingDeleteId() === editingId()) {
                    <span class="delete-confirm-label">Are you sure?</span>
                    <button type="button" class="btn-danger-sm" (click)="confirmDelete(editingId()!)">Yes, delete</button>
                    <button type="button" class="btn-ghost-sm" (click)="confirmingDeleteId.set(null)">Cancel</button>
                  } @else {
                    <button type="button" class="btn-delete-text" (click)="confirmingDeleteId.set(editingId())">Delete invoice</button>
                  }
                </div>
              }
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .dashboard {
      max-width: 72rem;
      margin: 0 auto;
      padding: 3rem 1.5rem 5rem;
      display: grid;
      gap: 1.5rem;
      align-content: start;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .eyebrow {
      margin: 0;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
    }
    .page-header h1 {
      margin: 0.2rem 0 0.3rem;
      font-size: clamp(1.75rem, 3.5vw, 2.5rem);
      line-height: 1.1;
    }
    .lead { margin: 0; color: var(--mist); font-size: 0.9rem; line-height: 1.55; }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    .filter-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .tab {
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--mist);
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
    }
    .tab:hover, .tab.active {
      color: var(--ink);
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
      border-color: var(--ink);
    }
    .count {
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
      border-radius: 99px;
      padding: 0 0.35rem;
      font-size: 0.72rem;
    }
    .btn-primary {
      border: 0;
      border-radius: var(--radius-md);
      padding: 0.6rem 1rem;
      background: var(--ember);
      color: var(--paper);
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .invoice-list { display: grid; gap: 0.5rem; }
    .invoice-row {
      padding: 0.9rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      transition: opacity 0.15s;
    }
    .invoice-row.is-paid { opacity: 0.55; }
    .invoice-row.is-overdue { border-color: #ff6a4f44; }
    .inv-left { display: flex; gap: 0.75rem; align-items: flex-start; min-width: 0; }
    .inv-num {
      font-size: 0.75rem;
      color: var(--mist);
      white-space: nowrap;
      padding-top: 0.15rem;
      min-width: 4.5rem;
    }
    .inv-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .inv-client { font-weight: 600; font-size: 0.9rem; }
    .inv-desc { font-size: 0.875rem; color: var(--mist); }
    .inv-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .inv-amount { font-weight: 700; font-size: 1rem; }
    .inv-dates { display: flex; flex-direction: column; gap: 0.1rem; font-size: 0.8rem; color: var(--mist); text-align: right; }
    .inv-actions { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .badge {
      padding: 0.2rem 0.55rem;
      border-radius: 99px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .badge-paid { background: #4caf5022; color: #4caf50; }
    .badge-pending { background: #f5a62322; color: #f5a623; }
    .badge-overdue { background: #ff6a4f22; color: #ff6a4f; }
    .btn-action {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.22rem 0.55rem;
      background: transparent;
      color: var(--mist);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .btn-action:hover { color: var(--ink); border-color: var(--ink); }
    .btn-pdf {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.22rem 0.55rem;
      background: transparent;
      color: var(--alpine);
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn-delete {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.2rem 0.4rem;
      background: transparent;
      color: var(--mist);
      font-size: 0.8rem;
      cursor: pointer;
      line-height: 1;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-delete:hover { color: #ff6a4f; border-color: #ff6a4f; }
    .btn-danger-sm {
      border: 1px solid #ff6a4f;
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: #ff6a4f;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .empty { padding: 1rem; color: var(--mist); }
    .error { margin: 0; color: #ff6a4f; font-size: 0.9rem; }
    .muted { color: var(--mist); }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal { width: 100%; max-width: 32rem; padding: 1.5rem; max-height: 90dvh; overflow-y: auto; }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
    }
    .modal-header h2 { margin: 0; }
    .icon-btn {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.2rem 0.4rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
    }
    form { display: grid; gap: 0.75rem; }
    input, select, textarea {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.75rem;
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
      color: var(--ink);
      font-family: inherit;
      font-size: inherit;
      width: 100%;
      box-sizing: border-box;
    }
    input::placeholder { color: var(--mist); }
    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .field { display: grid; gap: 0.3rem; }
    label, .file-label { font-size: 0.82rem; color: var(--mist); font-weight: 500; }
    .modal-actions { display: flex; gap: 0.6rem; margin-top: 0.25rem; align-items: center; flex-wrap: wrap; }
    .modal-delete { margin-left: auto; display: flex; align-items: center; gap: 0.4rem; }
    .delete-confirm-label { font-size: 0.8rem; color: var(--mist); }
    .btn-ghost {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 1rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-ghost-sm {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.78rem;
    }
    .btn-delete-text {
      background: none;
      border: none;
      color: #ff6a4f;
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .btn-danger-sm {
      border: 1px solid #ff6a4f;
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: #ff6a4f;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `,
})
export class InvoicesComponent implements OnInit, OnDestroy {
  private readonly invoiceRepo = inject(InvoiceRepository);
  private readonly clientRepo = inject(ClientRepository);
  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly invoices = signal<Invoice[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly filter = signal<'all' | InvoiceStatus>('all');
  readonly editingId = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);

  private editingClientId = '';

  readonly invoiceCards = computed<InvoiceCard[]>(() => {
    const clientMap = new Map(this.clients().map((c) => [c.id, c.name]));
    return this.invoices().map((inv) => ({
      ...inv,
      status: invoiceStatus(inv),
      clientName: clientMap.get(inv.clientId) ?? '—',
    }));
  });

  readonly filteredInvoices = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.invoiceCards() : this.invoiceCards().filter((i) => i.status === f);
  });

  readonly pendingCount = computed(() => this.invoiceCards().filter((i) => i.status === 'pending').length);
  readonly overdueCount = computed(() => this.invoiceCards().filter((i) => i.status === 'overdue').length);
  readonly paidCount = computed(() => this.invoiceCards().filter((i) => i.status === 'paid').length);

  readonly form = new FormGroup({
    clientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    invoiceNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    issueDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dueDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<'one-off' | 'recurring'>('one-off', { nonNullable: true }),
  });

  ngOnInit(): void {
    let invoicesLoaded = false;
    let clientsLoaded = false;
    const checkDone = () => {
      if (invoicesLoaded && clientsLoaded) this.loading.set(false);
    };

    this.subs.add(
      this.invoiceRepo.watchAll().subscribe({
        next: (invoices) => { this.invoices.set(invoices); invoicesLoaded = true; checkDone(); },
        error: (err: unknown) => { this.error.set(this.errCode(err)); this.loading.set(false); },
      }),
    );
    this.subs.add(
      this.clientRepo.watchClients().subscribe({
        next: (clients) => { this.clients.set(clients); clientsLoaded = true; checkDone(); },
        error: () => { clientsLoaded = true; checkDone(); },
      }),
    );
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  openCreateModal(): void {
    this.editingId.set(null);
    this.editingClientId = '';
    this.form.controls.clientId.enable();
    this.form.reset({ type: 'one-off' });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(inv: InvoiceCard): void {
    this.editingId.set(inv.id);
    this.editingClientId = inv.clientId;
    this.form.controls.clientId.disable();
    this.form.reset({
      clientId: inv.clientId,
      invoiceNumber: inv.invoiceNumber,
      description: inv.description,
      amount: inv.amount,
      issueDate: toDateInput(inv.issueDate),
      dueDate: toDateInput(inv.dueDate),
      type: inv.type,
    });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingId.set(null);
  }

  async saveInvoice(): Promise<void> {
    const id = this.editingId();
    if (this.form.invalid && !id) { this.formError.set('Please fill in all required fields.'); return; }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.formError.set(null);
    try {
      if (id) {
        await this.invoiceRepo.update(id, {
          clientId: this.editingClientId,
          invoiceNumber: v.invoiceNumber.trim(),
          description: v.description.trim(),
          amount: Number(v.amount),
          issueDate: new Date(v.issueDate),
          dueDate: new Date(v.dueDate),
          type: v.type,
        });
      } else {
        await this.invoiceRepo.create({
          clientId: v.clientId,
          invoiceNumber: v.invoiceNumber.trim(),
          description: v.description.trim(),
          amount: Number(v.amount),
          issueDate: new Date(v.issueDate),
          dueDate: new Date(v.dueDate),
          type: v.type,
        });
      }
      this.closeModal();
    } catch (err: unknown) {
      this.formError.set(`Could not save invoice (${this.errCode(err)}).`);
    } finally {
      this.submitting.set(false);
    }
  }

  async markPaid(invoiceId: string): Promise<void> {
    try {
      await this.invoiceRepo.markPaid(invoiceId);
    } catch (err: unknown) {
      this.error.set(`Could not mark invoice as paid (${this.errCode(err)}).`);
    }
  }

  async markUnpaid(invoiceId: string): Promise<void> {
    try {
      await this.invoiceRepo.markUnpaid(invoiceId);
    } catch (err: unknown) {
      this.error.set(`Could not unmark invoice (${this.errCode(err)}).`);
    }
  }

  async confirmDelete(invoiceId: string): Promise<void> {
    try {
      await this.invoiceRepo.delete(invoiceId);
      this.confirmingDeleteId.set(null);
    } catch (err: unknown) {
      this.error.set(`Could not delete invoice (${this.errCode(err)}).`);
    }
  }

  private errCode(err: unknown): string {
    return typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : 'unknown';
  }
}
