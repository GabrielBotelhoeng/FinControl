import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { ListSkeleton } from '../components/ui/states';
import { HomeGate } from './home-gate';

const LoginPage = lazy(() => import('../features/auth/login-page').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('../features/dashboard/dashboard-page'));
const TransactionsPage = lazy(() => import('../features/transactions/transactions-page'));
const AccountsPage = lazy(() => import('../features/accounts/accounts-page'));
const InvoicesPage = lazy(() => import('../features/cards/invoices-page'));
const LoansPage = lazy(() => import('../features/loans/loans-page'));
const LoanDetailPage = lazy(() => import('../features/loans/loan-detail-page'));
const DebtsPage = lazy(() => import('../features/debts/debts-page'));
const PayoffPage = lazy(() => import('../features/debts/payoff-page'));
const DebtDetailPage = lazy(() => import('../features/debts/debt-detail-page'));
const NetWorthPage = lazy(() => import('../features/net-worth/net-worth-page'));
const ImportPage = lazy(() => import('../features/imports/import-page'));
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
  { path: '/entrar', element: page(<LoginPage />) },
  { path: '/privacidade', element: page(<PrivacyPage />) },
  { path: '/termos', element: page(<TermsPage />) },
  {
    path: '/',
    // Sem sessão, a `/` é o site de apresentação e as outras rotas levam à entrada (sub-projeto 17, S1).
    element: <HomeGate />,
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'lancamentos', element: page(<TransactionsPage />) },
      { path: 'importar', element: page(<ImportPage />) },
      { path: 'contas', element: page(<AccountsPage />) },
      { path: 'cartoes/:id', element: page(<InvoicesPage />) },
      { path: 'emprestimos', element: page(<LoansPage />) },
      { path: 'emprestimos/:id', element: page(<LoanDetailPage />) },
      { path: 'dividas', element: page(<DebtsPage />) },
      { path: 'dividas/plano', element: page(<PayoffPage />) },
      { path: 'dividas/:id', element: page(<DebtDetailPage />) },
      { path: 'patrimonio', element: page(<NetWorthPage />) },
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
