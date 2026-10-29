'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Link from '@/components/locale-link'
import { ArrowLeftIcon } from 'lucide-react'
import { usePreferences } from '@/components/preferences'
import { MobileDrawer } from '@/components/drawer'
import { cn } from '@/lib/utils'

export const FloatingHeader = memo(({ scrollTitle, title, goBackLink }) => {
  const { t } = usePreferences()
  const headerRef = useRef(null)
  const [hidden, setHidden] = useState(false)
  const isReading = Boolean(goBackLink)

  useEffect(() => {
    if (!isReading) return
    const scrollArea = headerRef.current?.closest('.scrollable-area')
    if (!scrollArea) return
    let anchor = scrollArea.scrollTop

    function onScroll() {
      // Clamp overscroll, and ignore small movements to keep the bar from flickering.
      const position = Math.max(0, Math.min(scrollArea.scrollTop, scrollArea.scrollHeight - scrollArea.clientHeight))
      if (position <= 16) {
        setHidden(false)
        anchor = position
      } else if (Math.abs(position - anchor) >= 12) {
        setHidden(position > 80 && position > anchor)
        anchor = position
      }
    }

    scrollArea.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollArea.removeEventListener('scroll', onScroll)
  }, [isReading, scrollTitle])

  return (
    <header
      ref={headerRef}
      inert={isReading && hidden ? true : undefined}
      onFocusCapture={() => setHidden(false)}
      className={cn(
        'sticky top-0 z-10 h-16 w-full shrink-0 items-center border-b border-gray-100 bg-white/95 px-4 backdrop-blur-sm lg:hidden dark:border-zinc-900 dark:bg-zinc-950/95',
        isReading
          ? 'grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2 transition-transform duration-200 ease-out motion-reduce:transition-none'
          : 'flex gap-3 px-6',
        isReading && hidden && 'pointer-events-none -translate-y-full'
      )}
    >
      {isReading ? (
        <>
          <Link
            href={goBackLink}
            aria-label={t('back')}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900"
          >
            <ArrowLeftIcon size={20} strokeWidth={1.5} />
          </Link>
          <span
            className="truncate text-center text-sm font-medium"
            title={typeof (title || scrollTitle) === 'string' ? title || scrollTitle : undefined}
          >
            {title || scrollTitle}
          </span>
          <span aria-hidden="true" />
        </>
      ) : (
        <>
          <div className="-ml-2 shrink-0">
            <MobileDrawer />
          </div>
          {title && <span className="min-w-0 truncate text-sm font-medium">{title}</span>}
        </>
      )}
    </header>
  )
})
