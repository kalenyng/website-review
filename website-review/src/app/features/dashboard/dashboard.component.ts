import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CarePlanRepository } from '../../core/data/care-plan.repository';
import { InvoiceRepository } from '../../core/data/invoice.repository';
import { CarePlan, Invoice, carePlanStatus, invoiceStatus } from '../../core/models/billing.models';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <main class="dashboard">
      <div class="page-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1 class="gradient-text">Overview</h1>
          <p class="lead">A snapshot of your business finances.</p>
        </div>
        <a routerLink="/billing" class="btn-secondary">Go to Billing →</a>
      </div>

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else {
        <div class="stat-grid">
          <div class="glass stat-card">
            <p class="stat-label">Total Earned</p>
            <p class="stat-value">{{ totalEarned() | currency: 'GBP' }}</p>
            <p class="stat-sub">{{ paidInvoices().length }} paid invoices</p>
          </div>
          <div class="glass stat-card">
            <p class="stat-label">Outstanding</p>
            <p class="stat-value outstanding">{{ totalOutstanding() | currency: 'GBP' }}</p>
            <p class="stat-sub">{{ unpaidInvoices().length }} unpaid invoices</p>
          </div>
          <div class="glass stat-card">
            <p class="stat-label">Overdue</p>
            <p class="stat-value overdue">{{ totalOverdue() | currency: 'GBP' }}</p>
            <p class="stat-sub">{{ overdueInvoices().length }} overdue invoices</p>
          </div>
          <div class="glass stat-card">
            <p class="stat-label">Monthly MRR</p>
            <p class="stat-value care">{{ monthlyCarePlanRevenue() | currency: 'GBP' }}<span class="stat-cycle">/mo</span></p>
            <p class="stat-sub">{{ activeCarePlans().length }} active care plans</p>
          </div>
        </div>

        <section class="section">
          <div class="section-head">
            <h2>Overdue Invoices</h2>
            <a routerLink="/billing" class="see-all">See all in Billing →</a>
          </div>
          @if (overdueInvoices().length === 0) {
            <p class="muted empty-msg">No overdue invoices.</p>
          } @else {
            <div class="list">
              @for (inv of overdueInvoices(); track inv.id) {
                <div class="glass list-row">
                  <div class="row-main">
                    <span class="inv-num">{{ inv.invoiceNumber }}</span>
                    <span class="inv-desc">{{ inv.description }}</span>
                  </div>
                  <div class="row-meta">
                    <span class="amount">{{ inv.amount | currency: 'GBP' }}</span>
                    <span class="due-date">Due {{ inv.dueDate | date: 'd MMM y' }}</span>
                    <span class="badge badge-overdue">overdue</span>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <section class="section">
          <div class="section-head">
            <h2>Upcoming Care Plans</h2>
            <a routerLink="/care-plans" class="see-all">See all Care Plans →</a>
          </div>
          @if (dueSoonCarePlans().length === 0) {
            <p class="muted empty-msg">No care plans due within 7 days.</p>
          } @else {
            <div class="list">
              @for (plan of dueSoonCarePlans(); track plan.id) {
                <div class="glass list-row">
                  <div class="row-main">
                    <span class="inv-desc">{{ plan.name }}</span>
                  </div>
                  <div class="row-meta">
                    <span class="amount">{{ plan.amount | currency: 'GBP' }}</span>
                    <span class="due-date">Due {{ plan.nextDueDate | date: 'd MMM y' }}</span>
                    <span class="badge badge-due-soon">due soon</span>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .dashboard {
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
    .btn-secondary {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.55rem 1rem;
      background: transparent;
      color: var(--ember);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      transition: border-color 0.15s;
    }
    .btn-secondary:hover { border-color: var(--ember); }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    .stat-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    }
    .stat-card { padding: 1.2rem 1.4rem; display: grid; gap: 0.2rem; }
    .stat-label { margin: 0; font-size: 0.8rem; color: var(--mist); text-transform: uppercase; letter-spacing: 0.06em; }
    .stat-value { margin: 0; font-size: 1.7rem; font-weight: 700; color: var(--ink); }
    .stat-value.outstanding { color: #f5a623; }
    .stat-value.overdue { color: #ff6a4f; }
    .stat-value.care { color: var(--alpine); }
    .stat-cycle { font-size: 1rem; font-weight: 400; color: var(--mist); }
    .stat-sub { margin: 0; font-size: 0.8rem; color: var(--mist); }
    .section { display: grid; gap: 0.75rem; }
    .section-head { display: flex; justify-content: space-between; align-items: center; }
    .section-head h2 { margin: 0; }
    .see-all { color: var(--ember); text-decoration: none; font-size: 0.88rem; font-weight: 600; }
    .list { display: grid; gap: 0.5rem; }
    .list-row {
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .row-main { display: flex; gap: 0.75rem; align-items: center; min-width: 0; }
    .inv-num { font-size: 0.8rem; color: var(--mist); white-space: nowrap; }
    .inv-desc { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-meta { display: flex; gap: 0.75rem; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
    .amount { font-weight: 600; }
    .due-date { font-size: 0.85rem; color: var(--mist); }
    .badge {
      padding: 0.2rem 0.5rem;
      border-radius: 99px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-overdue { background: #ff6a4f22; color: #ff6a4f; }
    .badge-due-soon { background: #f5a62322; color: #f5a623; }
    .muted { color: var(--mist); }
    .empty-msg { font-size: 0.9rem; }
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly invoiceRepo = inject(InvoiceRepository);
  private readonly carePlanRepo = inject(CarePlanRepository);
  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly invoices = signal<Invoice[]>([]);
  readonly carePlans = signal<CarePlan[]>([]);

  readonly paidInvoices = computed(() => this.invoices().filter((i) => i.paidDate));
  readonly unpaidInvoices = computed(() => this.invoices().filter((i) => !i.paidDate));
  readonly overdueInvoices = computed(() =>
    this.invoices().filter((i) => invoiceStatus(i) === 'overdue'),
  );

  readonly totalEarned = computed(() =>
    this.paidInvoices().reduce((sum, i) => sum + i.amount, 0),
  );
  readonly totalOutstanding = computed(() =>
    this.unpaidInvoices().reduce((sum, i) => sum + i.amount, 0),
  );
  readonly totalOverdue = computed(() =>
    this.overdueInvoices().reduce((sum, i) => sum + i.amount, 0),
  );

  readonly activeCarePlans = computed(() => this.carePlans().filter((p) => p.active));
  readonly dueSoonCarePlans = computed(() =>
    this.carePlans().filter((p) => carePlanStatus(p) === 'due-soon'),
  );
  readonly monthlyCarePlanRevenue = computed(() =>
    this.activeCarePlans().reduce((sum, p) => {
      const monthly = p.billingCycle === 'yearly' ? p.amount / 12 : p.amount;
      return sum + monthly;
    }, 0),
  );

  ngOnInit(): void {
    let invoicesLoaded = false;
    let plansLoaded = false;

    const checkDone = () => {
      if (invoicesLoaded && plansLoaded) this.loading.set(false);
    };

    this.subs.add(
      this.invoiceRepo.watchAll().subscribe({
        next: (invoices) => {
          this.invoices.set(invoices);
          invoicesLoaded = true;
          checkDone();
        },
        error: () => this.loading.set(false),
      }),
    );
    this.subs.add(
      this.carePlanRepo.watchAll().subscribe({
        next: (plans) => {
          this.carePlans.set(plans);
          plansLoaded = true;
          checkDone();
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
