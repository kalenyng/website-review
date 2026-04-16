import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CarePlanRepository } from '../../core/data/care-plan.repository';
import { ClientRepository } from '../../core/data/client.repository';
import { CarePlan, CarePlanStatus, carePlanStatus } from '../../core/models/billing.models';
import { Client } from '../../core/models/review.models';
type CarePlanCard = CarePlan & { status: CarePlanStatus; clientName: string };

@Component({
  selector: 'app-care-plans',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  template: `
    <main class="dashboard">
      <div class="page-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1 class="gradient-text">Care Plans</h1>
          <p class="lead">Recurring revenue from website care plans.</p>
        </div>
        <div class="header-right">
          @if (!loading()) {
            <div class="mrr-badge glass">
              <span class="mrr-value">{{ monthlyRevenue() | currency: 'GBP' }}</span>
              <span class="mrr-label">/ mo MRR</span>
            </div>
          }
          <button class="btn-primary" type="button" (click)="openModal()">New Care Plan</button>
        </div>
      </div>

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else {
        <div class="plan-list">
          @for (plan of planCards(); track plan.id) {
            <article class="glass plan-row" [class.is-inactive]="!plan.active">
              <div class="plan-left">
                <div class="plan-body">
                  <span class="plan-name">{{ plan.clientName }}</span>
                  <span class="plan-sub">{{ plan.name }} · {{ plan.billingCycle }}</span>
                </div>
              </div>
              <div class="plan-right">
                <span class="plan-amount">{{ plan.amount | currency: 'GBP' }}</span>
                <div class="plan-dates">
                  <span>Next due {{ plan.nextDueDate | date: 'd MMM y' }}</span>
                </div>
                <div class="plan-actions">
                  <span class="badge" [class]="'badge-' + plan.status">{{ plan.status }}</span>
                  <button
                    class="btn-toggle"
                    type="button"
                    (click)="toggleActive(plan.id, plan.active)"
                  >{{ plan.active ? 'Deactivate' : 'Activate' }}</button>
                </div>
              </div>
            </article>
          } @empty {
            <p class="glass empty">No care plans yet. Create one above.</p>
          }
        </div>
      }

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </main>

    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal glass" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>New Care Plan</h2>
            <button type="button" class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="createPlan()">
            <select formControlName="clientId">
              <option value="">Select client…</option>
              @for (client of clients(); track client.id) {
                <option [value]="client.id">{{ client.name }}</option>
              }
            </select>
            <input formControlName="name" placeholder="Plan name (e.g. Website Care Plan)" />
            <input formControlName="amount" type="number" min="0" step="0.01" placeholder="Amount (£)" />
            <select formControlName="billingCycle">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <div class="field">
              <label>Next due date</label>
              <input formControlName="nextDueDate" type="date" />
            </div>
            @if (formError()) {
              <p class="error">{{ formError() }}</p>
            }
            <div class="modal-actions">
              <button class="btn-primary" type="submit" [disabled]="submitting()">
                {{ submitting() ? 'Saving…' : 'Create Plan' }}
              </button>
              <button type="button" class="btn-ghost" (click)="closeModal()">Cancel</button>
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
    .header-right { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .mrr-badge {
      padding: 0.4rem 0.9rem;
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
    }
    .mrr-value { font-weight: 700; font-size: 1.1rem; color: var(--alpine); }
    .mrr-label { font-size: 0.75rem; color: var(--mist); }
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
    .plan-list { display: grid; gap: 0.5rem; }
    .plan-row {
      padding: 0.9rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      transition: opacity 0.15s;
    }
    .plan-row.is-inactive { opacity: 0.5; }
    .plan-left { display: flex; gap: 0.75rem; align-items: flex-start; min-width: 0; }
    .plan-body { display: flex; flex-direction: column; gap: 0.15rem; }
    .plan-name { font-weight: 600; font-size: 0.95rem; }
    .plan-sub { font-size: 0.82rem; color: var(--mist); }
    .plan-right { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; flex-wrap: wrap; }
    .plan-amount { font-weight: 700; font-size: 1rem; }
    .plan-dates { font-size: 0.8rem; color: var(--mist); }
    .plan-actions { display: flex; align-items: center; gap: 0.4rem; }
    .badge {
      padding: 0.2rem 0.55rem;
      border-radius: 99px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .badge-active { background: #4caf5022; color: #4caf50; }
    .badge-due-soon { background: #f5a62322; color: #f5a623; }
    .badge-overdue { background: #ff6a4f22; color: #ff6a4f; }
    .badge-inactive { background: color-mix(in srgb, var(--paper) 84%, white 16%); color: var(--mist); }
    .btn-toggle {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.25rem 0.6rem;
      background: transparent;
      color: var(--mist);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-toggle:hover { color: var(--ink); border-color: var(--ink); }
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
    .modal { width: 100%; max-width: 28rem; padding: 1.5rem; }
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
    .field { display: grid; gap: 0.3rem; }
    label { font-size: 0.82rem; color: var(--mist); font-weight: 500; }
    .modal-actions { display: flex; gap: 0.6rem; margin-top: 0.25rem; }
    .btn-ghost {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 1rem;
      background: transparent;
      color: var(--mist);
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `,
})
export class CarePlansComponent implements OnInit, OnDestroy {
  private readonly carePlanRepo = inject(CarePlanRepository);
  private readonly clientRepo = inject(ClientRepository);
  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly plans = signal<CarePlan[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly planCards = computed<CarePlanCard[]>(() => {
    const clientMap = new Map(this.clients().map((c) => [c.id, c.name]));
    return this.plans().map((p) => ({
      ...p,
      status: carePlanStatus(p),
      clientName: clientMap.get(p.clientId) ?? '—',
    }));
  });

  readonly activeCount = computed(() => this.plans().filter((p) => p.active).length);
  readonly monthlyRevenue = computed(() =>
    this.plans()
      .filter((p) => p.active)
      .reduce((sum, p) => sum + (p.billingCycle === 'yearly' ? p.amount / 12 : p.amount), 0),
  );

  readonly form = new FormGroup({
    clientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    billingCycle: new FormControl<'monthly' | 'yearly'>('monthly', { nonNullable: true }),
    nextDueDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    let plansLoaded = false;
    let clientsLoaded = false;
    const checkDone = () => { if (plansLoaded && clientsLoaded) this.loading.set(false); };

    this.subs.add(
      this.carePlanRepo.watchAll().subscribe({
        next: (plans) => { this.plans.set(plans); plansLoaded = true; checkDone(); },
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

  openModal(): void {
    this.form.reset({ billingCycle: 'monthly' });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void { this.modalOpen.set(false); }

  async createPlan(): Promise<void> {
    if (this.form.invalid) { this.formError.set('Please fill in all required fields.'); return; }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.formError.set(null);
    try {
      await this.carePlanRepo.create({
        clientId: v.clientId,
        name: v.name.trim(),
        amount: Number(v.amount),
        billingCycle: v.billingCycle,
        nextDueDate: new Date(v.nextDueDate),
      });
      this.closeModal();
    } catch (err: unknown) {
      this.formError.set(`Could not create plan (${this.errCode(err)}).`);
    } finally {
      this.submitting.set(false);
    }
  }

  async toggleActive(planId: string, currentlyActive: boolean): Promise<void> {
    try {
      await this.carePlanRepo.toggleActive(planId, !currentlyActive);
    } catch (err: unknown) {
      this.error.set(`Could not update plan (${this.errCode(err)}).`);
    }
  }

  private errCode(err: unknown): string {
    return typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : 'unknown';
  }
}
