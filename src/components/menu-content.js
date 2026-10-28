'use client'

import { SidebarPreferences } from '@/components/sidebar-preferences'
import { usePreferences } from '@/components/preferences'
import Link from '@/components/locale-link'

import { NavigationLink } from '@/components/navigation-link'
import { PROFILES, LINKS } from '@/lib/constants'
import { SITE } from '@/lib/site'

export const MenuContent = () => {
  const { t } = usePreferences()
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-sm">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-1">
            <Link
              href="/"
              className="-mx-1.5 -my-1 inline-flex min-w-0 items-center gap-2 rounded-sm p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <img
                src={SITE.avatar}
                alt={t('avatar', { name: SITE.shortName })}
                width={40}
                height={40}
                loading="lazy"
                className="shrink-0 rounded-full border shadow-xs"
              />
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold tracking-tight">{SITE.shortName}</span>
                <span className="text-gray-600 dark:text-zinc-400">{t('role')}</span>
              </div>
            </Link>
          </div>
          <nav aria-label={t('navigation')} className="flex flex-col gap-1">
            {LINKS.map((link, linkIndex) => (
              <NavigationLink
                key={link.href}
                href={link.href}
                label={t(link.slug)}
                icon={link.icon}
                shortcutNumber={linkIndex + 1}
              />
            ))}
          </nav>
        </div>
        <hr />
        <div className="flex flex-col gap-2 text-sm">
          <span className="px-2 text-xs leading-relaxed font-medium text-gray-600 dark:text-zinc-400">
            {t('findMe')}
          </span>
          <div className="flex flex-col gap-1">
            {Object.values(PROFILES).map((profile) => (
              <NavigationLink key={profile.url} href={profile.url} label={profile.title} icon={profile.icon} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex shrink-0 items-center">
        <SidebarPreferences />
      </div>
    </div>
  )
}
