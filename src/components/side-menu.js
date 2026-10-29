'use client'
import { useRouter } from 'next/navigation'
import Link from '@/components/locale-link'

import { ScrollArea } from '@/components/scroll-area'
import { useKeyPress } from '@/hooks/useKeyPress'
import { LINKS } from '@/lib/constants'
import { usePreferences } from '@/components/preferences'
import { localePath } from '@/lib/locale-routing.mjs'
import { cn } from '@/lib/utils'

export const SideMenu = ({ children, title, href, isInner }) => {
  const router = useRouter()
  const { locale } = usePreferences()
  useKeyPress(
    onKeyPress,
    LINKS.map((_, index) => `Digit${index + 1}`)
  )

  function onKeyPress(event) {
    const index = Number(event.code.replace('Digit', '')) - 1
    const link = LINKS[index]
    if (link) {
      event.preventDefault()
      router.push(localePath(link.href, locale))
    }
  }

  return (
    <ScrollArea
      className={cn(
        'hidden shrink-0 bg-zinc-50 lg:flex lg:flex-col lg:border-r dark:bg-zinc-900',
        isInner ? 'lg:w-80' : 'lg:w-70'
      )}
    >
      {title && (
        <div className="sticky top-0 z-10 border-b bg-zinc-50 px-5 py-3 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-tight">
              {href ? <Link href={href}>{title}</Link> : <span>{title}</span>}
            </div>
          </div>
        </div>
      )}
      <div className={cn('bg-zinc-50 p-3 dark:bg-zinc-900', !isInner && 'flex min-h-0 flex-1 flex-col')}>
        {children}
      </div>
    </ScrollArea>
  )
}
