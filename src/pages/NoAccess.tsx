import { ShieldAlert } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { Brand } from '@/components/layout/Brand'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

/** Shown when someone authenticates successfully but is not on the staff
 *  allowlist. Without this they were bounced silently back to the login form,
 *  which reads as "the link didn't work" and leads to repeated attempts
 *  against a rate-limited mailer. */
export default function NoAccess() {
  const { t } = useI18n()
  const { session, signOut } = useAuth()

  return (
    <div className="flex min-h-full items-center justify-center bg-cream-100 px-6">
      <Card className="w-full max-w-sm px-7 py-8 text-center">
        <Brand size="lg" className="mb-6" />

        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50">
          <ShieldAlert className="size-6 text-amber-600" />
        </div>

        <p className="text-sm text-ink-700">{t.auth.notAllowed}</p>

        {session?.user?.email && (
          <p className="mt-2 text-xs text-ink-400">{session.user.email}</p>
        )}

        <Button className="mt-6 w-full" onClick={signOut}>{t.auth.signOut}</Button>
      </Card>
    </div>
  )
}
