'use client'

import { usePreferences } from '@/components/preferences'

import { memo, useEffect, useState } from 'react'
import Link from '@/components/locale-link'
import { ArrowLeftIcon } from 'lucide-react'

import { MobileDrawer } from '@/components/drawer'
import { Button } from '@/components/ui/button.jsx'
import { SCROLL_AREA_ID, MOBILE_SCROLL_THRESHOLD } from '@/lib/constants'

export const FloatingHeader = memo(({ scrollTitle, title, goBackLink, children }) => {
  const { t } = usePreferences()
  const [transformValues, setTransformValues] = useState({ translateY: 0, opacity: scrollTitle ? 0 : 1 })

  useEffect(() => {
    const scrollAreaElem = document.querySelector(`#${SCROLL_AREA_ID}`)

    const onScroll = (e) => {
      const scrollY = e.target.scrollTop

      const translateY = Math.max(100 - scrollY, 0)
      const opacity = Math.min(
        Math.max(
          ((scrollY - MOBILE_SCROLL_THRESHOLD * (MOBILE_SCROLL_THRESHOLD / (scrollY ** 2 / 100))) / 100).toFixed(2),
          0
        ),
        1
      )

      setTransformValues({ translateY, opacity })
    }

    if (scrollTitle) {
      scrollAreaElem?.addEventListener('scroll', onScroll, {
        passive: true
      })
    }
    return () => scrollAreaElem?.removeEventListener('scroll', onScroll)
  }, [scrollTitle])

  return (
    <header className="sticky inset-x-0 top-0 z-10 mx-auto flex h-12 w-full shrink-0 items-center overflow-hidden border-b bg-white text-sm font-medium lg:hidden dark:bg-zinc-950">
      <div className="flex h-full w-full items-center px-3">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-1">
            {goBackLink ? (
              <Button variant="ghost" size="icon" className="shrink-0" asChild>
                <Link href={goBackLink} title={t('back')}>
                  <ArrowLeftIcon size={16} />
                </Link>
              </Button>
            ) : (
              <MobileDrawer />
            )}
            <div className="flex flex-1 items-center justify-between">
              {scrollTitle && (
                <span
                  className="line-clamp-2 font-semibold tracking-tight"
                  style={{ transform: `translateY(${transformValues.translateY}%)`, opacity: transformValues.opacity }}
                >
                  {scrollTitle}
                </span>
              )}
              {title && (
                <span className="inline-block text-balance">
                  <span className="line-clamp-2 font-semibold tracking-tight">{title}</span>
                </span>
              )}
            </div>
          </div>
          {scrollTitle && <div className="flex min-w-[50px] justify-end">{children}</div>}
        </div>
      </div>
    </header>
  )
})
