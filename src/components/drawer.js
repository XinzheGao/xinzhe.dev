'use client'

import { useEffect, useRef, useState } from 'react'
import { usePreferences } from '@/components/preferences'
import { Drawer } from 'vaul'
import { CommandIcon } from 'lucide-react'
import { MenuContent } from '@/components/menu-content'
import { SidebarPreferences } from '@/components/sidebar-preferences'
import Link from '@/components/locale-link'
import { SITE } from '@/lib/site'

export function MobileDrawer() {
  const { t } = usePreferences()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <Drawer.Root
      direction="bottom"
      open={open}
      onOpenChange={setOpen}
      noBodyStyles
      disablePreventScroll={false}
      autoFocus
    >
      <Drawer.Trigger ref={triggerRef} className="mobile-menu-button" aria-label={t('openMenu')}>
        <CommandIcon size={18} strokeWidth={1.5} aria-hidden="true" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/20 lg:hidden" />
        <Drawer.Content
          ref={contentRef}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus({ preventScroll: true })
          }}
          className="mobile-navigation fixed inset-x-0 bottom-0 z-50 flex max-h-[55dvh] flex-col rounded-t-2xl bg-zinc-50 outline-none lg:hidden dark:bg-zinc-900"
        >
          <Drawer.Title className="sr-only">{t('navigation')}</Drawer.Title>
          <Drawer.Description className="sr-only">{t('openMenu')}</Drawer.Description>
          <div className="mobile-sheet-handle" aria-hidden="true" />
          <div className="mobile-navigation-bar">
            <Link href="/" onClick={() => setOpen(false)} className="mobile-menu-identity">
              <img src={SITE.avatar} alt="" width={36} height={36} />
              <span>
                <strong>{t('displayName')}</strong>
                <span>{t('role')}</span>
              </span>
            </Link>
            <SidebarPreferences side="bottom" align="end" />
          </div>
          <div className="mobile-navigation-body overflow-y-auto">
            <MenuContent mobile onNavigate={() => setOpen(false)} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
