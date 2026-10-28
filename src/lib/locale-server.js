import 'server-only'
import { headers } from 'next/headers'
import { normalizeLocale } from './i18n.mjs'
import { languageAlternates } from './locale-routing.mjs'

export async function getLocale() {
  const h = await headers()
  return normalizeLocale(h.get('x-site-locale'))
}

export async function localizedMetadata(path, available) {
  const locale = await getLocale()
  return languageAlternates(path, locale, available)
}
