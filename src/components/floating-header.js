'use client'

import { memo } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { MobileDrawer } from '@/components/drawer'
import { SidebarPreferences } from '@/components/sidebar-preferences'
import Link from '@/components/locale-link'
import { usePreferences } from '@/components/preferences'
import { Button } from '@/components/ui/button.jsx'

export const FloatingHeader = memo(({ title, backHref }) => {
  const { t } = usePreferences()

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-6 lg:hidden dark:border-zinc-900 dark:bg-zinc-950">
      {backHref ? (
        <div className="-ml-2 shrink-0">
          <Button variant="ghost" size="icon" title={t('back')} asChild>
            <Link href={backHref} aria-label={t('back')}>
              <ArrowLeftIcon size={20} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="-ml-2 shrink-0">
            <MobileDrawer />
          </div>
          {title && <span className="min-w-0 truncate text-sm font-medium">{title}</span>}
        </>
      )}
      <div className="-mr-2 ml-auto shrink-0">
        <SidebarPreferences side="bottom" align="end" />
      </div>
    </header>
  )
})
