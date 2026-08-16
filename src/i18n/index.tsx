import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { zhHK, type Dictionary } from './zh-HK'
import { en } from './en'

export type Locale = 'zh-HK' | 'en'

const dictionaries: Record<Locale, Dictionary> = { 'zh-HK': zhHK, en }

interface I18nValue {
  locale: Locale
  t: Dictionary
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nValue | null>(null)

const STORAGE_KEY = 'asy.locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    return saved === 'en' ? 'en' : 'zh-HK'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    window.localStorage.setItem(STORAGE_KEY, l)
    document.documentElement.lang = l
  }, [])

  return (
    <I18nContext.Provider value={{ locale, t: dictionaries[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
