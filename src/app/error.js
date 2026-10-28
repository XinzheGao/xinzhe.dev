'use client'

import { usePreferences } from '@/components/preferences'

import Link from '@/components/locale-link'

export default function ErrorPage({ reset }) {
  const { t } = usePreferences()
  return (
    <div className="content-wrapper">
      <h1 className="text-2xl font-semibold">{t('error')}</h1>
      <p className="mt-4 text-gray-500 dark:text-zinc-400">{t('errorDescription')}</p>
      <div className="mt-6 flex gap-4">
        <button
          onClick={reset}
          className="rounded-lg bg-black px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t('retry')}
        </button>
        <Link href="/" className="rounded-lg border px-4 py-2">
          {t('returnHome')}
        </Link>
      </div>
    </div>
  )
}
