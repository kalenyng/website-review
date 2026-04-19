import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CarePlanRepository } from '../../core/data/care-plan.repository';
import { ClientRepository } from '../../core/data/client.repository';
import { InvoiceRepository } from '../../core/data/invoice.repository';
import {
  CarePlan,
  CarePlanStatus,
  Invoice,
  InvoiceStatus,
  carePlanStatus,
  invoiceStatus,
} from '../../core/models/billing.models';
import { Client } from '../../core/models/review.models';
type InvoiceRow = Invoice & { status: InvoiceStatus };
type CarePlanRow = CarePlan & { status: CarePlanStatus };

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CurrencyPipe, DatePipe],
  template: `
    <main class="dashboard">
      <a [routerLink]="backLink().path" class="back-link">← Back to {{ backLink().label }}</a>

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else if (!client()) {
        <p class="error">Client not found.</p>
      } @else {
        <!-- Client info -->
        <section class="client-info glass">
          <div class="client-header">
            <div>
              <p class="eyebrow">Client</p>
              <h1>{{ client()!.name }}</h1>
              <a [href]="'mailto:' + client()!.email" class="client-email">{{ client()!.email }}</a>
              @if (client()!.notes) {
                <p class="client-notes">{{ client()!.notes }}</p>
              }
            </div>
          </div>

          <!-- Financial summary bar -->
          <div class="fin-summary">
            <div class="fin-stat">
              <span class="fin-label">Total Paid</span>
              <span class="fin-value paid">{{ totalPaid() | currency: 'GBP' }}</span>
            </div>
            <div class="fin-divider"></div>
            <div class="fin-stat">
              <span class="fin-label">Outstanding</span>
              <span class="fin-value outstanding">{{ totalOutstanding() | currency: 'GBP' }}</span>
            </div>
            <div class="fin-divider"></div>
            <div class="fin-stat">
              <span class="fin-label">Overdue</span>
              <span class="fin-value overdue">{{ totalOverdue() | currency: 'GBP' }}</span>
            </div>
          </div>
        </section>

        <!-- Care plan -->
        @if (carePlanRows().length > 0) {
          <section class="section">
            <h2 class="section-title">Care Plan</h2>
            <div class="plan-list">
              @for (plan of carePlanRows(); track plan.id) {
                <div class="glass plan-row" [class.is-inactive]="!plan.active">
                  <div class="plan-body">
                    <span class="plan-name">{{ plan.name }}</span>
                    <span class="plan-cycle">{{ plan.billingCycle }}</span>
                  </div>
                  <div class="plan-right">
                    <span class="plan-amount">{{ plan.amount | currency: 'GBP' }}</span>
                    <span class="plan-due">Next due {{ plan.nextDueDate | date: 'd MMM y' }}</span>
                    <span class="badge" [class]="'badge-' + plan.status">{{ plan.status }}</span>
                    <button
                      class="btn-toggle"
                      type="button"
                      (click)="togglePlan(plan.id, plan.active)"
                    >{{ plan.active ? 'Deactivate' : 'Activate' }}</button>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <!-- Invoice timeline -->
        <section class="section">
          <div class="section-head">
            <h2 class="section-title">Invoice Timeline</h2>
            <button class="btn-primary" type="button" (click)="openModal()">New Invoice</button>
          </div>

          @if (invoiceRows().length === 0) {
            <p class="glass empty">No invoices yet for this client.</p>
          } @else {
            <div class="timeline">
              @for (inv of invoiceRows(); track inv.id) {
                <article
                  class="glass timeline-row"
                  [class.is-paid]="inv.status === 'paid'"
                  [class.is-overdue]="inv.status === 'overdue'"
                >
                  <div class="tl-left">
                    <span class="tl-num">{{ inv.invoiceNumber }}</span>
                    <div class="tl-body">
                      <span class="tl-desc">{{ inv.description }}</span>
                      <div class="tl-dates">
                        <span>Issued {{ inv.issueDate | date: 'd MMM y' }}</span>
                        @if (inv.paidDate) {
                          <span class="paid-on">· Paid {{ inv.paidDate | date: 'd MMM y' }}</span>
                        } @else {
                          <span>· Due {{ inv.dueDate | date: 'd MMM y' }}</span>
                        }
                      </div>
                    </div>
                  </div>
                  <div class="tl-right">
                    <span class="tl-amount">{{ inv.amount | currency: 'GBP' }}</span>
                    <span class="badge" [class]="'badge-' + inv.status">{{ inv.status }}</span>
                    @if (inv.status === 'paid') {
                      <button class="btn-mark-paid" type="button" (click)="markUnpaid(inv.id)">Unmark paid</button>
                    } @else {
                      <button class="btn-mark-paid" type="button" (click)="markPaid(inv.id)">Mark paid</button>
                    }
                    <button class="btn-mark-paid" type="button" (click)="openEditModal(inv)">Edit</button>
                    @if (inv.fileUrl) {
                      <a [href]="inv.fileUrl" target="_blank" rel="noopener" class="btn-pdf">PDF</a>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>
      }

      @if (pageError()) {
        <p class="error">{{ pageError() }}</p>
      }
    </main>

    <!-- Create / Edit invoice modal -->
    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal glass" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId() ? 'Edit Invoice' : 'New Invoice' }}</h2>
            <button type="button" class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveInvoice()">
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
      padding: var(--page-pad-y-start) var(--page-pad-inline) var(--page-pad-y-end);
      display: grid;
      gap: 2rem;
      align-content: start;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    /* Client info card */
    .client-info { padding: 1.5rem; display: grid; gap: 1.25rem; }
    .client-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .eyebrow {
      margin: 0;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
    }
    .client-info h1 { margin: 0.2rem 0 0.3rem; font-size: 1.6rem; }
    .client-email {
      color: var(--alpine);
      font-size: 0.9rem;
      text-decoration: none;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .client-email:hover { text-decoration: underline; }
    .client-notes { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--mist); }
    .back-link { color: var(--mist); text-decoration: none; font-size: 0.875rem; white-space: nowrap; }
    .back-link:hover { color: var(--ink); }
    /* Financial summary bar */
    .fin-summary {
      display: flex;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      min-width: 0;
    }
    .fin-stat {
      flex: 1 1 0;
      min-width: 0;
      padding: 0.9rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .fin-divider {
      width: 1px;
      background: var(--border);
      flex-shrink: 0;
    }
    .fin-label { font-size: 0.75rem; color: var(--mist); text-transform: uppercase; letter-spacing: 0.05em; }
    .fin-value { font-size: 1.3rem; font-weight: 700; }
    .fin-value.paid { color: var(--ink); }
    .fin-value.outstanding { color: #f5a623; }
    .fin-value.overdue { color: #ff6a4f; }
    /* Sections */
    .section { display: grid; gap: 0.75rem; }
    .section-head { display: flex; justify-content: space-between; align-items: center; }
    .section-title { margin: 0; font-size: 1.1rem; }
    /* Care plan rows */
    .plan-list { display: grid; gap: 0.5rem; }
    .plan-row {
      padding: 0.8rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      min-width: 0;
      transition: opacity 0.15s;
    }
    .plan-row.is-inactive { opacity: 0.5; }
    .plan-body { display: flex; flex-direction: column; gap: 0.1rem; }
    .plan-name { font-weight: 600; font-size: 0.95rem; }
    .plan-cycle { font-size: 0.8rem; color: var(--mist); }
    .plan-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      flex-shrink: 1;
      min-width: 0;
    }
    .plan-amount { font-weight: 700; }
    .plan-due { font-size: 0.82rem; color: var(--mist); }
    /* Timeline */
    .timeline { display: grid; gap: 0.5rem; }
    .timeline-row {
      padding: 0.9rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      min-width: 0;
      transition: opacity 0.15s;
    }
    .timeline-row.is-paid { opacity: 0.5; }
    .timeline-row.is-overdue { border-color: #ff6a4f55; }
    .tl-left { display: flex; gap: 0.75rem; align-items: flex-start; min-width: 0; }
    .tl-num {
      font-size: 0.75rem;
      color: var(--mist);
      white-space: nowrap;
      padding-top: 0.2rem;
      min-width: 4.5rem;
    }
    .tl-body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .tl-desc { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tl-dates { font-size: 0.8rem; color: var(--mist); display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .paid-on { color: #4caf50; }
    .tl-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 1;
      min-width: 0;
      flex-wrap: wrap;
    }
    .tl-amount { font-weight: 700; font-size: 0.95rem; }
    /* Badges */
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
    .badge-active { background: #4caf5022; color: #4caf50; }
    .badge-due-soon { background: #f5a62322; color: #f5a623; }
    .badge-inactive { background: color-mix(in srgb, var(--paper) 84%, white 16%); color: var(--mist); }
    /* Buttons */
    .btn-primary {
      border: 0;
      border-radius: var(--radius-md);
      padding: 0.55rem 0.9rem;
      background: var(--ember);
      color: var(--paper);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .btn-mark-paid {
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
    .btn-mark-paid:hover { color: var(--ink); border-color: var(--ink); }
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
    .btn-toggle {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.22rem 0.55rem;
      background: transparent;
      color: var(--mist);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-toggle:hover { color: var(--ink); border-color: var(--ink); }
    .btn-pdf {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.22rem 0.55rem;
      background: transparent;
      color: var(--alpine);
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
    }
    .empty { padding: 1rem; color: var(--mist); }
    .error { margin: 0; color: #ff6a4f; font-size: 0.9rem; }
    .muted { color: var(--mist); }
    /* Modal */
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
    input, select {
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
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    @media (max-width: 40rem) {
      .fin-summary {
        flex-direction: column;
      }
      .fin-divider {
        display: none;
      }
      .fin-stat {
        border-bottom: 1px solid var(--border);
        padding: 0.75rem 1rem;
      }
      .fin-stat:last-child {
        border-bottom: none;
      }
      .fin-value {
        font-size: 1.15rem;
      }
      .client-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }
      .plan-row,
      .timeline-row {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
      }
      .plan-right,
      .tl-right {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
      }
      .tl-desc {
        white-space: normal;
      }
    }
  `,
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly clientRepo = inject(ClientRepository);
  private readonly invoiceRepo = inject(InvoiceRepository);
  private readonly carePlanRepo = inject(CarePlanRepository);
  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly pageError = signal<string | null>(null);
  readonly client = signal<Client | null>(null);
  readonly invoices = signal<Invoice[]>([]);
  readonly carePlans = signal<CarePlan[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);

  private clientId = '';

  readonly backLink = computed(() => {
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'billing') return { path: '/billing', label: 'Billing' };
    return { path: '/', label: 'Workspace' };
  });

  readonly invoiceRows = computed<InvoiceRow[]>(() =>
    this.invoices().map((inv) => ({ ...inv, status: invoiceStatus(inv) })),
  );

  readonly carePlanRows = computed<CarePlanRow[]>(() =>
    this.carePlans().map((p) => ({ ...p, status: carePlanStatus(p) })),
  );

  readonly totalPaid = computed(() =>
    this.invoices().filter((i) => i.paidDate).reduce((s, i) => s + i.amount, 0),
  );
  readonly totalOutstanding = computed(() =>
    this.invoices().filter((i) => !i.paidDate).reduce((s, i) => s + i.amount, 0),
  );
  readonly totalOverdue = computed(() =>
    this.invoiceRows()
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => s + i.amount, 0),
  );

  readonly form = new FormGroup({
    invoiceNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    issueDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dueDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<'one-off' | 'recurring'>('one-off', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';

    let clientLoaded = false;
    let invoicesLoaded = false;
    let plansLoaded = false;

    const checkDone = () => {
      if (clientLoaded && invoicesLoaded && plansLoaded) this.loading.set(false);
    };

    this.subs.add(
      this.clientRepo.watchClients().subscribe({
        next: (clients) => {
          const found = clients.find((c) => c.id === this.clientId) ?? null;
          this.client.set(found);
          clientLoaded = true;
          checkDone();
        },
        error: () => { clientLoaded = true; checkDone(); },
      }),
    );
    this.subs.add(
      this.invoiceRepo.watchByClient(this.clientId).subscribe({
        next: (invoices) => { this.invoices.set(invoices); invoicesLoaded = true; checkDone(); },
        error: (err: unknown) => { this.pageError.set(this.errCode(err)); invoicesLoaded = true; checkDone(); },
      }),
    );
    this.subs.add(
      this.carePlanRepo.watchByClient(this.clientId).subscribe({
        next: (plans) => { this.carePlans.set(plans); plansLoaded = true; checkDone(); },
        error: () => { plansLoaded = true; checkDone(); },
      }),
    );
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  openModal(): void {
    this.editingId.set(null);
    this.form.reset({ type: 'one-off' });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(inv: InvoiceRow): void {
    this.editingId.set(inv.id);
    this.form.reset({
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
    if (this.form.invalid) { this.formError.set('Please fill in all required fields.'); return; }
    const v = this.form.getRawValue();
    const id = this.editingId();
    this.submitting.set(true);
    this.formError.set(null);
    try {
      if (id) {
        await this.invoiceRepo.update(id, {
          clientId: this.clientId,
          invoiceNumber: v.invoiceNumber.trim(),
          description: v.description.trim(),
          amount: Number(v.amount),
          issueDate: new Date(v.issueDate),
          dueDate: new Date(v.dueDate),
          type: v.type,
        });
      } else {
        await this.invoiceRepo.create({
          clientId: this.clientId,
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
      this.pageError.set(`Could not mark as paid (${this.errCode(err)}).`);
    }
  }

  async markUnpaid(invoiceId: string): Promise<void> {
    try {
      await this.invoiceRepo.markUnpaid(invoiceId);
    } catch (err: unknown) {
      this.pageError.set(`Could not unmark invoice (${this.errCode(err)}).`);
    }
  }

  async confirmDelete(invoiceId: string): Promise<void> {
    try {
      await this.invoiceRepo.delete(invoiceId);
      this.confirmingDeleteId.set(null);
    } catch (err: unknown) {
      this.pageError.set(`Could not delete invoice (${this.errCode(err)}).`);
    }
  }

  async togglePlan(planId: string, currentlyActive: boolean): Promise<void> {
    try {
      await this.carePlanRepo.toggleActive(planId, !currentlyActive);
    } catch (err: unknown) {
      this.pageError.set(`Could not update plan (${this.errCode(err)}).`);
    }
  }

  private errCode(err: unknown): string {
    return typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : 'unknown';
  }
}
