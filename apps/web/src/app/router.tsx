import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { ListSkeleton } from '../components/ui/states';
import { LoginPage } from '../features/auth/login-page';
import { RequireAuth } from '../features/auth/require-auth';
import { AppShell } from './app-shell';

const DashboardPage = lazy(() => import('../features/dashboard/dashboard-page'));
const TransactionsPage = lazy(() => import('../features/transactions/transactions-page'));
const AccountsPage = lazy(() => import('../features/accounts/accounts-page'));
const CategoriesPage = lazy(() => import('../features/categories/categories-page'));
const ProfilePage = lazy(() => import('../features/profile/profile-page'));

const page = (node: ReactNode) => <Suspense fallback={<ListSkeleton />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: '/entrar', element: <LoginPage /> },
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
      { path: 'categorias', element: page(<CategoriesPage />) },
      { path: 'perfil', element: page(<ProfilePage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
