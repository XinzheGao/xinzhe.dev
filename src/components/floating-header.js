'use client'

import { memo } from 'react'
import { MobileDrawer } from '@/components/drawer'

export const FloatingHeader = memo(({ title }) => (
  <header className="mobile-header sticky top-0 z-10 flex h-16 w-full shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-6 lg:hidden dark:border-zinc-900 dark:bg-zinc-950">
    <div className="-ml-2 shrink-0">
      <MobileDrawer />
    </div>
    {title && <span className="min-w-0 truncate text-sm font-medium">{title}</span>}
  </header>
))
