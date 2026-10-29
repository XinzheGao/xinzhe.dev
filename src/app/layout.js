import '@/globals.css'
import { cookies, draftMode } from 'next/headers'
import Script from 'next/script'
import { GeistSans } from 'geist/font'
import { JetBrains_Mono } from 'next/font/google'
import { EyeIcon } from 'lucide-react'

import { PreferencesProvider, Text } from '@/components/preferences'
import { normalizeTheme } from '@/lib/i18n.mjs'

import { SideMenu } from '@/components/side-menu'
import { MenuContent } from '@/components/menu-content'
import { SITE } from '@/lib/site'
import { getSiteDescription } from '@/lib/content'
import { getLocale } from '@/lib/locale-server'
import { localePath } from '@/lib/locale-routing.mjs'
import { sharedTitle } from '@/app/shared-metadata'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['variable']
})

export default async function RootLayout({ children }) {
  const { isEnabled } = await draftMode()
  const preferences = await cookies()
  const locale = await getLocale()
  const theme = normalizeTheme(preferences.get('site-theme')?.value)

  return (
    <html
      lang={locale}
      data-theme={theme}
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <PreferencesProvider initialLocale={locale} initialTheme={theme}>
          <main vaul-drawer-wrapper="" className="min-h-screen bg-white dark:bg-zinc-950">
            {isEnabled && (
              <div className="absolute right-0 bottom-0 left-0 z-50 flex h-12 w-full items-center justify-center bg-green-500 text-center text-sm font-medium text-white">
                <div className="flex items-center gap-2">
                  <EyeIcon size={16} />
                  <span>
                    <Text id="draft" />
                  </span>
                </div>
              </div>
            )}
            <div className="lg:flex">
              <SideMenu>
                <MenuContent />
              </SideMenu>
              <div className="flex min-w-0 flex-1">{children}</div>
            </div>
          </main>
          {process.env.NEXT_PUBLIC_TINYBIRD_TOKEN && (
            <Script
              src="https://unpkg.com/@tinybirdco/flock.js"
              data-host="https://api.tinybird.co"
              data-token={process.env.NEXT_PUBLIC_TINYBIRD_TOKEN}
            />
          )}
        </PreferencesProvider>
      </body>
    </html>
  )
}

export async function generateMetadata() {
  const sharedDescription = await getSiteDescription()
  return {
    metadataBase: new URL(SITE.url),
    robots: {
      index: true,
      follow: true
    },
    title: sharedTitle,
    description: sharedDescription,
    openGraph: {
      title: {
        template: `%s — ${sharedTitle}`,
        default: sharedTitle
      },
      description: sharedDescription,
      alt: sharedTitle,
      type: 'website',
      url: localePath('/', await getLocale()),
      siteName: sharedTitle,
      locale: { 'zh-CN': 'zh_CN', en: 'en_US', ja: 'ja_JP' }[await getLocale()]
    },
    alternates: {
      canonical: '/'
    },
    twitter: {
      card: 'summary_large_image'
    },
    other: {
      pinterest: 'nopin'
    }
  }
}
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' }
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}
