'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { MobileDrawer } from '@/components/drawer'
import Link from '@/components/locale-link'
import { usePreferences } from '@/components/preferences'
import { cn } from '@/lib/utils'

export const FloatingHeader = memo(({ title, backHref }) => {
  const { t } = usePreferences()
  const headerRef = useRef(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!backHref) return
    const scrollArea = headerRef.current?.closest('.scrollable-area')
    if (!scrollArea) return

    let previousTop = scrollArea.scrollTop
    function handleScroll() {
      const top = Math.max(0, Math.min(scrollArea.scrollTop, scrollArea.scrollHeight - scrollArea.clientHeight))
      if (top <= 16) {
        setHidden(false)
        previousTop = top
        return
      }
      if (Math.abs(top - previousTop) < 8) return
      setHidden(top > previousTop && top > 64)
      previousTop = top
    }

    scrollArea.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollArea.removeEventListener('scroll', handleScroll)
  }, [backHref])

  return (
    <header
      ref={headerRef}
      inert={backHref && hidden ? true : undefined}
      className={cn(
        'sticky top-0 z-10 flex h-16 w-full shrink-0 items-center gap-3 px-6 lg:hidden',
        backHref
          ? 'bg-transparent transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none'
          : 'border-b border-gray-100 bg-white dark:border-zinc-900 dark:bg-zinc-950',
        backHref && (hidden ? 'pointer-events-none -translate-y-full opacity-0' : 'translate-y-0 opacity-100')
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label={t('back')}
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeftIcon size={20} aria-hidden="true" />
        </Link>
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
