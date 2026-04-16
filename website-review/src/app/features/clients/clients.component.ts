import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CarePlanRepository } from '../../core/data/care-plan.repository';
import { ClientRepository } from '../../core/data/client.repository';
import { InvoiceRepository } from '../../core/data/invoice.repository';
import {
  CarePlan,
  Invoice,
  carePlanStatus,
  invoiceStatus,
} from '../../core/models/billing.models';
import { Client } from '../../core/models/review.models';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe],
  template: `
    <main class="page">
      <div class="page-header">
        <div class="page-title">
          <p class="eyebrow">Admin</p>
          <h1 class="gradient-text">Workspace</h1>
          <p class="lead">Your clients, their invoices, and care plans.</p>
        </div>
        <button class="btn-primary" type="button" (click)="openModal()">Add Client</button>
      </div>

      @if (!loading()) {
        <div class="stat-grid">
          <div class="glass stat-card">
            <p class="stat-label">Total Earned</p>
            <p class="stat-value">{{ allEarned() | currency: 'GBP' }}</p>
            <p class="stat-sub">{{ paidCount() }} paid invoices</p>
          </div>
          <div class="glass stat-card">
            <p class="stat-label">Outstanding</p>
            <p class="stat-value outstanding">{{ allOutstanding() | currency: 'GBP' }}</p>
            <p class="stat-sub">{{ unpaidCount() }} unpaid invoices</p>
          </div>
          <div class="glass stat-card">
            <p class="stat-label">Overdue</p>
            <p class="stat-value overdue">{{ allOverdue() | currency: 'GBP' }}</p>
            <p class="stat-sub">{{ overdueInvoiceList().length }} overdue invoices</p>
          </div>
          <div class="glass stat-card">
            <p class="stat-label">Monthly MRR</p>
            <p class="stat-value care">{{ monthlyMRR() | currency: 'GBP' }}<span class="stat-cycle">/mo</span></p>
            <p class="stat-sub">{{ activeCarePlanCount() }} active care plans</p>
          </div>
        </div>

        <!-- Alert sections — only shown when there is something to act on -->
        @if (overdueInvoiceList().length > 0 || dueSoonPlanList().length > 0) {
          <div class="alerts-grid">
            @if (overdueInvoiceList().length > 0) {
              <section class="list-section">
                <div class="section-head">
                  <h2 class="list-heading">Overdue Invoices</h2>
                  <a routerLink="/billing" class="see-all">See all →</a>
                </div>
                <div class="alert-list">
                  @for (inv of overdueInvoiceList(); track inv.id) {
                    <a class="glass alert-row" [routerLink]="['/workspace', inv.clientId]">
                      <div class="alert-info">
                        <span class="alert-name">{{ inv.clientName }}</span>
                        <span class="alert-sub">{{ inv.invoiceNumber }} · {{ inv.description }}</span>
                      </div>
                      <div class="alert-right">
                        <span class="alert-amount">{{ inv.amount | currency: 'GBP' }}</span>
                        <span class="badge badge-overdue">overdue</span>
                      </div>
                    </a>
                  }
                </div>
              </section>
            }
            @if (dueSoonPlanList().length > 0) {
              <section class="list-section">
                <div class="section-head">
                  <h2 class="list-heading">Care Plans Due Soon</h2>
                  <a routerLink="/care-plans" class="see-all">See all →</a>
                </div>
                <div class="alert-list">
                  @for (plan of dueSoonPlanList(); track plan.id) {
                    <div class="glass alert-row">
                      <div class="alert-info">
                        <span class="alert-name">{{ plan.clientName }}</span>
                        <span class="alert-sub">{{ plan.name }} · due {{ plan.nextDueDate | date: 'd MMM' }}</span>
                      </div>
                      <div class="alert-right">
                        <span class="alert-amount">{{ plan.amount | currency: 'GBP' }}</span>
                        <span class="badge badge-due-soon">due soon</span>
                      </div>
                    </div>
                  }
                </div>
              </section>
            }
          </div>
        }
      }

      <section class="list-section">
        <h2 class="list-heading">All Clients</h2>

        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else {
          <div class="client-list">
            @for (client of clients(); track client.id) {
              <article class="glass client-row">
                <div class="client-info">
                  <a class="clickable client-name" [routerLink]="['/workspace', client.id]">{{ client.name }}</a>
                  <span class="client-email">{{ client.email }}</span>
                  @if (client.notes) {
                    <span class="client-notes">{{ client.notes }}</span>
                  }
                </div>
                <div class="row-right">
                  <div class="client-fin">
                    <span class="fin-paid">{{ clientTotalPaid(client.id) | currency: 'GBP' }}</span>
                    @if (clientOutstanding(client.id) > 0) {
                      <span class="fin-outstanding">{{ clientOutstanding(client.id) | currency: 'GBP' }} outstanding</span>
                    }
                  </div>
                  <div class="row-actions">
                    @if (confirmingDeleteId() === client.id) {
                      <button type="button" class="btn-danger-sm" (click)="confirmDelete(client.id)">Delete</button>
                      <button type="button" class="btn-ghost-sm" (click)="cancelDelete()">Cancel</button>
                    } @else {
                      <button type="button" class="icon-btn" title="Delete" (click)="requestDelete(client.id)">✕</button>
                    }
                  </div>
                </div>
              </article>
            } @empty {
              <article class="glass empty">No clients yet. Add your first client to get started.</article>
            }
          </div>
        }

        @if (error()) {
          <p class="error-msg">{{ error() }}</p>
        }
      </section>
    </main>

    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal glass" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Add Client</h2>
            <button type="button" class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="createClient()">
            <input formControlName="name" placeholder="Name" />
            <input formControlName="email" placeholder="Email" type="email" />
            <textarea formControlName="notes" placeholder="Notes (optional)" rows="3"></textarea>
            @if (formError()) {
              <p class="error-msg">{{ formError() }}</p>
            }
            <div class="modal-actions">
              <button class="btn-primary" type="submit" [disabled]="submitting()">
                {{ submitting() ? 'Saving…' : 'Add Client' }}
              </button>
              <button type="button" class="btn-ghost" (click)="closeModal()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .page {
      max-width: 72rem;
      margin: 0 auto;
      padding: 3rem 1.5rem 5rem;
      display: grid;
      gap: 2rem;
      align-content: start;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .page-title { display: grid; gap: 0.25rem; }
    .eyebrow {
      margin: 0;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
    }
    .page-title h1 {
      margin: 0;
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
    /* Stat cards */
    .stat-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    }
    .stat-card { padding: 1.1rem 1.25rem; display: grid; gap: 0.25rem; }
    .stat-label { margin: 0; font-size: 0.75rem; color: var(--mist); text-transform: uppercase; letter-spacing: 0.06em; }
    .stat-value { margin: 0; font-size: 1.55rem; font-weight: 700; color: var(--ink); }
    .stat-value.outstanding { color: #f5a623; }
    .stat-value.overdue { color: #ff6a4f; }
    .stat-value.care { color: var(--alpine); }
    .stat-cycle { font-size: 1rem; font-weight: 400; color: var(--mist); }
    .stat-sub { margin: 0; font-size: 0.75rem; color: var(--mist); }
    /* Alert sections */
    .alerts-grid {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
    }
    .alert-list { display: grid; gap: 0.4rem; }
    .alert-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      text-decoration: none;
      color: inherit;
      flex-wrap: wrap;
    }
    a.alert-row { transition: background 0.12s; }
    a.alert-row:hover { background: color-mix(in srgb, var(--paper) 60%, white 40%); }
    .alert-info { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .alert-name { font-weight: 600; font-size: 0.9rem; color: var(--ink); }
    .alert-sub { font-size: 0.78rem; color: var(--mist); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .alert-right { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
    .alert-amount { font-weight: 700; font-size: 0.9rem; }
    /* Badges */
    .badge {
      padding: 0.18rem 0.5rem;
      border-radius: 99px;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .badge-overdue { background: #ff6a4f22; color: #ff6a4f; }
    .badge-due-soon { background: #f5a62322; color: #f5a623; }
    /* Section layout */
    .list-section { display: grid; gap: 0.75rem; }
    .section-head { display: flex; justify-content: space-between; align-items: center; }
    .list-heading {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--mist);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .see-all { color: var(--ember); text-decoration: none; font-size: 0.82rem; font-weight: 600; }
    /* Client list */
    .client-list { display: grid; gap: 0.4rem; }
    .client-row {
      padding: 0.9rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .client-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }
    .client-name { font-weight: 600; font-size: 0.95rem; width: fit-content; }
    .client-email { color: var(--alpine); font-size: 0.83rem; }
    .client-notes { color: var(--mist); font-size: 0.8rem; overflow-wrap: anywhere; }
    .row-right {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-shrink: 0;
    }
    .client-fin {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.1rem;
    }
    .fin-paid { font-weight: 700; font-size: 0.9rem; color: var(--ink); }
    .fin-outstanding { font-size: 0.75rem; color: #f5a623; font-weight: 500; }
    .row-actions {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .icon-btn {
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 0.2rem 0.4rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.82rem;
      line-height: 1;
      transition: color 0.15s, border-color 0.15s;
    }
    .icon-btn:hover { color: #ff6a4f; border-color: #ff6a4f; }
    .btn-danger-sm {
      border: 1px solid #ff6a4f;
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: #ff6a4f;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .btn-ghost-sm {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.75rem;
    }
    .btn-primary {
      border: 0;
      border-radius: var(--radius-md);
      padding: 0.65rem 1.1rem;
      background: var(--ember);
      color: var(--paper);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-ghost {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 1rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.9rem;
    }
    .empty { padding: 1rem 1.25rem; color: var(--mist); font-size: 0.9rem; }
    .error-msg { margin: 0; color: #ff6a4f; font-size: 0.875rem; }
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
    .modal { width: 100%; max-width: 28rem; padding: 1.5rem; }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
    }
    .modal-header h2 { margin: 0; }
    form { display: grid; gap: 0.75rem; }
    input, textarea {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.75rem;
      background: color-mix(in srgb, var(--paper) 84%, white 16%);
      color: var(--ink);
      font-family: inherit;
      font-size: inherit;
      resize: vertical;
      width: 100%;
      box-sizing: border-box;
    }
    input::placeholder, textarea::placeholder { color: var(--mist); }
    .modal-actions { display: flex; gap: 0.6rem; margin-top: 0.25rem; }
  `,
})
export class ClientsComponent implements OnInit, OnDestroy {
  private readonly clientRepository = inject(ClientRepository);
  private readonly invoiceRepository = inject(InvoiceRepository);
  private readonly carePlanRepository = inject(CarePlanRepository);
  private readonly subscriptions = new Subscription();

  readonly clients = signal<Client[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly carePlans = signal<CarePlan[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);

  private readonly clientMap = computed(() =>
    new Map(this.clients().map((c) => [c.id, c.name])),
  );

  readonly allEarned = computed(() =>
    this.invoices().filter((i) => i.paidDate).reduce((s, i) => s + i.amount, 0),
  );
  readonly allOutstanding = computed(() =>
    this.invoices().filter((i) => !i.paidDate).reduce((s, i) => s + i.amount, 0),
  );
  readonly allOverdue = computed(() =>
    this.invoices().filter((i) => invoiceStatus(i) === 'overdue').reduce((s, i) => s + i.amount, 0),
  );
  readonly paidCount = computed(() => this.invoices().filter((i) => i.paidDate).length);
  readonly unpaidCount = computed(() => this.invoices().filter((i) => !i.paidDate).length);

  readonly monthlyMRR = computed(() =>
    this.carePlans()
      .filter((p) => p.active)
      .reduce((sum, p) => sum + (p.billingCycle === 'yearly' ? p.amount / 12 : p.amount), 0),
  );
  readonly activeCarePlanCount = computed(() => this.carePlans().filter((p) => p.active).length);

  readonly overdueInvoiceList = computed(() =>
    this.invoices()
      .filter((i) => invoiceStatus(i) === 'overdue')
      .map((i) => ({ ...i, clientName: this.clientMap().get(i.clientId) ?? '—' })),
  );

  readonly dueSoonPlanList = computed(() =>
    this.carePlans()
      .filter((p) => carePlanStatus(p) === 'due-soon')
      .map((p) => ({ ...p, clientName: this.clientMap().get(p.clientId) ?? '—' })),
  );

  clientTotalPaid(clientId: string): number {
    return this.invoices()
      .filter((i) => i.clientId === clientId && i.paidDate)
      .reduce((s, i) => s + i.amount, 0);
  }

  clientOutstanding(clientId: string): number {
    return this.invoices()
      .filter((i) => i.clientId === clientId && !i.paidDate)
      .reduce((s, i) => s + i.amount, 0);
  }

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    notes: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    let clientsLoaded = false;
    let invoicesLoaded = false;
    let plansLoaded = false;
    const checkDone = () => {
      if (clientsLoaded && invoicesLoaded && plansLoaded) this.loading.set(false);
    };

    this.subscriptions.add(
      this.clientRepository.watchClients().subscribe({
        next: (clients) => { this.clients.set(clients); clientsLoaded = true; checkDone(); },
        error: (err: unknown) => {
          const code = typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: string }).code) : 'unknown';
          this.error.set(`Unable to load clients (${code}).`);
          this.loading.set(false);
        },
      }),
    );
    this.subscriptions.add(
      this.invoiceRepository.watchAll().subscribe({
        next: (invoices) => { this.invoices.set(invoices); invoicesLoaded = true; checkDone(); },
        error: () => { invoicesLoaded = true; checkDone(); },
      }),
    );
    this.subscriptions.add(
      this.carePlanRepository.watchAll().subscribe({
        next: (plans) => { this.carePlans.set(plans); plansLoaded = true; checkDone(); },
        error: () => { plansLoaded = true; checkDone(); },
      }),
    );
  }

  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }

  openModal(): void {
    this.form.reset({ name: '', email: '', notes: '' });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.formError.set(null);
  }

  async createClient(): Promise<void> {
    const name = this.form.controls.name.value.trim();
    const email = this.form.controls.email.value.trim();
    const notes = this.form.controls.notes.value.trim();
    if (!name || !email) { this.formError.set('Name and email are required.'); return; }
    if (this.form.controls.email.invalid) { this.formError.set('Please enter a valid email address.'); return; }
    this.submitting.set(true);
    this.formError.set(null);
    try {
      await this.clientRepository.createClient({ name, email, notes: notes || undefined });
      this.closeModal();
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code) : 'unknown';
      this.formError.set(`Could not add client (${code}).`);
    } finally {
      this.submitting.set(false);
    }
  }

  requestDelete(clientId: string): void { this.confirmingDeleteId.set(clientId); }
  cancelDelete(): void { this.confirmingDeleteId.set(null); }

  async confirmDelete(clientId: string): Promise<void> {
    try {
      await this.clientRepository.deleteClient(clientId);
      this.confirmingDeleteId.set(null);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code) : 'unknown';
      this.error.set(`Could not delete client (${code}).`);
    }
  }
}
