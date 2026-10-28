import 'server-only'
import catalog from '../../../translations/catalog.json'
import { getLocale } from '../locale-server'
import { documentKey, hydrateMedia } from './core.mjs'

export function availableLocales(kind, slug) {
  const record = catalog.documents[documentKey(kind, slug)]
  return ['zh-CN', ...['en', 'ja'].filter((locale) => record?.[locale]?.published)]
}

export async function localize(document, kind, { preview = false, locale } = {}) {
  if (!document) return document
  locale ??= await getLocale()
  if (locale === 'zh-CN' || preview) return { ...document, contentLocale: 'zh-CN' }
  const entry = catalog.documents[documentKey(kind, document.slug)]?.[locale]?.published
  if (!entry) return { ...document, contentLocale: 'zh-CN', translationMissing: true }
  const translated = hydrateMedia(entry.document, document)
  return {
    ...document,
    title: translated.title,
    ...(kind === 'journey' && { description: translated.description, image: translated.image }),
    seo: translated.seo,
    defaultDescription: translated.defaultDescription,
    ...(document.content && { content: translated.content }),
    translationUpdatedAt: entry.generatedAt,
    contentLocale: locale
  }
}
