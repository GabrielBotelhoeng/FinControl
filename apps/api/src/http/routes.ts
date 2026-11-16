import type { Router } from 'express';
import { accountsRouter } from '../modules/accounts/accounts.routes';
import { banksRouter } from '../modules/bank-rates/bank-rates.routes';
import { cardsRouter } from '../modules/cards/cards.routes';
import { categoriesRouter } from '../modules/categories/categories.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';
import { demoRouter } from '../modules/demo/demo.routes';
import { loansRouter } from '../modules/loans/loans.routes';
import { profileRouter } from '../modules/profile/profile.routes';
import { transactionsRouter } from '../modules/transactions/transactions.routes';
import type { Container } from './container';

export function registerRoutes(api: Router, c: Container, opts: { rateLimitEnabled: boolean }): void {
  api.use('/me', profileRouter(c.profile));
  api.use('/accounts', accountsRouter(c.accounts));
  api.use('/categories', categoriesRouter(c.categories));
  api.use('/transactions', transactionsRouter(c.transactions));
  api.use('/dashboard', dashboardRouter(c.dashboard));
  api.use('/cards', cardsRouter(c.cards));
  api.use('/banks', banksRouter(c.bankRates));
  api.use('/loans', loansRouter(c.loans));
  api.use('/demo', demoRouter(c.demo, opts));
}
