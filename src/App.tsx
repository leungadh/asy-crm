import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { I18nProvider } from '@/i18n'
import { ToastProvider } from '@/components/ui/toast'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import CustomerList from '@/pages/CustomerList'
import CustomerDetail from '@/pages/CustomerDetail'
import Treatments from '@/pages/Treatments'
import Stock from '@/pages/Stock'
import Placeholder from '@/pages/Placeholder'

function Gate() {
  const { session, staff, loading } = useAuth()

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  // No session, or a session whose account is not on the staff allowlist.
  if (!session || !staff) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Placeholder titleKey="dashboard" />} />
      <Route path="/customers" element={<CustomerList />} />
      <Route path="/customers/:id" element={<CustomerDetail />} />
      <Route path="/calendar" element={<Placeholder titleKey="calendar" />} />
      <Route path="/treatments" element={<Treatments />} />
      <Route path="/reviews" element={<Placeholder titleKey="reviews" />} />
      <Route path="/stock" element={<Stock />} />
      <Route path="/ledger" element={<Placeholder titleKey="ledger" />} />
      <Route path="/reports" element={<Placeholder titleKey="reports" />} />
      <Route path="/settings" element={<Placeholder titleKey="settings" />} />
      <Route path="*" element={<Navigate to="/customers" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
