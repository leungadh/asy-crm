import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface StaffRow { id: string; display_name: string; initials: string; email: string }

interface AuthValue {
  session: Session | null
  staff: StaffRow | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [staff, setStaff] = useState<StaffRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) { setStaff(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // A valid session is not enough — the account must be on the staff allowlist.
  // If it is not, RLS returns zero rows and `staff` stays null, which the
  // router treats as "not signed in".
  useEffect(() => {
    if (!session) return
    let cancelled = false
    supabase
      .from('staff')
      .select('id, display_name, initials, email')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setStaff(data as StaffRow | null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [session])

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <AuthContext.Provider value={{ session, staff, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
