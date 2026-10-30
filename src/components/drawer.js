'use client'

import { useEffect, useState } from 'react'
import { usePreferences } from '@/components/preferences'
import { Drawer } from 'vaul'
import { MenuIcon, XIcon } from 'lucide-react'

import { MenuContent } from '@/components/menu-content'
import { Button } from '@/components/ui/button.jsx'

export function MobileDrawer() {
  const { t } = usePreferences()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    // Radix's modal overlay already locks background scrolling. Vaul's extra iOS
    // scroll reset/body fixation conflicts with document scrolling and Safari's
    // collapsing toolbar, especially at the bottom of a smooth-scrolling page.
    <Drawer.Root direction="left" open={open} onOpenChange={setOpen} noBodyStyles disablePreventScroll={false}>
      <Button variant="ghost" size="icon" title={t('openMenu')} asChild>
        <Drawer.Trigger aria-label={t('openMenu')}>
          <MenuIcon size={20} strokeWidth={1.5} />
        </Drawer.Trigger>
      </Button>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/25 lg:hidden" />
        <Drawer.Content className="fixed inset-y-0 left-0 z-50 flex h-dvh w-80 max-w-[calc(100vw-3rem)] flex-col border-r border-gray-100 bg-white lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mobile-drawer-content flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-6 py-4 dark:bg-zinc-950">
            <Drawer.Title className="sr-only">{t('navigation')}</Drawer.Title>
            <Drawer.Description className="sr-only">{t('openMenu')}</Drawer.Description>
            <Drawer.Close
              aria-label={t('closeMenu')}
              className="-mr-2 mb-5 flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-900"
            >
              <XIcon size={20} strokeWidth={1.5} />
            </Drawer.Close>
            <MenuContent mobile onNavigate={() => setOpen(false)} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
