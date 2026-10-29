'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { localePath } from '@/lib/locale-routing.mjs'
import { translate } from '@/lib/i18n.mjs'
import { THEME_COLORS, requiresThemeReload } from '@/lib/browser-theme.mjs'

const PreferencesContext = createContext({ locale: 'zh-CN', theme: 'system' })

function savePreference(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

export function PreferencesProvider({ initialLocale, initialTheme, children }) {
  const locale = initialLocale
  const pathname = usePathname()
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    function syncBrowserTheme() {
      const resolved = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme
      const root = document.documentElement
      root.dataset.theme = theme
      root.style.colorScheme = resolved
      // Keep both media variants consistent with a manual choice. In system mode,
      // update them together when the OS changes, without replacing React-owned tags.
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute('content', THEME_COLORS[resolved])
      })
      document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved)
    }
    syncBrowserTheme()
    systemTheme.addEventListener('change', syncBrowserTheme)
    return () => systemTheme.removeEventListener('change', syncBrowserTheme)
  }, [theme, pathname])

  function changeLocale(value) {
    // A document navigation also updates root HTML, server content and metadata together.
    window.location.assign(localePath(pathname, value) + window.location.search + window.location.hash)
  }

  function changeTheme(value) {
    if (value === theme) return
    savePreference('site-theme', value)
    // Safari can retain the previous browser-chrome tint after an in-place
    // theme change. A document load re-samples the server-rendered new theme.
    if (requiresThemeReload(navigator)) {
      window.location.reload()
      return
    }
    document.documentElement.dataset.theme = value
    setTheme(value)
  }

  return (
    <PreferencesContext.Provider value={{ locale, theme, changeLocale, changeTheme }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext)
  return { ...preferences, t: (id, values) => translate(preferences.locale, id, values) }
}

export function Text({ id, values }) {
  const { t } = usePreferences()
  return t(id, values)
}

export function LocalizedDate({ date, options = { year: 'numeric', month: 'long', day: '2-digit' } }) {
  const { locale } = usePreferences()
  return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Shanghai', ...options }).format(new Date(date))
}

export function CompletionCheckbox({ checked }) {
  const { t } = usePreferences()
  return <input type="checkbox" checked={checked} disabled aria-label={t('completed')} />
}

export function TranslationNotice({ missing }) {
  return missing ? (
    <p className="mb-5 text-sm text-gray-500 dark:text-zinc-400">
      <Text id="translationPending" />
    </p>
  ) : null
}
