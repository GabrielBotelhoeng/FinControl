import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { ListSkeleton } from '../components/ui/states';
import { LoginPage } from '../features/auth/login-page';
import { RequireAuth } from '../features/auth/require-auth';
import { AppShell } from './app-shell';

const DashboardPage = lazy(() => import('../features/dashboard/dashboard-page'));
const TransactionsPage = lazy(() => import('../features/transactions/transactions-page'));
const AccountsPage = lazy(() => import('../features/accounts/accounts-page'));
const InvoicesPage = lazy(() => import('../features/cards/invoices-page'));
const LoansPage = lazy(() => import('../features/loans/loans-page'));
const LoanDetailPage = lazy(() => import('../features/loans/loan-detail-page'));
const DebtsPage = lazy(() => import('../features/debts/debts-page'));
const DebtDetailPage = lazy(() => import('../features/debts/debt-detail-page'));
const CalendarPage = lazy(() => import('../features/calendar/calendar-page'));
const PlanningPage = lazy(() => import('../features/planning/planning-page'));
const SummaryPage = lazy(() => import('../features/summary/summary-page'));
const ReportsPage = lazy(() => import('../features/reports/reports-page'));
const AssistantPage = lazy(() => import('../features/assistant/assistant-page'));
const NotificationsPage = lazy(() => import('../features/notifications/notifications-page'));
const CategoriesPage = lazy(() => import('../features/categories/categories-page'));
const ProfilePage = lazy(() => import('../features/profile/profile-page'));
const PrivacyPage = lazy(() => import('../features/legal/privacy-page'));
const TermsPage = lazy(() => import('../features/legal/terms-page'));

const page = (node: ReactNode) => <Suspense fallback={<ListSkeleton />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: '/entrar', element: <LoginPage /> },
  { path: '/privacidade', element: page(<PrivacyPage />) },
  { path: '/termos', element: page(<TermsPage />) },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'lancamentos', element: page(<TransactionsPage />) },
      { path: 'contas', element: page(<AccountsPage />) },
      { path: 'cartoes/:id', element: page(<InvoicesPage />) },
      { path: 'emprestimos', element: page(<LoansPage />) },
      { path: 'emprestimos/:id', element: page(<LoanDetailPage />) },
      { path: 'dividas', element: page(<DebtsPage />) },
      { path: 'dividas/:id', element: page(<DebtDetailPage />) },
      { path: 'calendario', element: page(<CalendarPage />) },
      { path: 'planejamento', element: page(<PlanningPage />) },
      { path: 'relatorios', element: page(<ReportsPage />) },
      { path: 'resumo', element: page(<SummaryPage />) },
      { path: 'notificacoes', element: page(<NotificationsPage />) },
      { path: 'assistente', element: page(<AssistantPage />) },
      { path: 'categorias', element: page(<CategoriesPage />) },
      { path: 'perfil', element: page(<ProfilePage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
