import { normalizeLocale } from './i18n.mjs'

export function splitLocale(pathname) {
  const match = pathname.match(/^\/(en|ja|zh-CN)(?=\/|$)/)
  return { locale: normalizeLocale(match?.[1]), pathname: (match ? pathname.slice(match[0].length) : pathname) || '/' }
}

export function localePath(href, locale) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href
  if (/^\/(api|_next|assets)(\/|$)/.test(href) || /\.[a-z0-9]+(?:[?#]|$)/i.test(href)) return href
  const [, pathname, suffix] = href.match(/^([^?#]*)(.*)$/)
  const path = splitLocale(pathname).pathname
  locale = normalizeLocale(locale)
  return (locale === 'zh-CN' ? path : `/${locale}${path === '/' ? '' : path}`) + suffix
}

export function languageAlternates(pathname, locale, available = ['zh-CN', 'en', 'ja']) {
  return {
    canonical: localePath(pathname, locale),
    languages: Object.fromEntries([
      ...available.map((language) => [language, localePath(pathname, language)]),
      ['x-default', localePath(pathname, 'zh-CN')]
    ])
  }
}
