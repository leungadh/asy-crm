import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

/** The single place the brand mark is defined. Both the sidebar and the login
 *  screen render this, so replacing the wordmark with an image later means
 *  editing one file:
 *
 *    import logo from '@/assets/logo.svg'
 *    ...
 *    <img src={logo} alt="ASY Beaute" className={sizes[size].img} />
 *
 *  Keep the alt text — it is what screen readers and the browser tab fall
 *  back to.
 */
export function Brand({ size = 'md', className }: {
  size?: 'md' | 'lg'
  className?: string
}) {
  const { t } = useI18n()

  const sizes = {
    md: 'text-[17px] tracking-[0.18em]',
    lg: 'text-xl tracking-[0.2em]',
  }

  return (
    <div className={cn('text-center', className)}>
      <p className={cn('font-semibold text-ink-900', sizes[size])}>{t.brand.name}</p>
    </div>
  )
}
