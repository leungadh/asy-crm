import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui'
import { useI18n } from '@/i18n'
import type { Dictionary } from '@/i18n/zh-HK'

/** Every nav item routes somewhere from day one, so the shell is navigable
 *  before the remaining pages are built. */
export default function Placeholder({ titleKey }: { titleKey: keyof Dictionary['nav'] }) {
  const { t } = useI18n()
  return (
    <AppShell title={t.nav[titleKey]}>
      <Card className="px-6 py-16 text-center text-sm text-ink-400">
        {t.nav[titleKey]} — 建置中
      </Card>
    </AppShell>
  )
}
