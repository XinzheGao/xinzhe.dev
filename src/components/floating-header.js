'use client'

import { memo } from 'react'
import { ChevronLeftIcon } from 'lucide-react'
import { MobileDrawer } from '@/components/drawer'
import Link from '@/components/locale-link'
import { usePreferences } from '@/components/preferences'

export const FloatingHeader = memo(({ title, backHref }) => {
  const { t } = usePreferences()

  return (
    <>
      <header className="mobile-header sticky top-0 z-20 flex w-full shrink-0 items-center justify-between border-b lg:hidden">
        {backHref ? (
          <Link href={backHref} className="mobile-header-back">
            <ChevronLeftIcon size={16} aria-hidden="true" />
            <span>{t(backHref === '/' ? 'home' : backHref.split('/')[1])}</span>
          </Link>
        ) : (
          <Link href="/" className="mobile-brand">
            {t('displayName')}
          </Link>
        )}
        <MobileDrawer />
      </header>
      {title && (
        <div className="mobile-page-heading lg:hidden">
          <h1>{title}</h1>
        </div>
      )}
    </>
  )
})
