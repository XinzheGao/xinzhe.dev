'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { localePath } from '@/lib/locale-routing.mjs'
import { translate } from '@/lib/i18n.mjs'

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
    document.documentElement.dataset.theme = theme
  }, [locale, theme])

  function changeLocale(value) {
    // A document navigation also updates root HTML, server content and metadata together.
    window.location.assign(localePath(pathname, value) + window.location.search + window.location.hash)
  }

  function changeTheme(value) {
    savePreference('site-theme', value)
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
