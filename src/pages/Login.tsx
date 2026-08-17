import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n'
import { Button, Card, Input } from '@/components/ui'
import { Brand } from '@/components/layout/Brand'

/** Maps Supabase's error to something actionable.
 *
 *  This previously showed "check the email address" for every failure, which
 *  is wrong for most of them and sends people hunting for a typo that is not
 *  there. A rate limit, a disabled-signup rejection and an SMTP failure all
 *  need different responses. */
function explain(message: string, status: number | undefined, t: ReturnType<typeof useI18n>['t']) {
  const m = message.toLowerCase()
  if (status === 429 || m.includes('rate limit') || m.includes('too many')) return t.auth.errorRateLimit
  if (m.includes('signups not allowed') || m.includes('not allowed for otp')) return t.auth.errorNotRegistered
  if (m.includes('smtp') || m.includes('sending') || m.includes('mail')) return t.auth.errorSmtp
  return t.auth.error
}

export default function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [friendly, setFriendly] = useState('')
  const [detail, setDetail] = useState('')

  // Which project the browser bundle is actually pointing at. A wrong or stale
  // value here looks exactly like a login problem, and is otherwise invisible.
  const host = (() => {
    try { return new URL(import.meta.env.VITE_SUPABASE_URL).host } catch { return 'not configured' }
  })()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    setFriendly('')
    setDetail('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setFriendly(explain(error.message, error.status, t))
      setDetail(`${error.status ?? ''} ${error.message}`.trim())
      setState('error')
    } else {
      setState('sent')
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-cream-100 px-6">
      <Card className="w-full max-w-sm px-7 py-8">
        <Brand size="lg" className="mb-7" />

        {state === 'sent' ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
            {t.auth.sent}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] text-ink-500">
                {t.auth.email}
              </label>
              <Input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <p className="text-xs text-ink-400">{t.auth.subtitle}</p>

            {state === 'error' && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                <p className="flex gap-1.5">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{friendly}</span>
                </p>
                {detail && (
                  <p className="mt-1.5 pl-5 text-xs text-red-500">
                    {t.auth.errorDetail}: {detail}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={state === 'sending'}>
              {state === 'sending' ? t.auth.sending : t.auth.send}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-ink-300">
          {t.auth.connectedTo} {host}
        </p>
      </Card>
    </div>
  )
}
