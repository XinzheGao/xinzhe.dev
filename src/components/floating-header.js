'use client'

import { memo } from 'react'
import Link from '@/components/locale-link'
import { ArrowLeftIcon } from 'lucide-react'
import { usePreferences } from '@/components/preferences'
import { MobileDrawer } from '@/components/drawer'

export const FloatingHeader = memo(({ scrollTitle, title, goBackLink, children }) => {
  const { t } = usePreferences()
  return (
    <header className="sticky top-0 z-10 flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white/95 px-6 backdrop-blur-sm lg:hidden dark:border-zinc-900 dark:bg-zinc-950/95">
      <div className="-ml-2 flex min-w-0 items-center gap-2">
        <MobileDrawer />
        {goBackLink && (
          <Link
            href={goBackLink}
            aria-label={t('back')}
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900"
          >
            <ArrowLeftIcon size={19} strokeWidth={1.5} />
          </Link>
        )}
        {(title || goBackLink) && <span className="truncate text-sm font-medium">{title || scrollTitle}</span>}
      </div>
      <div className="-mr-2 flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">{children}</div>
    </header>
  )
})
