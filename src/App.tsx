import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { PreferencesProvider } from '@/hooks/usePreferences'
import { I18nProvider } from '@/i18n'
import { ToastProvider } from '@/components/ui/toast'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import NoAccess from '@/pages/NoAccess'
import CustomerList from '@/pages/CustomerList'
import CustomerDetail from '@/pages/CustomerDetail'
import Treatments from '@/pages/Treatments'
import Stock from '@/pages/Stock'
import Calendar from '@/pages/Calendar'
import Settings from '@/pages/Settings'

// Chart-heavy pages: recharts is only fetched when one is opened.
const Ledger = lazy(() => import('@/pages/Ledger'))
const Reports = lazy(() => import('@/pages/Reports'))

function Gate() {
  const { session, staff, loading } = useAuth()

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (!session) return <Login />

  // Signed in, but the account is not on the staff allowlist. Returning to the
  // login screen here made it look as though the link had failed, so people
  // requested another — and the mailer is rate-limited, so they got stuck.
  if (!staff) return <NoAccess />

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
    <Routes>
      {/* No dashboard: 日曆 already answers "what am I doing today", and
          統計報表 has the numbers. A third page would duplicate both. */}
      <Route path="/" element={<Navigate to="/calendar" replace />} />
      <Route path="/customers" element={<CustomerList />} />
      <Route path="/customers/:id" element={<CustomerDetail />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/treatments" element={<Treatments />} />
      <Route path="/stock" element={<Stock />} />
      <Route path="/ledger" element={<Ledger />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/customers" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <BrowserRouter>
              <Gate />
            </BrowserRouter>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
