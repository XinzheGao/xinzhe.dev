import { createNotionClient } from '../notion-client.mjs'

// Use the same explicit data sources in local and GitHub workers.
export function createTranslationSourceClient(env = process.env) {
  return createNotionClient({
    token: env.NOTION_API_TOKEN,
    sources: Object.fromEntries(
      ['posts', 'pages', 'projects', 'thoughts', 'journey'].map((kind) => [
        kind,
        env[`NOTION_${kind.toUpperCase()}_DATA_SOURCE_ID`]?.trim()
      ])
    )
  })
}
