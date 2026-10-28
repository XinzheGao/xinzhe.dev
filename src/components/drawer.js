import { usePreferences } from '@/components/preferences'
import { Drawer } from 'vaul'
import { CommandIcon } from 'lucide-react'

import { MenuContent } from '@/components/menu-content'
import { Button } from '@/components/ui/button.jsx'

export function MobileDrawer() {
  const { t } = usePreferences()
  return (
    <Drawer.Root shouldScaleBackground>
      <Button variant="ghost" size="icon" title={t('openMenu')} asChild>
        <Drawer.Trigger aria-label={t('openMenu')}>
          <CommandIcon size={16} />
        </Drawer.Trigger>
      </Button>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="fixed right-0 bottom-0 left-0 mt-24 flex h-[80dvh] max-h-[calc(100dvh-1rem)] flex-col rounded-t-lg bg-gray-100 dark:bg-zinc-800">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[10px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-zinc-950">
            <Drawer.Title className="sr-only">{t('navigation')}</Drawer.Title>
            <Drawer.Description className="sr-only">{t('openMenu')}</Drawer.Description>
            <div className="mx-auto mb-8 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <MenuContent />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
