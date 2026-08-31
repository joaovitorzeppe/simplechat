import { GlobeIcon } from './Icons'
import { localeNames, type Locale } from '../i18n/i18n'
import { useI18n } from '../i18n/use-i18n'
import { cn } from '../lib/cn'

const OPTIONS: Locale[] = ['pt', 'en', 'es']

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <label className={cn('inline-flex items-center gap-2 text-sm text-zinc-400', className)}>
      <GlobeIcon width={16} height={16} className="shrink-0 text-zinc-500" />
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={locale}
        aria-label={t('language.label')}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded-xl border border-line bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-accent cursor-pointer"
      >
        {OPTIONS.map((code) => (
          <option key={code} value={code}>
            {t(localeNames[code])}
          </option>
        ))}
      </select>
    </label>
  )
}
