'use client'

import { usePreferences } from '@/components/preferences'
export const LoadingSpinner = () => {
  const { t } = usePreferences()
  return (
    <div className="grid h-screen w-full place-content-center">
      <div
        className="inline-block h-4 w-4 animate-spin rounded-full border-[2px] border-current border-t-transparent text-black dark:text-zinc-100"
        role="status"
        aria-label={t('loading')}
      >
        <span className="sr-only">{t('loading')}</span>
      </div>
    </div>
  )
}
