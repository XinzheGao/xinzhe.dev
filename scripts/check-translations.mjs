import { appendFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createTranslationSourceClient } from '../src/lib/translations/source-client.mjs'
import { readJSON } from '../src/lib/translations/store.mjs'
import { scanAll } from '../src/lib/translations/scan.mjs'
import { checkDue, DEFAULT_AUTOMATION, latestCheckArtifact } from '../src/lib/translation-admin/automation.mjs'

const directory = resolve('translations')
const settings = await readJSON(join(directory, 'automation.json'), DEFAULT_AUTOMATION)
let lastCheck = await readJSON(join(directory, '.admin-check.json'), null)
if (process.env.GITHUB_ACTIONS && process.argv.includes('--scheduled') && settings.enabled) {
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/artifacts?per_page=100`,
    {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(20000)
    }
  )
  if (!response.ok) throw new Error(`Cannot read previous checks: HTTP ${response.status}`)
  lastCheck = latestCheckArtifact(
    (await response.json()).artifacts,
    process.env.TRANSLATION_BRANCH,
    process.env.GITHUB_REPOSITORY
  )
}
if (process.argv.includes('--scheduled') && !checkDue(settings, lastCheck)) {
  console.log('Automatic check disabled or not due; no Notion or model requests.')
} else {
  const client = createTranslationSourceClient()
  const check = await scanAll({ directory, client, configured: Boolean(process.env.NOTION_API_TOKEN) })
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `executed=true\ncheck_status=${check.status}\ncheck_id=${Date.parse(check.startedAt)}\n`
    )
  console.log(`All content: ${check.status}`)
  if (check.status !== 'succeeded') process.exitCode = 1
}
