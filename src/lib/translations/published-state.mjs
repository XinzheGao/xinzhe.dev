import { hash } from './core.mjs'

// Checkpoints and job timestamps must never trigger a website deployment.
export function publishedState(catalog) {
  return hash(
    Object.entries(catalog.documents || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([key, locales]) =>
        Object.entries(locales)
          .sort(([a], [b]) => a.localeCompare(b))
          .filter(([, record]) => record.published)
          .map(([locale, record]) => [key, locale, record.published])
      )
  )
}
