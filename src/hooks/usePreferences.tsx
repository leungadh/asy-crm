import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { UserPreferences } from '@/types/database'

type Patch = Partial<Omit<UserPreferences, 'staff_id'>>

interface PrefsValue {
  prefs: UserPreferences | null
  update: (patch: Patch) => Promise<void>
  saving: boolean
}

const PrefsContext = createContext<PrefsValue | null>(null)

const DEFAULTS: Omit<UserPreferences, 'staff_id'> = {
  locale: 'zh-HK',
  theme: 'rose',
  density: 'comfortable',
  corner_radius: 'medium',
  font_scale: '1.00',
}

/** The CSS in index.css already reacts to these; nothing was setting them. */
function applyToDocument(p: Omit<UserPreferences, 'staff_id'>) {
  const root = document.documentElement
  root.dataset.theme = p.theme
  root.dataset.density = p.density
  root.dataset.radius = p.corner_radius
  root.style.setProperty('--font-scale', String(Number(p.font_scale)))
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { staff } = useAuth()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!staff) return
    let cancelled = false

    supabase.from('user_preferences').select('*').eq('staff_id', staff.id).maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return

        // The auth trigger creates this row on first sign-in, but a staff row
        // seeded before that trigger existed will not have one.
        if (!data) {
          const { data: created } = await supabase
            .from('user_preferences')
            .insert({ staff_id: staff.id, ...DEFAULTS })
            .select('*').single()
          if (cancelled) return
          const row = (created ?? { staff_id: staff.id, ...DEFAULTS }) as UserPreferences
          setPrefs(row)
          applyToDocument(row)
          return
        }

        setPrefs(data as UserPreferences)
        applyToDocument(data as UserPreferences)
      })

    return () => { cancelled = true }
  }, [staff])

  const update = useCallback(async (patch: Patch) => {
    if (!staff) return
    // Apply immediately so the change is felt on click, then persist.
    setPrefs((p) => {
      const next = { ...(p ?? { staff_id: staff.id, ...DEFAULTS }), ...patch } as UserPreferences
      applyToDocument(next)
      return next
    })

    setSaving(true)
    try {
      await supabase.from('user_preferences')
        .upsert({ staff_id: staff.id, ...DEFAULTS, ...prefs, ...patch }, { onConflict: 'staff_id' })
    } finally {
      setSaving(false)
    }
  }, [staff, prefs])

  return (
    <PrefsContext.Provider value={{ prefs, update, saving }}>
      {children}
    </PrefsContext.Provider>
  )
}

export function usePreferences(): PrefsValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
