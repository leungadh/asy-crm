import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n'
import { Button, Card, Input } from '@/components/ui'
import { Brand } from '@/components/layout/Brand'

export default function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setState(error ? 'error' : 'sent')
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
              <p className="text-sm text-red-600">{t.auth.error}</p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={state === 'sending'}>
              {state === 'sending' ? t.auth.sending : t.auth.send}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
