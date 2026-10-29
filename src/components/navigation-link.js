'use client'

import { memo } from 'react'
import Link from '@/components/locale-link'
import { usePathname } from 'next/navigation'
import { ArrowUpRightIcon, AtSignIcon } from 'lucide-react'

import { splitLocale } from '@/lib/locale-routing.mjs'
import { cn } from '@/lib/utils'

export const NavigationLink = memo(({ href, label, icon, shortcutNumber, onClick }) => {
  const pathname = usePathname()
  const iconCmp = icon ?? <AtSignIcon size={16} />

  const isInternal = href.startsWith('/')
  if (!isInternal) {
    return (
      <a
        key={href}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-[#F3F4F6] dark:hover:bg-zinc-800/60"
      >
        <span className="inline-flex items-center gap-2 font-medium">
          {iconCmp} {label}
        </span>
        <ArrowUpRightIcon size={16} />
      </a>
    )
  }

  let isActive = false
  if (pathname?.length > 0) {
    const splittedPathname = splitLocale(pathname).pathname.split('/')
    const currentPathname = splittedPathname[1] ?? ''
    isActive = currentPathname === href.split('/')[1]
  }

  return (
    <Link
      key={href}
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-keyshortcuts={shortcutNumber ? String(shortcutNumber) : undefined}
      className={cn(
        'group flex items-center justify-between rounded-lg p-2',
        isActive
          ? 'bg-[#ECEEF1] text-gray-900 dark:bg-zinc-800 dark:text-zinc-100'
          : 'hover:bg-[#F3F4F6] dark:hover:bg-zinc-800/60'
      )}
    >
      <span className="flex items-center gap-2">
        {iconCmp}
        <span className={isActive ? 'font-semibold' : 'font-medium'}>{label}</span>
      </span>
    </Link>
  )
})
